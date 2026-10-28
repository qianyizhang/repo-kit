import { z } from 'zod';
import { parseDocument, parseChat, parseReply, parseComments } from './document.ts';

/** Existing semantic parsers remain authoritative for saved documents and source fidelity. */
function parsed<T>(parse: (value: unknown) => T) {
  return z.unknown().transform((value, ctx) => {
    try {
      return parse(value);
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        message: error instanceof Error ? error.message : String(error),
      });
      return z.NEVER;
    }
  });
}
export const documentSchema = parsed(parseDocument);
const chatSchema = parsed(parseChat);
const replySchema = parsed(parseReply);
const id = z.string().min(1).max(180);
const revision = z.string().max(100);
const empty = z.strictObject({});
export const draftSchema = z.object({
  document: documentSchema,
  revision,
  scope: id,
  selection: id.nullable(),
  selections: z.array(id).max(500).optional(),
});
export type Draft = z.output<typeof draftSchema>;
export const viewSchema = z.object({
  document: documentSchema,
  baseRevision: revision,
  scope: id,
  selections: z.array(id).max(500),
  panel: z.enum(['inspect', 'chat']).nullable(),
  navigation: z.boolean(),
  viewport: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    zoom: z.number().positive().max(10),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
  }),
  dirty: z.boolean(),
  conflict: z.boolean(),
});
export const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('focus'), target: id }),
  z.object({ action: z.literal('select'), targets: z.array(id).max(500) }),
  z.object({ action: z.enum(['fit', 'read', 'fit_selection']) }),
  z.object({ action: z.literal('panel'), panel: z.enum(['inspect', 'chat']).nullable() }),
  z.object({ action: z.literal('navigation'), open: z.boolean() }),
]);
export const queuedCommandSchema = z.object({
  id,
  expectedRevision: revision,
  command: commandSchema,
  status: z.enum(['pending', 'applied', 'rejected']),
  message: z.string().optional(),
});
export const proposalSchema = z.object({
  id,
  baseDocument: documentSchema,
  document: documentSchema,
  explanation: z.string(),
});
export const inboxSchema = z.object({
  command: queuedCommandSchema.nullable(),
  proposal: proposalSchema.nullable(),
});
export const exchangeSchema = z.object({
  id,
  canvasId: id,
  context: chatSchema,
  status: z.enum(['pending', 'answered', 'cancelled']),
  response: replySchema.nullable(),
});
const snapshotSchema = z.object({
  document: documentSchema,
  revision,
  repo: z.string(),
  saved: z.boolean(),
  problem: z.string().optional(),
});
export const sessionSchema = snapshotSchema.extend({ token: z.string(), plugin: z.string() });
export type Session = z.output<typeof sessionSchema>;
export const repositorySchema = z.object({
  id: z.string(),
  path: z.string(),
  name: z.string(),
  available: z.boolean(),
});
export type RegisteredRepository = z.output<typeof repositorySchema>;
export const serverInfoSchema = z.object({
  version: z.string(),
  build: z.string(),
  serverId: z.string(),
  pid: z.number().int(),
  startedAt: z.string(),
  file: z.string().nullable(),
  fileError: z.string().nullable(),
  events: z
    .array(
      z.object({
        time: z.string(),
        event: z.string(),
        repo: z.string().optional(),
        contextId: z.string().optional(),
        threadId: z.string().optional(),
        metadataKeys: z.array(z.string()).optional(),
        error: z.string().optional(),
        panelId: z.string().optional(),
        reason: z.string().optional(),
      }),
    )
    .max(200),
});
export type ServerInfo = z.output<typeof serverInfoSchema>;
export const targetSchema = z.object({ contextId: z.string(), repo: z.string() });
const connectionSchema = z.object({
  target: targetSchema.nullable(),
  server: serverInfoSchema,
  threadId: z.string().nullable(),
  binding: z.string(),
  reason: z.enum(['workspace-unavailable', 'missing-chat-metadata']).nullable().optional(),
});
export type ConnectionState = z.output<typeof connectionSchema>;
export const commentsSchema = parsed(parseComments);
export const discussionSchema = z.object({
  revision: z.number().int(),
  composer: z.string().max(12000),
  comments: commentsSchema,
  history: z.array(exchangeSchema).max(100),
});
const chatFields = {
  comments: commentsSchema.optional(),
  document: documentSchema,
  scope: id,
  selection: id.nullable(),
  selections: z.array(id).max(500).optional(),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string() })).max(30),
};

/** A single operation catalogue for both transports and their callers. */
export const contracts = {
  state: {
    input: empty,
    output: z.union([sessionSchema, z.object({ needsRepository: z.literal(true) })]),
  },
  source: {
    input: z.strictObject({ path: z.string().min(1).max(550) }),
    output: z.object({
      path: z.string(),
      reference: z.string(),
      content: z.string(),
      truncated: z.boolean(),
      startLine: z.number(),
      endLine: z.number(),
      totalLines: z.number(),
      revision,
    }),
  },
  source_save: {
    input: z.strictObject({
      reference: z.string().max(550),
      revision,
      content: z.string().max(40000),
      document: documentSchema,
    }),
    output: z.object({ revision, reference: z.string() }),
  },
  discussion_read: { input: empty, output: discussionSchema },
  discussion_write: {
    input: z.strictObject({
      revision: z.number().int(),
      composer: z.string().max(12000),
      comments: commentsSchema,
    }),
    output: discussionSchema,
  },
  discussion_clear: {
    input: z.strictObject({ revision: z.number().int() }),
    output: discussionSchema,
  },
  save: { input: z.strictObject({ document: documentSchema, revision }), output: snapshotSchema },
  send: { input: z.strictObject({ canvasId: id, ...chatFields }), output: exchangeSchema },
  chat: { input: z.strictObject({ canvasId: id }), output: exchangeSchema.nullable() },
  cancel: { input: z.strictObject({ canvasId: id, id }), output: exchangeSchema },
  draft_read: { input: empty, output: draftSchema.nullable() },
  draft_write: {
    input: z.strictObject({ draft: draftSchema.nullable() }),
    output: z.object({ stored: z.boolean() }),
  },
  view_touch: { input: z.strictObject({ revision }), output: z.object({ revision }) },
  view_write: { input: z.strictObject({ view: viewSchema }), output: z.object({ revision }) },
  agent_read: { input: empty, output: inboxSchema },
  command_ack: {
    input: z.strictObject({
      id,
      status: z.enum(['applied', 'rejected']),
      message: z.string().max(1000).optional(),
    }),
    output: queuedCommandSchema,
  },
  proposal_dismiss: { input: z.strictObject({ id }), output: z.object({ dismissed: z.boolean() }) },
  connect: {
    input: z.strictObject({ panelId: z.string().uuid(), repo: z.string().optional() }),
    output: connectionSchema,
  },
  catalog: { input: empty, output: z.array(repositorySchema) },
  remember: { input: empty, output: z.null() },
  diagnostics: { input: empty, output: serverInfoSchema },
} as const;
export type Action = keyof typeof contracts;
export type Input<K extends Action> = z.output<(typeof contracts)[K]['input']>;
export type Output<K extends Action> = z.output<(typeof contracts)[K]['output']>;
export type Arguments<K extends Action> =
  Record<string, never> extends Input<K> ? [args?: Input<K>] : [args: Input<K>];
type AppRequestSchema = {
  [K in Action]: z.ZodObject<{ action: z.ZodLiteral<K>; args: (typeof contracts)[K]['input'] }>;
}[Action];
export const appRequestSchema = z.discriminatedUnion(
  'action',
  // Object.entries erases key/value correlation; each entry keeps its own input schema.
  Object.entries(contracts).map(([action, contract]) =>
    z.object({ action: z.literal(action), args: contract.input }),
  ) as [AppRequestSchema, ...AppRequestSchema[]],
);
export function parseOutput<K extends Action>(action: K, value: unknown): Output<K> {
  // Indexed access loses correlation in TS; the schema selected by action owns the result type.
  return contracts[action].output.parse(value) as Output<K>;
}
