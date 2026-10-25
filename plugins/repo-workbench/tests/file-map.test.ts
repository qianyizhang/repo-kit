import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { scan, applyReviews, exportFileMap, type FileRow } from '../packages/file-map/index.ts';
import { HostTestClient } from './host-client.ts';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';

const review = (row: FileRow, overrides: Record<string, unknown> = {}) => ({
  oid: row.oid,
  mode: row.mode,
  nature: 'Documentation',
  action: 'keep',
  reason: 'Used by readers',
  evidence: ['README.md:1'],
  ...overrides,
});
void test('file inventory: index facts, reviews, exports and delivered MCP failures', async (t) => {
  const temp = await realpath(await mkdtemp(resolve(tmpdir(), 'file-map-test-')));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const root = resolve(temp, 'repo');
  await mkdir(root);
  const git = (args: string[], input?: string) =>
    execFileSync('git', ['-C', root, ...args], { input, encoding: 'utf8' });
  git(['init', '-q']);
  git(['config', 'user.email', 'test@example.test']);
  git(['config', 'user.name', 'Test']);
  assert.deepEqual(scan(root).files, []);
  const weird = '<img src=x onerror=alert(1)>$&\n中文.md';
  await writeFile(resolve(root, weird), 'same');
  await writeFile(resolve(root, 'copy.md'), 'same');
  await writeFile(resolve(root, 'deleted.md'), 'old');
  await symlink('/not/a/readable/target', resolve(root, 'link'));
  git(['add', '.']);
  assert.deepEqual(scan(root).files.find((row) => row.path === 'copy.md')?.changes, ['staged']);
  git(['commit', '-qm', 'fixture']);
  await writeFile(resolve(root, 'copy.md'), 'working content is longer');
  await writeFile(resolve(root, 'untracked'), 'excluded');
  git(['rm', '-q', 'deleted.md']);
  const before = git(['status', '--porcelain=v1', '-z']);
  const inventory = scan(root);
  const row = inventory.files.find((row) => row.path === weird)!;
  assert.equal(inventory.files.length, 3);
  assert.deepEqual(inventory.staged_deletions, ['deleted.md']);
  assert.equal(inventory.files.find((row) => row.path === 'copy.md')?.size, 4);
  assert.equal(row.copies, 2);
  assert.equal(inventory.files.find((row) => row.path === 'link')?.nature, 'Symlink');
  for (const value of [
    [],
    { missing: review(row) },
    { [weird]: review(row, { oid: 'stale' }) },
    { [weird]: review(row, { evidence: [] }) },
    { [weird]: review(row, { action: 'delete-now' }) },
  ])
    assert.throws(() => applyReviews(inventory, value));
  assert.throws(
    () => applyReviews(inventory, { 'copy.md': review(row, { action: 'remove' }) }),
    /Pending changes/,
  );
  const reviews = resolve(temp, 'reviews.json');
  await writeFile(
    reviews,
    JSON.stringify({
      [weird]: review(row, {
        reason: '</script><script>alert(1)</script> $&',
        action: 'consolidate',
      }),
    }),
  );
  const out = resolve(temp, 'report');
  const result = await exportFileMap({ repo: root, out, reviews });
  const html = await readFile(result.file, 'utf8');
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('</script><script>alert(1)</script>'));
  assert.ok(html.includes('$&'));
  assert.ok(html.includes(JSON.stringify(inventory.repo)));
  assert.ok(!/\/\*INVENTORY\*\/\s*null/.test(html));
  assert.equal(result.reviewed, 1);
  await assert.rejects(exportFileMap({ repo: root, out }), /EEXIST/);
  assert.equal(await readFile(result.file, 'utf8'), html);
  const link = resolve(temp, 'output-link');
  await symlink(out, link);
  await assert.rejects(exportFileMap({ repo: root, out: link }), /EEXIST/);
  assert.equal(git(['status', '--porcelain=v1', '-z']), before);

  const client = new HostTestClient({ name: 'file-map-test', version: '1' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve('dist/reports-server.mjs')],
      env: { ...process.env, MCP_APP_LOG_ROOT: resolve(temp, 'diagnostics') },
      stderr: 'pipe',
    }),
  );
  t.after(() => client.close());
  const exported = await client.callTool({ name: 'file_map', arguments: { repo: root, reviews } });
  assert.notEqual(exported.isError, true);
  const content = z
    .object({ content: z.array(z.object({ type: z.literal('text'), text: z.string() })) })
    .parse(exported);
  const summary = z
    .object({ repo: z.string(), file: z.string(), reviewed: z.number() })
    .parse(JSON.parse(content.content[0].text));
  t.after(() => rm(resolve(summary.file, '..'), { recursive: true, force: true }));
  assert.equal(summary.repo, root);
  assert.equal(summary.reviewed, 1);
  assert.ok(await readFile(summary.file, 'utf8'));
  const failure = await client.callTool({ name: 'file_map', arguments: { repo: temp } });
  assert.equal(failure.isError, true);
  await writeFile(reviews, JSON.stringify({ [weird]: review(row, { oid: 'stale' }) }));
  assert.equal(
    (await client.callTool({ name: 'file_map', arguments: { repo: root, reviews } })).isError,
    true,
  );
  assert.equal(git(['status', '--porcelain=v1', '-z']), before);

  const oid = git(['rev-parse', 'HEAD:copy.md']).trim();
  git(['update-index', '--index-info'], `100644 ${oid} 1\tconflict\n100644 ${oid} 2\tconflict\n`);
  git([
    'update-index',
    '--add',
    '--cacheinfo',
    `160000,${git(['rev-parse', 'HEAD']).trim()},nested`,
  ]);
  const rows = scan(root).files;
  assert.equal(rows.find((row) => row.path === 'conflict')?.size, null);
  assert.ok(rows.find((row) => row.path === 'conflict')?.changes.includes('conflict'));
  assert.equal(rows.find((row) => row.path === 'nested')?.nature, 'Submodule');
  assert.equal(rows.find((row) => row.path === 'nested')?.size, null);
});
