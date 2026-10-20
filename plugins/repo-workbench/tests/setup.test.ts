import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { setup } from '../packages/runtime/setup.ts';
void test('repository setup preserves unrelated catalog entries and refuses an outside installation', async (t) => {
  const repo = await realpath(await mkdtemp(resolve(tmpdir(), 'workbench-setup-')));
  t.after(() => rm(repo, { recursive: true, force: true }));
  const installed = resolve(repo, 'node_modules/@repo-kit/workbench');
  await mkdir(installed, { recursive: true });
  const catalog = resolve(repo, '.agents/plugins/marketplace.json');
  await mkdir(resolve(catalog, '..'), { recursive: true });
  const other = {
    name: 'another-plugin',
    source: { source: 'local', path: './another' },
    custom: 'preserved',
  };
  await writeFile(
    catalog,
    JSON.stringify({ name: 'existing', plugins: [other], interface: { displayName: 'My tools' } }),
  );
  const configured = await setup(['--scope', 'repo', '--repo', repo], installed);
  assert.equal(configured.plugin, 'repo-workbench@existing');
  assert.equal(configured.register, undefined);
  assert.deepEqual(configured.enable, {
    file: resolve(repo, '.codex/config.toml'),
    toml: '[plugins."repo-workbench@existing"]\nenabled = true\n',
  });
  assert.doesNotMatch(configured.next, /plugin add/);
  await setup(['--scope', 'repo', '--repo', repo], installed);
  const result = JSON.parse(await readFile(catalog, 'utf8')) as {
    plugins: unknown[];
    interface: unknown;
  };
  assert.equal(result.plugins.length, 2);
  assert.deepEqual(result.plugins[0], other);
  assert.deepEqual(result.interface, { displayName: 'My tools' });
  await assert.rejects(
    setup(['--scope', 'repo', '--repo', repo], tmpdir()),
    /Install the npm package inside/,
  );
});

void test('new repository catalogs have distinct stable identities and leave project configuration intact', async (t) => {
  const parent = await realpath(await mkdtemp(resolve(tmpdir(), 'workbench-scopes-')));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const identities = [];
  for (const name of ['alpha', 'beta']) {
    const repo = resolve(parent, name);
    const installed = resolve(repo, 'node_modules/@repo-kit/workbench');
    await mkdir(installed, { recursive: true });
    await mkdir(resolve(repo, '.codex'));
    const config = resolve(repo, '.codex/config.toml');
    const original = 'model = "example"\n';
    await writeFile(config, original);
    const first = await setup(['--scope', 'repo', '--repo', repo], installed);
    const second = await setup(['--scope', 'repo', '--repo', repo], installed);
    assert.equal(first.plugin, second.plugin);
    assert.equal(await readFile(config, 'utf8'), original);
    identities.push(first.plugin);
  }
  assert.notEqual(identities[0], identities[1]);
});
