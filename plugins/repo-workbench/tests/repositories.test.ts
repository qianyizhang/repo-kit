import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, realpath, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  registerRepository,
  registeredRepositories,
  unregisterRepository,
} from '../packages/runtime/repositories.ts';
void test('registry canonicalizes, deduplicates, reloads edits, and keeps missing paths removable', async (t) => {
  const root = await realpath(await mkdtemp(resolve(tmpdir(), 'workbench-registry-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = resolve(root, 'repo'),
    file = resolve(root, 'config/repositories.json');
  await mkdir(resolve(repo, 'src'), { recursive: true });
  execFileSync('git', ['init', '-q', repo]);
  assert.deepEqual(await registeredRepositories(file), []);
  await registerRepository(resolve(repo, 'src'), 'First', file);
  await registerRepository(repo, 'Renamed', file);
  const entries = await registeredRepositories(file);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].path, repo);
  assert.equal(entries[0].name, 'Renamed');
  const registry = JSON.parse(await readFile(file, 'utf8')) as {
    repositories: Array<{ name: string }>;
  };
  registry.repositories[0].name = 'External edit';
  await writeFile(file, JSON.stringify(registry));
  assert.equal((await registeredRepositories(file))[0].name, 'External edit');
  await rename(repo, repo + '-moved');
  assert.equal((await registeredRepositories(file))[0].available, false);
  await unregisterRepository(repo, file);
  assert.deepEqual(await registeredRepositories(file), []);
  assert.ok(await readFile(resolve(repo + '-moved', '.git/HEAD')));
});

void test('concurrent registrations preserve every repository', async (t) => {
  const root = await realpath(await mkdtemp(resolve(tmpdir(), 'workbench-registry-concurrent-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = resolve(root, 'config/repositories.json');
  const repos = Array.from({ length: 8 }, (_, i) => resolve(root, `repo-${i}`));
  for (const repo of repos) execFileSync('git', ['init', '-q', repo]);
  await Promise.all(repos.map((repo) => registerRepository(repo, undefined, file)));
  assert.deepEqual(
    (await registeredRepositories(file)).map((entry) => entry.path).sort(),
    repos.sort(),
  );
});
