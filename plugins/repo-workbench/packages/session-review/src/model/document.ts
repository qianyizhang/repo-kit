import { z } from 'zod';
import type { ReviewDocument } from './contracts.ts';

// Structural validation belongs with the document, not an HTTP or MCP envelope.
// Source identity and byte/hash checks remain the lazy reader's responsibility.
const label = z.string().max(16000),
  text = z.string().max(64 * 1024 * 1024);
const count = z.number().int().nonnegative(),
  number = z.number().finite();
const list = <T extends z.ZodType>(schema: T) => z.array(schema).max(200000);
const ref = z.object({
  thread: label,
  turn: label,
  event: label,
  role: label,
  roles: list(label).optional(),
});
const resolved = ref.extend({ key: label, roles: list(label) });
const actor = z.object({
  threadId: label,
  role: label,
  contribution: text.optional(),
  evidence: list(ref).optional(),
});
const assessment = z.object({
  criterion: label,
  subject: label,
  assessment: text,
  actor: label,
  basis: text,
  evidence: list(ref),
  note: text.optional(),
});
const media = z.object({ path: label, url: text, sha256: label, bytes: count });
const capture = media.extend({ subject: label, angle: label });
const source = z.object({
  name: label,
  path: label,
  sourceKey: label,
  subject: label.optional(),
  sha256: label,
  text,
  diff: z.object({ fromStage: count, text }).nullable(),
});
const artifact = z.object({
  id: label,
  subject: label,
  stageId: label,
  stageIndex: count,
  captures: list(capture),
  sources: list(source.omit({ text: true, diff: true })),
  producedBy: list(resolved),
  inspectedBy: list(resolved),
  provenance: z.object({
    sourcePairing: label,
    cameraKnown: z.boolean(),
    lightingKnown: z.boolean(),
  }),
  limits: list(text),
});
const threadRead = z.object({
  id: label,
  title: text,
  status: label,
  hasMore: z.boolean(),
  limited: z.boolean(),
  turns: list(
    z.object({
      id: label,
      status: label,
      request: text,
      response: text,
      final: z.boolean(),
      activities: count,
    }),
  ),
});
export const traceEventSchema = z.object({
  id: label,
  threadId: label,
  turnId: label,
  ordinal: count,
  role: label,
  status: label,
  paths: list(label),
  relatedThreads: list(label),
  sourceType: label.optional(),
  sourceTruncated: z.boolean(),
  kind: z.enum([
    'ask',
    'compaction',
    'wait',
    'request',
    'goal',
    'auto-review',
    'message',
    'command',
    'edit',
    'image',
    'reference',
    'delegation',
  ]),
  title: text,
  text,
  output: text.optional(),
  exitCode: z.number().int().nullable().optional(),
  durationMs: number.optional(),
  preview: text,
  displayTruncated: z.boolean(),
  key: label,
  sourcePath: label.optional(),
  sourceLine: count.optional(),
  timestamp: label.optional(),
  callId: label.optional(),
  parentCall: label.optional(),
  parallelCalls: count.optional(),
  sequentialCalls: count.optional(),
  questions: list(
    z.object({
      id: label,
      title: text,
      options: list(z.object({ label: text, description: text.optional() })),
    }),
  ).optional(),
  questionResult: z
    .object({
      delivered: z.boolean().optional(),
      answers: z.record(z.string(), list(text)).optional(),
    })
    .optional(),
  web: z
    .object({
      query: text,
      targets: list(text),
      results: list(z.object({ title: text, url: text, snippet: text })),
    })
    .optional(),
  compaction: z
    .object({
      window: number.optional(),
      startedAt: number.optional(),
      completedAt: number.optional(),
    })
    .optional(),
  threadRead: threadRead.optional(),
  imageUrls: list(text).optional(),
  messagePhase: z.enum(['commentary', 'final_answer']).optional(),
  body: z
    .object({
      sources: list(z.object({ offset: count, bytes: count, sha256: label })),
      textLength: count,
      outputLength: count.optional(),
      imageCount: count,
    })
    .optional(),
});
const omission = z.object({
  type: label,
  count,
  refs: list(ref.omit({ role: true, roles: true }).extend({ ordinal: count })),
});
export const traceThreadSchema = z.object({
  id: label,
  title: text,
  role: label,
  parent: label.optional(),
  purpose: z.literal('auto-review').optional(),
  source: z.object({
    encoding: z.literal('zstd').optional(),
    storedBytes: count.optional(),
    name: label,
    format: label,
    version: number,
    rawSchemaVersion: number,
    path: label.optional(),
    sha256: label.optional(),
    bytes: count.optional(),
    lines: count.optional(),
  }),
  coverage: z.object({
    totalItems: count,
    normalizedItems: count,
    unsupportedItems: list(omission),
    excludedItems: list(omission),
    truncatedItems: count,
    displayTruncatedItems: count,
  }),
  turns: list(
    z.object({
      id: label,
      threadId: label,
      startedAt: number.optional(),
      completedAt: number.optional(),
      elapsedMs: number.optional(),
      usage: z
        .object({
          inputTokens: number,
          outputTokens: number,
          cachedInputTokens: number,
          responses: number,
        })
        .optional(),
      events: list(traceEventSchema),
    }),
  ),
});
const episode = z
  .object({
    id: label,
    index: count,
    title: text,
    turn: label,
    threadId: label,
    anchorId: label,
    status: label.optional(),
    question: text.optional(),
    change: text.optional(),
    finding: text.optional(),
    lesson: text.optional(),
    comparison: text.optional(),
    subject: label.optional(),
    limits: list(text).optional(),
    quote: text,
    anchorRef: ref,
    captures: list(capture),
    sources: list(source),
    artifacts: list(label),
    evidence: list(resolved),
    actors: list(actor.extend({ evidence: list(resolved) })),
    assessments: list(
      assessment.extend({ id: label, artifactId: label, evidence: list(resolved) }),
    ),
    signals: list(z.object({ note: text, evidence: list(resolved) })),
    facts: z.object({
      commands: count,
      fileEdits: count,
      imageInspections: count,
      verificationCommands: count,
      changedFiles: list(label),
      relatedThreads: list(label),
    }),
  })
  .passthrough();
export const reviewDocumentSchema: z.ZodType<ReviewDocument> = z.object({
  version: z.union([z.literal(2), z.literal(3)]),
  title: text,
  subtitle: text.optional(),
  outcome: text.optional(),
  collectedAt: label,
  inputs: list(z.object({ threadId: label, sha256: label })),
  threads: list(traceThreadSchema),
  curation: z.object({ episodes: list(episode), artifacts: list(artifact) }).optional(),
  documents: list(z.object({ path: label, revision: label.optional(), text, sha256: label })),
  media: list(media),
  delivery: z.object({ kind: z.literal('local'), session: label }).optional(),
});
export const parseReviewDocument = (value: unknown) => reviewDocumentSchema.parse(value);
