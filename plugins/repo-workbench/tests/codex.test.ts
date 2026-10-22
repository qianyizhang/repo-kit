import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { setup } from '../packages/runtime/setup.ts';
const binary = process.env.REPO_WORKBENCH_CODEX_BIN;

async function codex(cwd: string, codexHome: string) {
  const child = spawn(binary!, ['app-server', '--stdio'], {
    cwd,
    env: { ...process.env, CODEX_HOME: codexHome },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stderr.resume(); // No personal config or parser excerpts in test output.
  const pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  let sequence = 0;
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    const message = JSON.parse(line) as {
      id?: number;
      result?: unknown;
      error?: { message: string };
    };
    if (message.id === undefined) return;
    const item = pending.get(message.id);
    if (!item) return;
    clearTimeout(item.timer);
    pending.delete(message.id);
    if (message.error) item.reject(new Error(message.error.message));
    else item.resolve(message.result);
  });
  const stopped = new Promise<void>((done) =>
    child.once('close', () => {
      for (const item of pending.values()) {
        clearTimeout(item.timer);
        item.reject(new Error('Codex exited'));
      }
      pending.clear();
      done();
    }),
  );
  child.on('error', () => {
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error('Cannot launch the supplied Codex binary'));
    }
    pending.clear();
  });
  async function request<T>(method: string, params: object): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Codex request timed out: ${method}`));
      }, 15000);
      pending.set(id, { resolve: (value) => resolve(value as T), reject, timer });
      child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }
  await request('initialize', {
    clientInfo: { name: 'repo_workbench_test', version: '1' },
    capabilities: { experimentalApi: true },
  });
  child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
  return {
    request,
    async close() {
      child.stdin.end();
      child.kill('SIGTERM');
      await stopped;
      lines.close();
    },
  };
}
type Catalogs = {
  marketplaces: Array<{
    name: string;
    plugins: Array<{ id: string; enabled: boolean; installed: boolean }>;
  }>;
};
type Config = { config: { plugins: Record<string, { enabled: boolean }> } };
type Detail = {
  plugin: { summary: { localVersion: string }; mcpServers: string[]; skills: unknown[] };
};
void test(
  'native Codex resolves repo precedence, isolates discovery, and sees updated packages after restart',
  { skip: !binary && 'Set REPO_WORKBENCH_CODEX_BIN for the opt-in, model-free native check' },
  async (t) => {
    const root = await realpath(await mkdtemp(resolve(tmpdir(), 'workbench-native-')));
    t.after(() => rm(root, { recursive: true, force: true }));
    const home = resolve(root, 'home'),
      codexHome = resolve(home, '.codex');
    const a = resolve(root, 'alpha'),
      b = resolve(root, 'beta'),
      outside = resolve(root, 'outside');
    await mkdir(codexHome, { recursive: true });
    await mkdir(outside);
    const userFile = resolve(codexHome, 'config.toml');
    const user =
      [a, b, outside]
        .map((path) => `[projects.${JSON.stringify(path)}]\ntrust_level = "trusted"\n`)
        .join('') + '[plugins."repo-workbench@personal-fixture"]\nenabled = true\n';
    await writeFile(userFile, user);
    const source = resolve(import.meta.dirname, '..');
    const targets: Array<{ repo: string; installed: string } & Awaited<ReturnType<typeof setup>>> =
      [];
    for (const repo of [a, b]) {
      const installed = resolve(repo, 'node_modules/@repo-kit/workbench');
      await mkdir(installed, { recursive: true });
      for (const name of ['plugin.json', 'mcp.json', 'dist', 'skills'])
        await cp(resolve(source, name), resolve(installed, name), { recursive: true });
      targets.push({
        repo,
        installed,
        ...(await setup(['--scope', 'repo', '--repo', repo], installed, { home, codexHome })),
      });
    }
    for (const target of targets) {
      const server = await codex(target.repo, codexHome);
      try {
        const { config } = await server.request<Config>('config/read', { cwd: target.repo });
        assert.equal(config.plugins[target.plugin].enabled, true);
        assert.equal(config.plugins['repo-workbench@personal-fixture'].enabled, false);
        assert.equal(config.plugins[targets.find((other) => other !== target)!.plugin], undefined);
        const catalog = await server.request<Catalogs>('plugin/list', {
          cwds: [target.repo],
          marketplaceKinds: ['local'],
          forceRefetch: true,
        });
        const listed = catalog.marketplaces.flatMap((m) => m.plugins);
        const own = listed.find((p) => p.id === target.plugin);
        assert.ok(own);
        assert.equal(
          listed.some((p) => p.id === targets.find((other) => other !== target)!.plugin),
          false,
        );
        const detail = await server.request<Detail>('plugin/read', {
          marketplacePath: target.marketplace,
          pluginName: 'repo-workbench',
        });
        assert.deepEqual(detail.plugin.mcpServers.sort(), ['repo_canvas', 'workbench_reports']);
        assert.equal(detail.plugin.skills.length, 2);
        t.diagnostic(
          `Repo catalog discovered; native materialization installed=${own.installed}, enabled=${own.enabled}. Desktop activation is a separate acceptance check.`,
        );
      } finally {
        await server.close();
      }
    }
    const fallback = await codex(outside, codexHome);
    try {
      const { config } = await fallback.request<Config>('config/read', { cwd: outside });
      assert.equal(config.plugins['repo-workbench@personal-fixture'].enabled, true);
      for (const target of targets) assert.equal(config.plugins[target.plugin], undefined);
      const listed = await fallback.request<Catalogs>('plugin/list', {
        cwds: [outside],
        marketplaceKinds: ['local'],
      });
      for (const target of targets)
        assert.equal(
          listed.marketplaces.some((m) => m.plugins.some((p) => p.id === target.plugin)),
          false,
        );
    } finally {
      await fallback.close();
    }
    const target = targets[0],
      manifestFile = resolve(target.installed, 'plugin.json');
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as { version: string };
    manifest.version = '0.1.1-test';
    await writeFile(manifestFile, JSON.stringify(manifest));
    const restarted = await codex(target.repo, codexHome);
    try {
      const detail = await restarted.request<Detail>('plugin/read', {
        marketplacePath: target.marketplace,
        pluginName: 'repo-workbench',
      });
      assert.equal(detail.plugin.summary.localVersion, manifest.version);
      const { config } = await restarted.request<Config>('config/read', { cwd: target.repo });
      assert.equal(config.plugins[target.plugin].enabled, true);
      assert.equal(config.plugins['repo-workbench@personal-fixture'].enabled, false);
    } finally {
      await restarted.close();
    }
    assert.equal(await readFile(userFile, 'utf8'), user);
  },
);
