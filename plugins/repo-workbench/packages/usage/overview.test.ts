import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overview, evidenceRecords } from './overview.ts';
import {
  selectRecords,
  summarize,
  type Snapshot,
  type UsageRecord,
  type UsageRow,
} from './model.ts';

function fixture(): Snapshot {
  const records: UsageRecord[] = Array.from({ length: 1200 }, (_, i) => ({
    id: String(i),
    session: i % 7 === 0 ? 'auto' : 'session',
    parent: '',
    at: `2026-10-22T${i < 600 ? '15' : '17'}:30:00.000Z`,
    model: i % 7 === 0 ? 'codex-auto-review' : 'model',
    effort: 'high',
    project: '/repo',
    source: '/logs/session.jsonl',
    line: i + 1,
    method: 'response',
    reasoningReported: i % 3 !== 0,
    tokens: {
      input: i % 2 ? 300000 : 1000,
      cached: 500,
      write: i % 5 ? 0 : 100,
      output: 100,
      reasoning: i % 3 ? 40 : 0,
    },
  }));
  return {
    schemaVersion: 1,
    generatedAt: '2026-10-23T00:00:00.000Z',
    roots: ['/logs'],
    sources: [],
    gaps: [],
    records,
    duplicates: 0,
    inherited: 0,
    cachedFiles: 0,
    appendedFiles: 0,
    reindexedFiles: 0,
    scannedBytes: 0,
  };
}
void test('overview retains exact filtered totals, event counts and pricing bands across time zones', () => {
  const snapshot = fixture();
  for (const timezone of ['UTC', 'Asia/Shanghai']) {
    const summary = overview(snapshot, timezone);
    assert.ok(summary.records.length < snapshot.records.length / 20);
    assert.ok(summary.records.every((r) => !('line' in r) && !('method' in r)));
    for (const from of ['', '2026-10-23'])
      for (const ignoreAutoReview of [true, false])
        for (const longContext of [true, false])
          for (const writeUnpublished of [true, false]) {
            const filters = {
              from,
              to: '',
              timezone,
              model: '',
              effort: '',
              project: '',
              search: '',
              ignoreAutoReview,
            };
            const prices = {
              model: { input: 2, cached: 0.2, write: 4, output: 8, longContext, writeUnpublished },
            };
            const exact = summarize(selectRecords(snapshot.records, filters), prices);
            const compact = summarize(selectRecords<UsageRow>(summary.records, filters), prices);
            assert.ok(Math.abs(exact.knownCost - compact.knownCost) < 1e-8);
            assert.deepEqual({ ...compact, knownCost: 0 }, { ...exact, knownCost: 0 });
          }
  }
});
void test('evidence loads at most 100 exact source records for selected summary buckets', () => {
  const snapshot = fixture(),
    summary = overview(snapshot, 'Asia/Shanghai');
  const selected = summary.records.filter(
    (r) => r.session === 'session' && r.at.startsWith('2026-10-22T17'),
  );
  const records = evidenceRecords(
    snapshot,
    'Asia/Shanghai',
    selected.map((r) => r.id),
  );
  assert.equal(records.length, 100);
  assert.ok(
    records.every(
      (r) =>
        r.session === 'session' && r.at.startsWith('2026-10-22T17') && snapshot.records.includes(r),
    ),
  );
  assert.deepEqual(
    evidenceRecords(
      snapshot,
      'UTC',
      selected.map((r) => r.id),
    ),
    [],
  );
});
