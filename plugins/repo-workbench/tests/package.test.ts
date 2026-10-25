import { createHash } from 'node:crypto';
import { z } from 'zod';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { HostTestClient as Client } from '../../mcp-app-runtime/tests/host-client.ts';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createFixture } from '../packages/usage/fixture.ts';
import type { Snapshot } from '../packages/repo-canvas/src/model/document.ts';
const root = resolve(import.meta.dirname, '..');
void test('packed npm installation runs independently with scripts disabled and retains repository-local maps', async (t) => {
  const temporary = await realpath(await mkdtemp(resolve(tmpdir(), 'workbench-package-')));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const npm = resolve(process.execPath, '../npm');
  const packed = JSON.parse(
    execFileSync(
      npm,
      [
        'pack',
        '--ignore-scripts',
        '--json',
        '--pack-destination',
        temporary,
        '--cache',
        resolve(temporary, 'npm-cache'),
      ],
      {
        cwd: root,
        encoding: 'utf8',
      },
    ),
  ) as { filename: string }[];
  const codexHome = resolve(temporary, 'codex-home');
  await mkdir(codexHome);
  const userConfiguration = '[plugins."repo-workbench@user-test"]\nenabled = true\n';
  await writeFile(resolve(codexHome, 'config.toml'), userConfiguration);
  const consumer = resolve(temporary, 'consumer');
  await mkdir(consumer);
  execFileSync(
    npm,
    [
      'install',
      '--prefix',
      consumer,
      resolve(temporary, packed[0].filename),
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--offline',
      '--cache',
      resolve(temporary, 'npm-cache'),
    ],
    { encoding: 'utf8' },
  );
  const installed = resolve(consumer, 'node_modules/@repo-kit/workbench');
  const receipt = z
    .object({
      protocol: z.literal(1),
      build: z.string(),
      source: z.object({ revision: z.string().nullable(), dirty: z.boolean().nullable() }),
      lockSha256: z.string(),
      assets: z.array(z.object({ path: z.string(), bytes: z.number(), sha256: z.string() })),
    })
    .parse(JSON.parse(await readFile(resolve(installed, 'dist/release.json'), 'utf8')));
  assert.ok(receipt.assets.length > 3);
  for (const asset of receipt.assets) {
    const path = resolve(installed, 'dist', asset.path);
    assert.ok(path.startsWith(resolve(installed, 'dist') + '/'));
    const bytes = await readFile(path);
    assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  }
  const cli = resolve(installed, 'dist/cli.mjs');
  assert.match(
    execFileSync(process.execPath, [cli, '--help'], { cwd: consumer, encoding: 'utf8' }),
    /repo-workbench canvas/,
  );
  const sources = resolve(temporary, 'logs');
  await mkdir(sources);
  await createFixture(sources);
  const before = await readFile(resolve(sources, 'parent.jsonl'));
  const usage = JSON.parse(
    execFileSync(
      process.execPath,
      [
        cli,
        'usage',
        '--root',
        sources,
        '--cache',
        resolve(temporary, 'cache'),
        '--out',
        resolve(temporary, 'report'),
      ],
      { cwd: consumer, encoding: 'utf8' },
    ),
  ) as { file: string };
  assert.match(await readFile(usage.file, 'utf8'), /Codex usage/);
  assert.deepEqual(await readFile(resolve(sources, 'parent.jsonl')), before);
  const repos = await Promise.all(
    ['alpha', 'beta'].map(async (name) => {
      const repo = resolve(temporary, name);
      await mkdir(repo);
      execFileSync('git', ['init', '-q', repo]);
      await writeFile(resolve(repo, 'README.md'), name);
      execFileSync('git', ['-C', repo, 'add', 'README.md']);
      return repo;
    }),
  );
  for (const repo of repos) {
    const fileMap = JSON.parse(
      execFileSync(
        process.execPath,
        [cli, 'file-map', '--out', resolve(temporary, `file-map-${repo.split('/').at(-1)!}`)],
        { cwd: repo, encoding: 'utf8' },
      ),
    ) as { repo: string; paths: number; file: string };
    assert.equal(fileMap.repo, repo);
    assert.equal(fileMap.paths, 1);
    assert.match(await readFile(fileMap.file, 'utf8'), /What belongs here/);
  }
  assert.match(
    await readFile(resolve(installed, 'skills/repo-file-map/SKILL.md'), 'utf8'),
    /file_map/,
  );
  const client = new Client({ name: 'packed-consumer', version: '1' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve(installed, 'dist/canvas-server.mjs')],
      cwd: consumer,
      env: { ...process.env, XDG_CACHE_HOME: resolve(temporary, 'cache') },
    }),
  );
  let lastContext: string | undefined;
  try {
    const resources = await client.readResource({
      uri: (await client.listResources()).resources.find(
        (resource) => resource.name === 'Repo Canvas workbench',
      )!.uri,
    });
    assert.ok(
      resources.contents.some(
        (resource) => 'text' in resource && resource.text.includes('repo-canvas-mcp-app'),
      ),
    );
    for (const repo of repos) {
      const opened = await client.callTool({ name: 'canvas_open', arguments: { repo } });
      const { contextId } = opened.structuredContent as { contextId: string };
      lastContext = contextId;
      const result = await client.callTool({
        name: 'canvas_app',
        arguments: { contextId, request: { action: 'state', args: {} } },
      });
      const state = (result.structuredContent as { value: Snapshot }).value;
      assert.equal(state.repo, repo);
      const saved = await client.callTool({
        name: 'canvas_app',
        arguments: {
          contextId,
          request: {
            action: 'save',
            args: { revision: state.revision, document: { ...state.document, title: repo } },
          },
        },
      });
      assert.notEqual(saved.isError, true);
      assert.equal(
        (
          JSON.parse(await readFile(resolve(repo, '.repo-canvas/architecture.json'), 'utf8')) as {
            title: string;
          }
        ).title,
        repo,
      );
      const validation = JSON.parse(
        execFileSync(process.execPath, [cli, 'canvas', '--repo', repo, '--validate'], {
          cwd: consumer,
          encoding: 'utf8',
        }),
      ) as Snapshot;
      assert.equal(validation.document.title, repo);
    }
    const setup = JSON.parse(
      execFileSync(process.execPath, [cli, 'setup', '--scope', 'repo', '--repo', consumer], {
        cwd: temporary,
        env: { ...process.env, CODEX_HOME: codexHome },
        encoding: 'utf8',
      }),
    ) as { marketplace: string; register?: unknown; enable: { file: string; disabled: string[] } };
    assert.equal(setup.marketplace, resolve(consumer, '.agents/plugins/marketplace.json'));
    assert.equal(setup.register, undefined);
    assert.equal(setup.enable.file, resolve(consumer, '.codex/config.toml'));
    assert.match(await readFile(setup.enable.file, 'utf8'), /enabled = true/);
    assert.deepEqual(setup.enable.disabled, ['repo-workbench@user-test']);
    assert.equal(await readFile(resolve(codexHome, 'config.toml'), 'utf8'), userConfiguration);
  } finally {
    await client.close();
  }

  const savedMaps = await Promise.all(
    repos.map((repo) => readFile(resolve(repo, '.repo-canvas/architecture.json'))),
  );
  const savedConfig = await readFile(resolve(consumer, '.codex/config.toml'));
  const candidate = resolve(temporary, 'upgrade');
  await cp(installed, candidate, { recursive: true });
  for (const name of ['package.json', 'plugin.json']) {
    const file = resolve(candidate, name);
    const manifest = JSON.parse(await readFile(file, 'utf8')) as { version: string };
    manifest.version = '0.1.1-test';
    await writeFile(file, JSON.stringify(manifest));
  }
  const upgraded = JSON.parse(
    execFileSync(
      npm,
      [
        'pack',
        '--ignore-scripts',
        '--json',
        '--pack-destination',
        temporary,
        '--cache',
        resolve(temporary, 'npm-cache'),
      ],
      { cwd: candidate, encoding: 'utf8' },
    ),
  ) as { filename: string }[];
  execFileSync(
    npm,
    [
      'install',
      '--prefix',
      consumer,
      resolve(temporary, upgraded[0].filename),
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--offline',
      '--cache',
      resolve(temporary, 'npm-cache'),
    ],
    { encoding: 'utf8' },
  );
  assert.equal(
    (JSON.parse(await readFile(resolve(installed, 'plugin.json'), 'utf8')) as { version: string })
      .version,
    '0.1.1-test',
  );
  assert.deepEqual(await readFile(resolve(consumer, '.codex/config.toml')), savedConfig);
  const restarted = new Client({ name: 'upgraded-consumer', version: '1' });
  await restarted.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve(installed, 'dist/canvas-server.mjs')],
      cwd: consumer,
      env: { ...process.env, XDG_CACHE_HOME: resolve(temporary, 'cache') },
    }),
  );
  try {
    const stale = await restarted.callTool({
      name: 'canvas_app',
      arguments: { contextId: lastContext, request: { action: 'state', args: {} } },
    });
    assert.equal(stale.isError, true);
    for (const [index, repo] of repos.entries()) {
      const opened = await restarted.callTool({ name: 'canvas_open', arguments: { repo } });
      const { contextId } = opened.structuredContent as { contextId: string };
      const state = await restarted.callTool({
        name: 'canvas_app',
        arguments: { contextId, request: { action: 'state', args: {} } },
      });
      assert.equal((state.structuredContent as { value: Snapshot }).value.document.title, repo);
      assert.deepEqual(
        await readFile(resolve(repo, '.repo-canvas/architecture.json')),
        savedMaps[index],
      );
    }
  } finally {
    await restarted.close();
  }
});
