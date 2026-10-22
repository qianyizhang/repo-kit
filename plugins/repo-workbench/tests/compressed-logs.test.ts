import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { zstdCompressSync } from 'node:zlib';
import { scan, saveIndex, loadIndex, type ScanCache } from '../packages/usage/scan.ts';
import { createFixture } from '../packages/usage/fixture.ts';
import { normalizeSessionFile, readSessionBody } from '../packages/trace/jsonl.ts';
import { createTraceReader } from '../packages/usage/trace-service.ts';

void test('compressed history preserves totals, deduplication, decoded provenance and lazy bodies', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'compressed-logs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const plain = resolve(root, 'plain');
  await createFixture(plain);
  const original = await scan([plain]);
  const bytes = await readFile(resolve(plain, 'parent.jsonl'));
  const archive = resolve(root, 'history', '2026', '05');
  await mkdir(archive, { recursive: true });
  const path = resolve(archive, 'old.jsonl.zst');
  const old = bytes.toString().replaceAll('2026-10-09', '2026-05-09');
  await writeFile(path, zstdCompressSync(old));
  const cache: ScanCache = new Map();
  const loaded = await scan([path], cache);
  assert.equal(loaded.records.length, 2, JSON.stringify(loaded.gaps));
  assert.ok(loaded.records.every((r) => r.at.startsWith('2026-05-09')));
  assert.deepEqual(
    loaded.records.map((r) => r.tokens),
    original.records.filter((r) => r.session === 'parent').map((r) => r.tokens),
  );
  assert.equal(loaded.sources[0].bytes, Buffer.byteLength(old));
  assert.equal(loaded.sources[0].encoding, 'zstd');
  await saveIndex(resolve(root, 'index'), cache, new Map());
  assert.equal((await scan([path], await loadIndex(resolve(root, 'index')))).cachedFiles, 1);
  await writeFile(path, zstdCompressSync(bytes));
  const both = await scan([plain, archive], cache);
  assert.equal(both.records.length, original.records.length);
  assert.equal(both.reindexedFiles > 0, true);
  const trace = await normalizeSessionFile(path, 'parent', 'Main', { lazyBodies: true });
  const event = trace.turns.flatMap((t) => t.events).find((e) => e.body)!;
  assert.equal((await readSessionBody(trace, event)).text, 'PRIVATE_PROMPT_SENTINEL');
  const selected = await createTraceReader(() => loaded)('parent');
  assert.ok(selected?.data.threads.length);
  await writeFile(
    path,
    zstdCompressSync(
      bytes.toString().replace('PRIVATE_PROMPT_SENTINEL', 'CHANGED_PROMPT_SENTINEL'),
    ),
  );
  await assert.rejects(readSessionBody(trace, event), /Source record changed/);
  await writeFile(path, zstdCompressSync(bytes).subarray(0, -4));
  const truncated = await scan([path], cache);
  assert.equal(truncated.records.length, 0);
  assert.ok(truncated.gaps.some((g) => g.reason.startsWith('Cannot read file')));
  await writeFile(path, Buffer.from('not zstd'));
  const corrupt = await scan([path], cache);
  assert.equal(corrupt.records.length, 0);
  assert.ok(corrupt.gaps.some((g) => g.reason.startsWith('Cannot read file')));
});
