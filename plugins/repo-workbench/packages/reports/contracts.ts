import { z } from 'zod';
const id = z.string().min(1).max(200);
const record = { event: id, revision: z.string().min(1).max(1000) };
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
export const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('snapshot') }).strict(),
  z.object({ action: z.literal('refresh') }).strict(),
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
      action: z.literal('capture'),
      question: z.string().trim().min(1).max(4000),
      session: id.optional(),
      selection: z.string().max(4000).default(''),
      filters: filtersSchema.optional(),
    })
    .strict(),
]);
export const inputSchema = z
  .object({
    contextId: z.string().uuid(),
    expectedRevision: z.number().int().nonnegative(),
    request: requestSchema,
  })
  .strict();
export type Request = z.infer<typeof requestSchema>;
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

import type { Snapshot } from '../usage/model.ts';
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
