import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
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
      return repo;
    }),
  );
  const client = new Client({ name: 'packed-consumer', version: '1' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve(installed, 'dist/canvas-server.mjs')],
      cwd: consumer,
    }),
  );
  try {
    const resources = await client.readResource({ uri: 'ui://repo-canvas/workbench-v2.html' });
    assert.ok(
      resources.contents.some(
        (resource) => 'text' in resource && resource.text.includes('repo-canvas-mcp-app'),
      ),
    );
    for (const repo of repos) {
      const opened = await client.callTool({ name: 'canvas_open', arguments: { repo } });
      const { contextId } = opened.structuredContent as { contextId: string };
      const result = await client.callTool({
        name: 'canvas_app',
        arguments: { contextId, action: 'state' },
      });
      const state = (result.structuredContent as { value: Snapshot }).value;
      assert.equal(state.repo, repo);
      const saved = await client.callTool({
        name: 'canvas_app',
        arguments: {
          contextId,
          action: 'save',
          revision: state.revision,
          document: { ...state.document, title: repo },
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
        encoding: 'utf8',
      }),
    ) as { marketplace: string; register?: unknown; enable: { file: string; toml: string } };
    assert.equal(setup.marketplace, resolve(consumer, '.agents/plugins/marketplace.json'));
    assert.equal(setup.register, undefined);
    assert.equal(setup.enable.file, resolve(consumer, '.codex/config.toml'));
    assert.match(setup.enable.toml, /enabled = true/);
  } finally {
    await client.close();
  }
});
