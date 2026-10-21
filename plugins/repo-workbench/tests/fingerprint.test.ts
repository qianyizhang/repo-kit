import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFingerprint } from '../scripts/fingerprint.ts';

void test('bundle identity changes with dependency resolutions, Vite configuration and HTML', async () => {
  const root = await mkdtemp(join(tmpdir(), 'workbench-fingerprint-'));
  try {
    for (const dir of ['packages/canvas', 'scripts'])
      await mkdir(join(root, dir), { recursive: true });
    for (const file of [
      'package.json',
      'package-lock.json',
      'plugin.json',
      'mcp.json',
      'tsconfig.json',
      'packages/canvas/vite.config.ts',
      'packages/canvas/index.html',
    ])
      await writeFile(join(root, file), '{}');
    let previous = await buildFingerprint(root);
    assert.equal(await buildFingerprint(root), previous);
    for (const file of [
      'package-lock.json',
      'packages/canvas/vite.config.ts',
      'packages/canvas/index.html',
    ]) {
      await writeFile(join(root, file), 'changed');
      const current = await buildFingerprint(root);
      assert.notEqual(current, previous, file);
      previous = current;
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
