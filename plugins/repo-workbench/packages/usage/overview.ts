import { createHash } from 'node:crypto';
import {
  dateKey,
  emptyTokens,
  type Snapshot,
  type UsageBucket,
  type UsageOverview,
  type UsageRecord,
} from './model.ts';

export function bucketId(record: UsageRecord, timezone: string): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        timezone,
        dateKey(record.at, timezone),
        record.session,
        record.parent,
        record.model,
        record.effort,
        record.project,
        record.source,
        record.tokens.input > 272_000,
        record.tokens.write > 0,
      ]),
    )
    .digest('hex');
}

export function overview(snapshot: Snapshot, timezone: string): UsageOverview {
  const buckets = new Map<string, UsageBucket>();
  for (const record of snapshot.records) {
    const id = bucketId(record, timezone);
    let bucket = buckets.get(id);
    if (!bucket) {
      bucket = {
        id,
        session: record.session,
        parent: record.parent,
        at: record.at,
        lastAt: record.at,
        model: record.model,
        effort: record.effort,
        project: record.project,
        source: record.source,
        tokens: emptyTokens(),
        events: 0,
        missingReasoning: 0,
        longContext: record.tokens.input > 272_000,
      };
      buckets.set(id, bucket);
    }
    bucket.events++;
    bucket.missingReasoning += Number(
      record.reasoningReported === false && record.tokens.output > 0,
    );
    if (record.at < bucket.at) bucket.at = record.at;
    if (record.at > bucket.lastAt) bucket.lastAt = record.at;
    for (const key of Object.keys(bucket.tokens) as (keyof UsageBucket['tokens'])[])
      bucket.tokens[key] += record.tokens[key];
  }
  return {
    ...snapshot,
    overviewVersion: 1,
    timezone,
    records: [...buckets.values()].sort((a, b) => a.at.localeCompare(b.at)),
  };
}

export function evidenceRecords(
  snapshot: Snapshot,
  timezone: string,
  ids: string[],
): UsageRecord[] {
  const selected = new Set(ids);
  // The dashboard's summaries contain complete counts; only the latest 100 source records are delivered.
  const rows: UsageRecord[] = [];
  for (let i = snapshot.records.length - 1; i >= 0 && rows.length < 100; i--) {
    const record = snapshot.records[i];
    if (selected.has(bucketId(record, timezone))) rows.push(record);
  }
  return rows;
}
