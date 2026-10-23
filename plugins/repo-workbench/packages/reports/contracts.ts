import { z } from 'zod';
const id = z.string().min(1).max(200);
const record = { event: id, revision: z.string().min(1).max(1000) };
export const timezoneSchema = z.enum(['Asia/Shanghai', 'UTC']);
const timezone = timezoneSchema.default('Asia/Shanghai');
export const filtersSchema = z
  .object({
    from: z.string().max(10),
    to: z.string().max(10),
    model: z.string().max(200),
    project: z.string().max(4000),
    effort: z.string().max(200),
    search: z.string().max(2000),
    timezone: z.string().max(100),
    ignoreAutoReview: z.boolean().optional(),
  })
  .strict();
export const traceScopeSchema = z
  .object({ thread: id, turn: id, event: id.optional(), reviews: z.boolean().default(false) })
  .strict();
export const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('snapshot'), timezone }).strict(),
  z.object({ action: z.literal('status') }).strict(),
  z.object({ action: z.literal('refresh'), timezone }).strict(),
  z
    .object({
      action: z.literal('evidence'),
      timezone,
      ids: z
        .array(z.string().regex(/^[a-f0-9]{64}$/))
        .min(1)
        .max(20000),
    })
    .strict(),
  z.object({ action: z.literal('export'), filters: filtersSchema }).strict(),
  z.object({ action: z.literal('trace'), session: id }).strict(),
  z
    .object({
      action: z.literal('text'),
      session: id,
      ...record,
      field: z.enum(['text', 'output']),
      offset: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      action: z.literal('image'),
      session: id,
      ...record,
      index: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      action: z.literal('select_usage'),
      filters: filtersSchema,
      ids: z
        .array(z.string().regex(/^[a-f0-9]{64}$/))
        .min(1)
        .max(20000)
        .optional(),
    })
    .strict(),
  z.object({ action: z.literal('select_trace'), session: id, scope: traceScopeSchema }).strict(),
]);
export const inputSchema = z
  .object({
    contextId: z.string().uuid(),
    expectedRevision: z.number().int().nonnegative(),
    request: requestSchema,
  })
  .strict();
export type Request = z.input<typeof requestSchema>;
export const bindingSchema = z.object({
  contextId: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  kind: z.enum(['usage', 'trace']),
  session: id.optional(),
  build: z.string(),
});
export type Binding = z.infer<typeof bindingSchema>;
export const payloadSchema = z.object({
  payload: z.string().max(24 * 1024 * 1024),
  build: z.string(),
});
export const textSchema = z.object({
  text: z.string(),
  offset: z.number().int(),
  nextOffset: z.number().int(),
  total: z.number().int(),
});

import type { Snapshot, UsageOverview } from '../usage/model.ts';
import type { ReviewDocument } from '../session-review/src/model/contracts.ts';
// The existing report formats own their data; validate their structural version at this adapter.
export const snapshotSchema = z.custom<Snapshot>((v) => {
  const s = v as Partial<Snapshot> | null;
  return (
    !!s &&
    s.schemaVersion === 1 &&
    typeof s.generatedAt === 'string' &&
    Array.isArray(s.records) &&
    Array.isArray(s.sources) &&
    Array.isArray(s.gaps)
  );
}, 'Invalid usage snapshot');
const count = z.number().finite().nonnegative();
export const overviewSchema: z.ZodType<UsageOverview> = z.object({
  schemaVersion: z.literal(1),
  overviewVersion: z.literal(1),
  timezone: timezoneSchema,
  generatedAt: z.string().datetime(),
  roots: z.array(z.string()),
  sources: z.array(
    z.object({
      path: z.string(),
      session: z.string(),
      parent: z.string(),
      createdAt: z.string(),
      bytes: count,
      sha256: z.string(),
      lines: count,
      records: count,
      encoding: z.literal('zstd').optional(),
      storedBytes: count.optional(),
      forkedFrom: z.string().optional(),
      historyBase: z.string().optional(),
    }),
  ),
  gaps: z.array(
    z.object({
      source: z.string(),
      line: count.optional(),
      reason: z.string(),
      count,
      example: z.string().optional(),
    }),
  ),
  duplicates: count,
  inherited: count,
  cachedFiles: count,
  appendedFiles: count,
  reindexedFiles: count,
  scannedBytes: count,
  records: z.array(
    z.object({
      id: z.string().regex(/^[a-f0-9]{64}$/),
      session: z.string(),
      parent: z.string(),
      at: z.string().datetime(),
      lastAt: z.string().datetime(),
      model: z.string(),
      effort: z.string(),
      project: z.string(),
      source: z.string(),
      tokens: z.object({
        input: count,
        cached: count,
        write: count,
        output: count,
        reasoning: count,
      }),
      events: count.int().positive(),
      missingReasoning: count.int(),
      longContext: z.boolean(),
    }),
  ),
});
export const statusSchema = z.object({
  refreshing: z.boolean(),
  updated: z.boolean(),
  error: z.string().optional(),
  timings: z.record(z.string(), count).optional(),
});
export const recordsSchema = z.array(
  z.object({
    id: z.string(),
    session: z.string(),
    parent: z.string(),
    at: z.string().datetime(),
    model: z.string(),
    effort: z.string(),
    project: z.string(),
    source: z.string(),
    line: count.int(),
    method: z.enum(['response', 'snapshot', 'delta']),
    reasoningReported: z.boolean().optional(),
    tokens: z.object({
      input: count,
      cached: count,
      write: count,
      output: count,
      reasoning: count,
    }),
  }),
);
export const documentSchema = z.custom<ReviewDocument>((v) => {
  const d = v as Partial<ReviewDocument> | null;
  return (
    !!d &&
    d.version === 3 &&
    typeof d.title === 'string' &&
    Array.isArray(d.threads) &&
    d.threads.every((t) => typeof t.id === 'string' && Array.isArray(t.turns))
  );
}, 'Invalid trace document');
