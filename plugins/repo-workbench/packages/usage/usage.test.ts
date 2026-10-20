import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
  appendFile,
  rename,
  readdir,
  mkdir,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createFixture } from './fixture.ts';
import { createHash, randomBytes } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { AppendHash } from './sha256.ts';
import { officialPrices } from './pricing.ts';
import { scan, loadIndex, saveIndex, type ScanCache } from './scan.ts';
import {
  summarize,
  selectRecords,
  dateKey,
  parsePrices,
  csv,
  estimate,
  type Filters,
} from './model.ts';
import { buildDashboard, startServer } from './build.ts';
import type { TraceThread } from '../trace/contracts.ts';
const all: Filters = {
  from: '',
  to: '',
  model: '',
  project: '',
  effort: '',
  search: '',
  timezone: 'UTC',
};
async function fixture() {
  const dir = await mkdtemp(resolve(tmpdir(), 'usage-test-'));
  await createFixture(dir);
  return dir;
}
void test('local log journey reconciles responses, archived copies, snapshots and fork replay', async () => {
  const dir = await fixture();
  try {
    const snapshot = await scan([dir]);
    const result = summarize(snapshot.records, {});
    assert.equal(result.total, 2860);
    assert.equal(result.events, 6);
    assert.equal(result.sessions, 4);
    assert.equal(result.tokens.input, 2600);
    assert.equal(result.tokens.cached, 1130);
    assert.equal(result.tokens.output, 260);
    assert.equal(result.reasoningShare, 0.5);
    assert.equal(
      summarize(selectRecords(snapshot.records, { ...all, effort: 'medium' }), {}).total,
      990,
    );
    assert.equal(snapshot.gaps.length, 0);
    assert.equal(snapshot.inherited, 4);
    assert.ok(snapshot.duplicates >= 3);
    assert.ok(snapshot.sources.every((s) => s.sha256.length === 64));
    assert.equal(
      snapshot.sources.reduce((n, s) => n + s.records, 0),
      6,
    );
    assert.equal(JSON.stringify(snapshot).includes('PRIVATE_PROMPT_SENTINEL'), false);
    const filtered = selectRecords(snapshot.records, {
      ...all,
      model: 'model-b',
      from: '2026-10-09',
      to: '2026-10-09',
    });
    assert.equal(summarize(filtered, {}).total, 990);
    assert.equal(dateKey('2026-10-08T20:00:00Z', 'Asia/Shanghai'), '2026-10-09');
    const prices = parsePrices({ 'model-a': { input: 2, cached: 1, write: 3, output: 10 } });
    assert.equal(summarize(snapshot.records, prices).priced, 3);
    assert.equal(summarize(snapshot.records, prices).knownCost, 0.0042);
    assert.equal(csv(filtered, prices).split('\r\n').length, 4);
    assert.equal(summarize([{ ...snapshot.records[0], model: 'constructor' }], {}).priced, 0);
    assert.throws(() => parsePrices({ 'model-a': { input: -1, cached: 1, write: 1, output: 1 } }));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
void test('delegation does not imply inherited usage; explicit fork and history links do', async () => {
  const dir = await fixture();
  try {
    const delegated = resolve(dir, 'delegated.jsonl');
    await writeFile(
      delegated,
      [
        {
          type: 'session_meta',
          payload: {
            id: 'delegated',
            parent_thread_id: 'unavailable-parent',
            timestamp: '2026-10-09T00:00:00Z',
          },
        },
        {
          type: 'event_msg',
          timestamp: '2026-10-09T06:00:00Z',
          payload: {
            type: 'token_count',
            info: { last_token_usage: { input_tokens: 100, output_tokens: 10 } },
          },
        },
      ]
        .map((row) => JSON.stringify(row))
        .join('\n'),
    );
    const fork = resolve(dir, 'fork.jsonl');
    const original = await readFile(fork, 'utf8');
    await writeFile(
      fork,
      original.replace(
        '"forked_from_id":"legacy"',
        '"parent_thread_id":"unavailable-parent","forked_from_id":"legacy"',
      ),
    );
    let snapshot = await scan([dir]);
    assert.equal(summarize(snapshot.records, {}).total, 2970);
    assert.equal(snapshot.gaps.length, 0);
    const source = snapshot.sources.find((s) => s.session === 'fork');
    assert.equal(source?.parent, 'unavailable-parent');
    assert.equal(source?.forkedFrom, 'legacy');
    await writeFile(
      fork,
      original.replace('"forked_from_id":"legacy"', '"history_base":{"thread_id":"legacy"}'),
    );
    snapshot = await scan([dir]);
    assert.equal(summarize(snapshot.records, {}).total, 2970);
    assert.equal(snapshot.sources.find((s) => s.session === 'fork')?.historyBase, 'legacy');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
void test('refresh rescans changed files, reports bad tails and removes deleted sources', async () => {
  const dir = await fixture();
  try {
    const cache: ScanCache = new Map();
    await scan([dir], cache);
    assert.equal((await scan([dir], cache)).cachedFiles, 5);
    await appendFile(resolve(dir, 'child.jsonl'), 'not-json\n');
    const changed = await scan([dir], cache);
    assert.equal(changed.cachedFiles, 4);
    assert.ok(changed.gaps.some((g) => g.reason.includes('Malformed JSON')));
    assert.equal(summarize(changed.records, {}).total, 2860);
    await rm(resolve(dir, 'child.jsonl'));
    const removed = await scan([dir], cache);
    assert.equal(summarize(removed.records, {}).total, 2640);
    assert.equal(removed.sources.length, 4);
    assert.equal(cache.size, 4);
    assert.ok((await scan([resolve(dir, 'absent')])).gaps[0].reason.includes('ENOENT'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
void test('cumulative-only reset and orphan fork fail visibly rather than inflating totals', async () => {
  const dir = await fixture();
  try {
    const root = {
      type: 'session_meta',
      payload: { id: 'delta', timestamp: '2026-10-09T00:00:00Z' },
    };
    const e = (input: number, output: number, hour: number) => ({
      type: 'event_msg',
      timestamp: `2026-10-09T0${hour}:00:00Z`,
      payload: {
        type: 'token_count',
        info: { total_token_usage: { input_tokens: input, output_tokens: output } },
      },
    });
    await writeFile(
      resolve(dir, 'delta.jsonl'),
      [root, e(100, 10, 1), e(150, 20, 2), e(20, 2, 3), e(30, 3, 4)]
        .map((v) => JSON.stringify(v))
        .join('\n'),
    );
    const s = await scan([resolve(dir, 'delta.jsonl')]);
    assert.equal(summarize(s.records, {}).total, 181);
    assert.ok(s.gaps.some((g) => g.reason.includes('decreased')));
    await writeFile(
      resolve(dir, 'orphan.jsonl'),
      [
        { ...root, payload: { ...root.payload, id: 'orphan', forked_from_id: 'missing' } },
        e(100, 10, 1),
      ]
        .map((v) => JSON.stringify(v))
        .join('\n'),
    );
    const orphan = await scan([resolve(dir, 'orphan.jsonl')]);
    assert.equal(orphan.records.length, 0);
    assert.ok(orphan.gaps.some((g) => g.reason.includes('Parent lineage unavailable')));
    await appendFile(
      resolve(dir, 'delta.jsonl'),
      '\n' +
        JSON.stringify({
          type: 'token_usage_record',
          timestamp: '2026-10-09T05:00:00Z',
          payload: {
            thread_id: 'delta',
            response_id: 'new-response',
            usage: { input_tokens: 200, output_tokens: 20 },
          },
        }),
    );
    const mixed = await scan([resolve(dir, 'delta.jsonl')]);
    assert.equal(summarize(mixed.records, {}).total, 220);
    assert.ok(mixed.gaps.some((g) => g.reason.includes('Legacy snapshots predate')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
void test('standalone build and loopback refresh preserve inputs and refuse overwrite/cross-origin requests', async (t) => {
  const dir = await fixture();
  const cache: ScanCache = new Map();
  const before = await readFile(resolve(dir, 'parent.jsonl'));
  let result: Awaited<ReturnType<typeof buildDashboard>> | undefined;
  try {
    result = await buildDashboard({ roots: [dir], cache });
    assert.ok(result.html.includes('Codex usage'));
    assert.ok(!result.html.includes('PRIVATE_PROMPT_SENTINEL'));
    assert.ok(!result.html.includes('src="https://'));
    await assert.rejects(buildDashboard({ roots: [dir], output: result.output }), /EEXIST/);
    let service: Awaited<ReturnType<typeof startServer>>;
    try {
      service = await startServer(result, [dir], cache, 0);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EPERM') {
        t.skip(
          'Loopback binding blocked by sandbox; run node --test packages/usage/usage.test.ts with approved execution.',
        );
        return;
      }
      throw error;
    }
    const { server, url } = service;
    try {
      assert.equal((await fetch(url)).status, 200);
      assert.equal((await fetch(url + 'arbitrary-file')).status, 404);
      assert.equal((await fetch(url + 'trace?session=missing')).status, 404);
      assert.equal((await fetch(url + 'trace?session=../../etc/passwd')).status, 404);
      const trace = await fetch(url + 'trace?session=parent');
      assert.equal(trace.status, 200);
      const html = await trace.text();
      const encoded = /<script id="trace-data"[^>]*>([^<]+)<\/script>/.exec(html)?.[1];
      assert.ok(encoded);
      const data = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString()) as {
        threads: TraceThread[];
      };
      const event = data.threads
        .flatMap((thread) => thread.turns.flatMap((turn) => turn.events))
        .find((event) => event.body);
      assert.ok(event?.body);
      const query = new URLSearchParams({
        session: 'parent',
        event: event.key,
        revision: event.body.sources.map((source) => source.sha256).join('.'),
        field: 'text',
        offset: '0',
      });
      const record = await fetch(url + 'trace-record?' + query.toString());
      assert.equal(record.status, 200);
      assert.equal(((await record.json()) as { text: string }).text, event.text);
      query.set('field', 'sourcePath');
      assert.equal((await fetch(url + 'trace-record?' + query.toString())).status, 400);
      query.set('field', 'text');
      query.set('offset', '-1');
      assert.equal((await fetch(url + 'trace-record?' + query.toString())).status, 400);
      query.set('offset', '0');
      query.set('revision', 'stale');
      assert.equal((await fetch(url + 'trace-record?' + query.toString())).status, 409);
      query.set('event', 'missing-or-private');
      assert.equal((await fetch(url + 'trace-record?' + query.toString())).status, 404);
      assert.equal((await fetch(url + 'trace-record?session=../../etc/passwd')).status, 404);
      const manifest = await fetch(url + 'trace-manifest?session=parent');
      const evidence = (await manifest.json()) as {
        sources: { id: string; source: { sha256: string } }[];
      };
      assert.deepEqual(
        evidence.sources.map((source) => source.id),
        ['parent', 'child'],
      );
      assert.ok(evidence.sources.every((source) => source.source.sha256.length === 64));
      await appendFile(
        resolve(dir, 'child.jsonl'),
        JSON.stringify({
          type: 'event_msg',
          payload: { type: 'agent_message', message: 'APPENDED_TRACE_MESSAGE' },
        }) + '\n',
      );
      const changed = await fetch(url + 'trace-manifest?session=parent');
      const changedEvidence = (await changed.json()) as typeof evidence;
      assert.notEqual(changedEvidence.sources[1].source.sha256, evidence.sources[1].source.sha256);
      assert.ok(
        !(await readFile(resolve(result.output, 'usage.json'), 'utf8')).includes(
          'APPENDED_TRACE_MESSAGE',
        ),
      );
      assert.equal((await fetch(url + 'refresh', { method: 'POST' })).status, 403);
      assert.equal(
        (
          await fetch(url + 'refresh', {
            method: 'POST',
            headers: { 'X-Usage-Refresh': '1', Origin: 'https://example.org' },
          })
        ).status,
        403,
      );
      const refresh = await fetch(url + 'refresh', {
        method: 'POST',
        headers: { 'X-Usage-Refresh': '1' },
      });
      assert.equal(refresh.status, 200);
      const refreshed: unknown = await refresh.json();
      assert.ok(refreshed && typeof refreshed === 'object' && 'cachedFiles' in refreshed);
      assert.equal(refreshed.cachedFiles, 4);
    } finally {
      await new Promise<void>((done, reject) => {
        server.close((e) => (e ? reject(e) : done()));
      });
    }
    // A failed refresh reports the write failure and still preserves source logs.
    const file = resolve(result.output, 'usage.json');
    const saved = await readFile(file);
    await rm(file);
    await mkdir(file);
    const restarted = await startServer(result, [dir], cache, 0);
    try {
      const failed = await fetch(restarted.url + 'refresh', {
        method: 'POST',
        headers: { 'X-Usage-Refresh': '1' },
      });
      assert.equal(failed.status, 500);
    } finally {
      await rm(file, { recursive: true });
      await writeFile(file, saved);
      await new Promise<void>((done, reject) => {
        restarted.server.close((e) => (e ? reject(e) : done()));
      });
    }
    assert.deepEqual(await readFile(resolve(dir, 'parent.jsonl')), before);
  } finally {
    if (result) await rm(result.output, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });
  }
});

void test('durable index restores unchanged files and reads only appended bytes, including provisional tails', async () => {
  const dir = await fixture();
  const index = await mkdtemp(resolve(tmpdir(), 'usage-index-test-'));
  try {
    const cache: ScanCache = new Map();
    await scan([dir], cache);
    await saveIndex(index, cache, new Map());
    const restored = await loadIndex(index);
    const warm = await scan([dir], restored);
    assert.equal(warm.cachedFiles, 5);
    assert.equal(warm.scannedBytes, 0);
    const path = resolve(dir, 'child.jsonl');
    const event = JSON.stringify({
      type: 'token_usage_record',
      timestamp: '2026-10-09T07:00:00Z',
      payload: {
        thread_id: 'child',
        response_id: 'append',
        turn_id: 'turn-a',
        usage: { input_tokens: 20, output_tokens: 10, reasoning_output_tokens: 5 },
      },
    });
    const original = await readFile(path);
    await appendFile(path, event.slice(0, 80));
    const partial = await scan([dir], restored);
    assert.equal(partial.appendedFiles, 1);
    assert.ok(partial.scannedBytes <= 80 + 63);
    assert.equal(summarize(partial.records, {}).total, 2860);
    assert.ok(partial.gaps.some((g) => g.reason.includes('Malformed JSON')));
    await saveIndex(index, restored, cache);
    const resumed = await loadIndex(index);
    await appendFile(path, event.slice(80));
    const complete = await scan([dir], resumed);
    assert.equal(summarize(complete.records, {}).total, 2890);
    assert.equal(complete.gaps.length, 0);
    assert.ok(complete.scannedBytes <= event.length + 63);
    assert.equal(complete.records.find((r) => r.id === 'child:append')?.effort, 'high');
    await appendFile(path, '\n');
    const newline = await scan([dir], resumed);
    assert.equal(summarize(newline.records, {}).total, 2890);
    assert.equal(
      newline.sources.find((s) => s.path === path)?.sha256,
      createHash('sha256')
        .update(await readFile(path))
        .digest('hex'),
    );
    await writeFile(path, original); // truncation rebuild
    assert.equal((await scan([dir], resumed)).reindexedFiles, 1);
    await rename(path, path + '.old');
    await writeFile(path, original); // inode replacement rebuild
    assert.equal((await scan([dir], resumed)).reindexedFiles, 1);
    const altered = Buffer.from(original);
    altered[altered.indexOf('workshop')] = 88;
    await writeFile(path, altered); // same-size mutation rebuild
    assert.equal((await scan([dir], resumed)).reindexedFiles, 1);
    for (const file of await readdir(index)) {
      const bytes = await readFile(resolve(index, file));
      const text = file.endsWith('.gz') ? gunzipSync(bytes).toString() : bytes.toString();
      assert.ok(!text.includes('PRIVATE_PROMPT_SENTINEL'));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(index, { recursive: true, force: true });
  }
});
void test('resumable source SHA-256 matches native hashing across block and restart boundaries', () => {
  for (const size of [0, 1, 55, 56, 63, 64, 65, 4097, 100000]) {
    const bytes = randomBytes(size),
      hash = new AppendHash();
    const split = Math.floor(size / 2);
    hash.update(bytes.subarray(0, split));
    const saved = hash.state();
    const resumed = new AppendHash(saved);
    resumed.update(bytes.subarray(saved.bytes));
    assert.equal(resumed.hex(), createHash('sha256').update(bytes).digest('hex'));
    hash.update(bytes.subarray(split));
    assert.equal(hash.hex(), resumed.hex());
  }
});
void test('current official prices apply long-context rates and inconsistent snapshots explain exclusion', async () => {
  const dir = await fixture();
  try {
    const snapshot = await scan([dir]);
    const r = {
      ...snapshot.records[0],
      model: 'gpt-6.1-sol',
      tokens: { input: 300000, cached: 100000, write: 0, output: 1000, reasoning: 500 },
    };
    assert.equal(estimate(r, officialPrices), 0.835);
    assert.equal(estimate({ ...r, model: 'codex-auto-review' }, officialPrices), null);
    assert.equal(
      estimate({ ...r, model: 'gpt-5.4-mini', tokens: { ...r.tokens, write: 1 } }, officialPrices),
      null,
    );
    await appendFile(
      resolve(dir, 'legacy.jsonl'),
      JSON.stringify({
        type: 'event_msg',
        timestamp: '2026-10-09T07:00:00Z',
        payload: {
          type: 'token_count',
          info: { last_token_usage: { input_tokens: 0, output_tokens: 0, total_tokens: 19102 } },
        },
      }) + '\n',
    );
    const checked = await scan([dir]);
    assert.equal(summarize(checked.records, {}).total, 2860);
    assert.ok(
      checked.gaps.some(
        (g) =>
          g.reason.includes('Inconsistent token counters') &&
          g.example?.includes('0 + output 0 ≠ total 19102'),
      ),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

void test('auto-review toggle excludes dedicated sessions without hiding mixed-model work outside the date filter', async () => {
  const dir = await fixture();
  try {
    const { records } = await scan([dir]);
    const base = records[0];
    const review = {
      ...base,
      session: 'review-only',
      id: 'review-only',
      model: 'codex-auto-review',
    };
    const mixedReview = { ...review, session: 'mixed', id: 'mixed-review' };
    const mixedWork = {
      ...base,
      session: 'mixed',
      id: 'mixed-work',
      at: '2026-10-08T00:00:00.000Z',
    };
    const population = [...records, review, mixedReview, mixedWork];
    const filter = {
      ...all,
      from: '2026-10-09',
      model: 'codex-auto-review',
      ignoreAutoReview: true,
    };
    assert.deepEqual(
      selectRecords(population, filter).map((r) => r.id),
      ['mixed-review'],
    );
    assert.deepEqual(
      selectRecords(population, { ...filter, ignoreAutoReview: false }).map((r) => r.id),
      ['review-only', 'mixed-review'],
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

void test('report paths cannot reach source logs through symlinked input or output paths', async (t) => {
  const dir = await fixture();
  t.after(() => rm(dir, { recursive: true, force: true }));
  const logs = resolve(dir, 'logs');
  await mkdir(logs);
  const alias = resolve(dir, 'alias');
  await symlink(logs, alias);
  for (const [input, output] of [
    [logs, resolve(alias, 'report')],
    [alias, resolve(logs, 'report')],
  ]) {
    await assert.rejects(buildDashboard({ roots: [input], output }), /Output overlaps input/);
  }
  assert.deepEqual(await readdir(logs), []);
});
