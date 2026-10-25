import { exportFileMap } from '../file-map/index.ts';
import { ReportSession } from './session.ts';
import { RuntimeError } from '../../../mcp-app-runtime/src/definition.ts';
import { ScopedRegistry, hostedPrincipal } from '../../../mcp-app-runtime/src/registry.ts';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ObservableServer } from '../diagnostics/server.ts';
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { isAbsolute } from 'node:path';
import { gzipSync } from 'node:zlib';
import { z } from 'zod';
import { asset } from '../runtime/assets.ts';
import { defaultRoots } from '../usage/scan.ts';
import { BUILD, VERSION } from '../repo-canvas/src/model/build.ts';
import { inputSchema, backgroundActions, bindingSchema } from './contracts.ts';
import { ReportSelections, selectionInput, pageInput } from './selections.ts';

const uri = `ui://repo-workbench/reports-${BUILD}.html`;
const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const rootsSchema = z
  .array(z.string().refine(isAbsolute, 'Use absolute source paths'))
  .min(1)
  .max(20)
  .optional();
function privateResult(value: unknown) {
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json) > 128 * 1024 * 1024)
    throw new Error('Report exceeds panel limit. Open a smaller log root.');
  const payload = gzipSync(json).toString('base64');
  if (payload.length > 24 * 1024 * 1024)
    throw new Error('Compressed report exceeds panel limit. Select a smaller log root.');
  return { content: [], _meta: { build: BUILD, payload } };
}
export function reportsMcp() {
  const server = new ObservableServer('workbench-reports', {
    name: 'repo-workbench-reports',
    version: VERSION,
    build: BUILD,
  });
  const selections = new ReportSelections();
  const guarded =
    <T>(
      fn: (
        args: T,
        extra: { _meta?: Record<string, unknown> },
      ) => Promise<CallToolResult> | CallToolResult,
    ) =>
    async (args: T, extra: { _meta?: Record<string, unknown> }) => {
      try {
        return await fn(args, extra);
      } catch (error) {
        if (error instanceof RuntimeError) throw error;
        return {
          isError: true,
          content: [
            { type: 'text' as const, text: error instanceof Error ? error.message : String(error) },
          ],
        };
      }
    };
  type Caller = { _meta?: Record<string, unknown> };
  const contexts = new ScopedRegistry<ReportSession>(
    { maxEntries: 12, maxBytes: 512 * 1024 * 1024, maxAgeMs: 24 * 3600_000, overflow: 'evict' },
    (value) => value.dispose(),
  );
  server.server.onclose = () => {
    contexts.close();
    selections.dispose();
  };
  async function open(
    kind: 'usage' | 'trace',
    roots: string[] = defaultRoots(),
    session: string | undefined,
    extra: Caller,
  ) {
    const owner = hostedPrincipal(extra._meta);
    if (kind === 'trace' && !session) throw new Error('Provide a session ID to open a trace.');
    const context = new ReportSession({ roots, kind, session }, selections.forOwner(owner), {
      account: (bytes) => contexts.update(context.binding.contextId, owner, context, bytes),
    });
    let registered = false;
    try {
      contexts.create(owner, context, context.retainedBytes, context.binding.contextId);
      registered = true;
      if (kind === 'trace') await context.initializeTrace();
    } catch (error) {
      if (registered) {
        try {
          contexts.release(context.binding.contextId, owner);
        } catch {
          context.dispose();
        }
      } else context.dispose();
      throw error;
    }
    return {
      content: [
        {
          type: 'text' as const,
          text: `${kind === 'usage' ? 'Usage dashboard' : 'Trace analyzer'} opened. Sources are read-only; usage is recorded telemetry, not billing.`,
        },
      ],
      structuredContent: context.binding,
    };
  }
  for (const kind of ['usage', 'trace'] as const) {
    registerAppTool(
      server,
      `${kind}_open`,
      {
        title: kind === 'usage' ? 'Usage dashboard' : 'Trace analyzer',
        description:
          kind === 'usage'
            ? 'Open local Codex usage in an MCP App. Optional absolute log roots; defaults to Codex sessions and archived sessions.'
            : 'Open a recorded Codex session and indexed child sessions in an MCP App. Requires a session ID; optional absolute log roots.',
        inputSchema: { roots: rootsSchema, session: z.string().min(1).max(200).optional() },
        outputSchema: bindingSchema.shape,
        annotations,
        _meta: {
          ui: { resourceUri: uri },
          ...(kind === 'usage' ? { 'openai/ui': { entrypoints: [{ type: 'thread' }] } } : {}),
        },
      },
      guarded(async (args: { roots?: string[]; session?: string }, extra) =>
        open(kind, args.roots, args.session, extra),
      ),
    );
  }
  registerAppResource(server, 'reports', uri, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [
      {
        uri,
        mimeType: RESOURCE_MIME_TYPE,
        text: await asset('reports.html'),
        _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true } },
      },
    ],
  }));
  registerAppTool(
    server,
    'report_app',
    {
      description:
        'Read or refresh one report context, load pinned record bodies, or freeze an explicit discussion selection. Never writes source logs.',
      inputSchema: inputSchema.shape,
      annotations,
      _meta: { ui: { visibility: ['app'] }, 'repo-kit/background-actions': backgroundActions },
    },
    guarded(async (input: z.infer<typeof inputSchema>, extra) => {
      const { contextId, expectedRevision, request } = inputSchema.parse(input);
      const c = contexts.resolve(contextId, hostedPrincipal(extra._meta));
      const result = await c.execute(request, expectedRevision, privateResult);
      contexts.update(contextId, hostedPrincipal(extra._meta), c, c.retainedBytes);
      return result;
    }),
  );
  const result = (value: unknown) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  });
  server.registerTool(
    'file_map',
    {
      title: 'Repository file map',
      description:
        'Export an offline Git-index file map for an explicit repository. Reads index/object metadata, not working file bodies; untracked and ignored files excluded. Writes one fresh temporary bundle and returns paths/counts, not the full inventory. Optional reviews file contains author judgments pinned to indexed identities. No source mutations or cleanup.',
      inputSchema: {
        repo: z.string().refine(isAbsolute, 'Use an absolute repository path'),
        reviews: z.string().refine(isAbsolute, 'Use an absolute reviews path').optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    guarded(async (args: { repo: string; reviews?: string }) => result(await exportFileMap(args))),
  );
  server.registerTool(
    'usage_summary',
    {
      description:
        'Read token totals and filters for one explicitly attached frozen usage selection. No source metadata or transcript. Use only when the message summary is insufficient.',
      inputSchema: selectionInput,
      annotations,
    },
    guarded(({ selectionId }: { selectionId: string }, extra) =>
      result(selections.forOwner(hostedPrincipal(extra._meta)).usageSummary(selectionId)),
    ),
  );
  server.registerTool(
    'usage_records',
    {
      description:
        'Page exact token-usage entries from an attached usage selection. These are accounting entries, not messages or tool calls. No provenance. Maximum 20 entries per page.',
      inputSchema: pageInput,
      annotations,
    },
    guarded(
      (
        { selectionId, offset, limit }: { selectionId: string; offset: number; limit: number },
        extra,
      ) =>
        result(
          selections
            .forOwner(hostedPrincipal(extra._meta))
            .usageRecords(selectionId, offset, limit),
        ),
    ),
  );
  server.registerTool(
    'trace_events',
    {
      description:
        'Page short action/message previews within an explicitly attached frozen turn or action. No source paths or hashes. Maximum 20 events per page.',
      inputSchema: pageInput,
      annotations,
    },
    guarded(
      (
        { selectionId, offset, limit }: { selectionId: string; offset: number; limit: number },
        extra,
      ) =>
        result(
          selections.forOwner(hostedPrincipal(extra._meta)).traceEvents(selectionId, offset, limit),
        ),
    ),
  );
  server.registerTool(
    'trace_event_text',
    {
      description:
        'Read one field of one event inside an attached trace selection. Returns a bounded text chunk and nextOffset; source bytes must still match the frozen revision.',
      inputSchema: {
        ...selectionInput,
        eventId: z.string().min(1).max(200),
        field: z.enum(['text', 'output']),
        offset: z.number().int().nonnegative().default(0),
      },
      annotations,
    },
    guarded(
      async (
        {
          selectionId,
          eventId,
          field,
          offset,
        }: {
          selectionId: string;
          eventId: string;
          field: 'text' | 'output';
          offset: number;
        },
        extra,
      ) =>
        result(
          await selections
            .forOwner(hostedPrincipal(extra._meta))
            .traceText(selectionId, eventId, field, offset),
        ),
    ),
  );
  server.registerTool(
    'report_provenance',
    {
      description:
        'Inspect source identity and coverage only when provenance is needed. Requires an explicitly attached selection. Pages at most 20 contributing sources; does not read source bodies.',
      inputSchema: pageInput,
      annotations,
    },
    guarded(
      (
        { selectionId, offset, limit }: { selectionId: string; offset: number; limit: number },
        extra,
      ) =>
        result(
          selections.forOwner(hostedPrincipal(extra._meta)).provenance(selectionId, offset, limit),
        ),
    ),
  );
  return server;
}
