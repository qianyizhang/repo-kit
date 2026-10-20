import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath, symlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { setup } from '../packages/runtime/setup.ts';
import { stringify } from 'smol-toml';
import { configuration, projectConfig } from '../packages/runtime/project-config.ts';

async function fixture(t: { after: (callback: () => Promise<void>) => void }) {
  const root = await realpath(await mkdtemp(resolve(tmpdir(), 'workbench-setup-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = resolve(root, 'home'),
    repo = resolve(root, 'repo');
  const codexHome = resolve(home, '.codex');
  const installed = resolve(repo, 'node_modules/@repo-kit/workbench');
  await mkdir(codexHome, { recursive: true });
  await mkdir(installed, { recursive: true });
  return {
    root,
    home,
    repo,
    installed,
    codexHome,
    environment: { home, codexHome },
    catalog: resolve(repo, '.agents/plugins/marketplace.json'),
    config: resolve(repo, '.codex/config.toml'),
    userConfig: resolve(codexHome, 'config.toml'),
  };
}
void test('repo setup preserves catalog/settings/comments, disables user Workbench only locally, and is idempotent', async (t) => {
  const f = await fixture(t);
  const user =
    '[plugins."repo-workbench@personal"]\nenabled = true\n[plugins."other@personal"]\nenabled = true\n';
  await writeFile(f.userConfig, user);
  await mkdir(resolve(f.catalog, '..'), { recursive: true });
  const other = {
    name: 'another-plugin',
    source: { source: 'local', path: './another' },
    custom: 'preserved',
  };
  await writeFile(
    f.catalog,
    JSON.stringify({ name: 'existing', plugins: [other], interface: { displayName: 'My tools' } }),
  );
  await mkdir(resolve(f.config, '..'));
  const original =
    '# my settings\nmodel = "example"\n[plugins."repo-workbench@existing"]\nenabled = false # my comment\ncustom = "kept"\n[plugins."other@personal"]\nenabled = true\n';
  await writeFile(f.config, original, { mode: 0o640 });
  const configured = await setup(['--scope', 'repo', '--repo', f.repo], f.installed, f.environment);
  t.after(() => rm(configured.backup!, { recursive: true, force: true }));
  assert.equal(configured.plugin, 'repo-workbench@existing');
  assert.equal(configured.register, undefined);
  assert.deepEqual(configured.enable, { file: f.config, disabled: ['repo-workbench@personal'] });
  const after = await readFile(f.config, 'utf8');
  assert.ok(
    after.startsWith(
      original.replace('enabled = false # my comment', 'enabled = true # my comment'),
    ),
  );
  assert.deepEqual(
    configuration(after).plugins,
    configuration(
      stringify({
        plugins: {
          'repo-workbench@existing': { enabled: true, custom: 'kept' },
          'repo-workbench@personal': { enabled: false },
          'other@personal': { enabled: true },
        },
      }),
    ).plugins,
  );
  assert.equal(await readFile(f.userConfig, 'utf8'), user);
  assert.equal(await readFile(resolve(configured.backup!, 'config.toml'), 'utf8'), original);
  assert.equal((await stat(configured.backup!)).mode & 0o777, 0o700);
  assert.equal((await stat(f.config)).mode & 0o777, 0o640);
  const beforeRepeat = await stat(f.config);
  const repeated = await setup(['--scope', 'repo', '--repo', f.repo], f.installed, f.environment);
  assert.deepEqual(repeated.changed, []);
  assert.equal(repeated.backup, undefined);
  assert.equal((await stat(f.config)).mtimeMs, beforeRepeat.mtimeMs);
  const result = JSON.parse(await readFile(f.catalog, 'utf8')) as {
    plugins: unknown[];
    interface: unknown;
  };
  assert.equal(result.plugins.length, 2);
  assert.deepEqual(result.plugins[0], other);
  assert.deepEqual(result.interface, { displayName: 'My tools' });
  await assert.rejects(
    setup(['--scope', 'repo', '--repo', f.repo], f.home, f.environment),
    /Install the npm package inside/,
  );
});
void test('repo catalogs keep stable distinct identities, and rerun absorbs a newly installed user version', async (t) => {
  const f = await fixture(t);
  const first = await setup(['--scope', 'repo', '--repo', f.repo], f.installed, f.environment);
  const secondRepo = resolve(f.root, 'second'),
    secondInstall = resolve(secondRepo, 'node_modules/workbench');
  await mkdir(secondInstall, { recursive: true });
  const second = await setup(
    ['--scope', 'repo', '--repo', secondRepo],
    secondInstall,
    f.environment,
  );
  assert.notEqual(first.plugin, second.plugin);
  await writeFile(f.userConfig, '[plugins."repo-workbench@new-user"]\nenabled = true\n');
  const repeated = await setup(['--scope', 'repo', '--repo', f.repo], f.installed, f.environment);
  t.after(() => rm(repeated.backup!, { recursive: true, force: true }));
  assert.equal(repeated.plugin, first.plugin);
  assert.deepEqual(repeated.enable?.disabled, ['repo-workbench@new-user']);
  assert.deepEqual(
    configuration(await readFile(f.config, 'utf8')).plugins,
    configuration(
      stringify({
        plugins: {
          [first.plugin]: { enabled: true },
          'repo-workbench@new-user': { enabled: false },
        },
      }),
    ).plugins,
  );
});
void test('invalid/unsupported config and identity collision leave both setup files unchanged', async (t) => {
  const f = await fixture(t);
  await mkdir(resolve(f.catalog, '..'), { recursive: true });
  const catalog = JSON.stringify({ name: 'existing', plugins: [] });
  await writeFile(f.catalog, catalog);
  await mkdir(resolve(f.config, '..'));
  for (const config of [
    'invalid = [',
    'plugins = { "repo-workbench@existing" = { enabled = false } }',
  ]) {
    await writeFile(f.config, config);
    await assert.rejects(
      setup(['--scope', 'repo', '--repo', f.repo], f.installed, f.environment),
      /Cannot (parse|safely edit)/,
    );
    assert.equal(await readFile(f.config, 'utf8'), config);
    assert.equal(await readFile(f.catalog, 'utf8'), catalog);
  }
  await writeFile(f.config, 'model = "example"\n');
  await writeFile(f.userConfig, '[plugins."repo-workbench@existing"]\nenabled = true\n');
  await assert.rejects(
    setup(['--scope', 'repo', '--repo', f.repo], f.installed, f.environment),
    /collides/,
  );
  assert.equal(await readFile(f.catalog, 'utf8'), catalog);
});
void test('repo setup refuses a .codex symlink to user configuration and does not create a catalog', async (t) => {
  const f = await fixture(t);
  await writeFile(f.userConfig, '# user settings\n');
  await symlink(f.codexHome, resolve(f.repo, '.codex'));
  await assert.rejects(
    setup(['--scope', 'repo', '--repo', f.repo], f.installed, f.environment),
    /symlinked/,
  );
  assert.equal(await readFile(f.userConfig, 'utf8'), '# user settings\n');
  await assert.rejects(readFile(f.catalog), { code: 'ENOENT' });
});
void test('text patch handles quotes/CRLF/missing booleans and refuses misleading multiline text', () => {
  const original = "# kept\r\n[plugins.'repo-workbench@local'] # table\r\ncustom = 42\r\n";
  const after = projectConfig(original, 'repo-workbench@local', []);
  assert.ok(after.includes('enabled = true\r\n'));
  assert.ok(after.includes('custom = 42\r\n'));
  assert.equal(projectConfig(after, 'repo-workbench@local', []), after);
  const misleading =
    'note = """\n[plugins."repo-workbench@local"]\nenabled = false\n"""\n[plugins."repo-workbench@local"]\nenabled = false\n';
  assert.throws(() => projectConfig(misleading, 'repo-workbench@local', []), /Cannot safely edit/);
});
void test('user catalog setup leaves user enablement untouched', async (t) => {
  const f = await fixture(t);
  const installed = resolve(f.home, '.local/workbench');
  await mkdir(installed, { recursive: true });
  await writeFile(f.userConfig, '# preserve\n');
  const result = await setup(['--scope', 'user'], installed, f.environment);
  assert.equal(result.enable, undefined);
  assert.deepEqual(result.register?.args, ['plugin', 'marketplace', 'add', f.home]);
  assert.equal(await readFile(f.userConfig, 'utf8'), '# preserve\n');
});

void test('rerun finishes an interrupted catalog-only setup without touching saved maps', async (t) => {
  const f = await fixture(t);
  await mkdir(resolve(f.repo, '.repo-canvas'));
  const map = resolve(f.repo, '.repo-canvas/architecture.json');
  await writeFile(map, 'saved map bytes');
  const first = await setup(['--scope', 'repo', '--repo', f.repo], f.installed, f.environment);
  const catalog = await readFile(f.catalog);
  await rm(f.config); // State left if interrupted after writing the catalog.
  const recovered = await setup(['--scope', 'repo', '--repo', f.repo], f.installed, f.environment);
  assert.equal(recovered.plugin, first.plugin);
  assert.deepEqual(recovered.changed, [f.config]);
  assert.deepEqual(await readFile(f.catalog), catalog);
  assert.equal(await readFile(map, 'utf8'), 'saved map bytes');
  assert.match(await readFile(f.config, 'utf8'), /enabled = true/);
});
