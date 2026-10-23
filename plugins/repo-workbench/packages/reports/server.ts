import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { randomUUID } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { gzipSync } from 'node:zlib';
import { z } from 'zod';
import { asset } from '../runtime/assets.ts';
import { defaultRoots, usageIndexPath } from '../usage/scan.ts';
import { selectRecords, type Snapshot, type UsageOverview } from '../usage/model.ts';
import { evidenceRecords } from '../usage/overview.ts';
import { loadOverview, scanHistory, type HistoryResult } from './history.ts';
import { createTraceReader, readRecord, textBlock } from '../usage/trace-service.ts';
import type { ReviewDocument } from '../session-review/src/model/contracts.ts';
import { BUILD, VERSION } from '../repo-canvas/src/model/build.ts';
import { inputSchema, type Binding } from './contracts.ts';
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
  const server = new McpServer({ name: 'repo-workbench-reports', version: VERSION });
  type Context = {
    binding: Binding;
    roots: string[];
    snapshot?: Snapshot;
    overviews: Map<string, UsageOverview>;
    pending?: HistoryResult;
    refreshing: boolean;
    error?: string;
    timings?: Record<string, number>;
    traces: Map<string, ReviewDocument>;
    reader: ReturnType<typeof createTraceReader>;
    busy: boolean;
    ready: Promise<void>;
    index: string;
  };
  const contexts = new Map<string, Context>();
  const jobs = new Map<string, ReturnType<typeof scanHistory>>();
  server.server.onclose = () => {
    for (const job of jobs.values()) void job.stop();
  };
  function startScan(context: Context) {
    let job = jobs.get(context.index);
    if (!job) {
      job = scanHistory(context.roots);
      jobs.set(context.index, job);
      const current = job;
      void job.promise
        .finally(() => {
          if (jobs.get(context.index) === current) jobs.delete(context.index);
        })
        .catch(() => {});
    }
    context.refreshing = true;
    context.error = undefined;
    context.ready = job.promise
      .then((result) => {
        context.pending = result;
        context.timings = result.timings;
      })
      .catch((error: unknown) => {
        context.error = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        context.refreshing = false;
      });
  }
  function adopt(context: Context) {
    if (!context.pending)
      throw new Error(context.error ?? 'History is still refreshing. Try again shortly.');
    context.snapshot = context.pending.snapshot;
    context.overviews = new Map(context.pending.overviews.map((o) => [o.timezone, o]));
    context.pending = undefined;
    context.traces.clear();
  }
  const selections = new ReportSelections();
  const guarded =
    <T>(fn: (args: T) => Promise<CallToolResult> | CallToolResult) =>
    async (args: T) => {
      try {
        return await fn(args);
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: 'text' as const, text: error instanceof Error ? error.message : String(error) },
          ],
        };
      }
    };
  async function open(kind: 'usage' | 'trace', roots: string[] = defaultRoots(), session?: string) {
    if (kind === 'trace' && !session) throw new Error('Provide a session ID to open a trace.');
    const index = usageIndexPath(roots);
    const binding: Binding = { contextId: randomUUID(), revision: 0, kind, session, build: BUILD };
    const context: Context = {
      binding,
      roots,
      overviews: new Map(),
      refreshing: false,
      ready: Promise.resolve(),
      index,
      traces: new Map(),
      reader: undefined!,
      busy: false,
    };
    context.reader = createTraceReader(() => {
      if (!context.snapshot)
        throw new Error('Cached summary shown. History is still refreshing; try again shortly.');
      return context.snapshot;
    });
    startScan(context);
    if (kind === 'trace') {
      await context.ready;
      adopt(context);
      const trace = await context.reader(session!);
      if (!trace) throw new Error('Session is not in these log roots.');
      context.traces.set(session!, trace.data);
    }
    // Contexts are bounded. Existing panels get an explicit expired-context error.
    if (contexts.size >= 12) contexts.delete(contexts.keys().next().value!);
    contexts.set(binding.contextId, context);
    return {
      content: [
        {
          type: 'text' as const,
          text: `${kind === 'usage' ? 'Usage dashboard' : 'Trace analyzer'} opened. Sources are read-only; usage is recorded telemetry, not billing.`,
        },
      ],
      structuredContent: binding,
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
        annotations,
        _meta: {
          ui: { resourceUri: uri },
          ...(kind === 'usage' ? { 'openai/ui': { entrypoints: [{ type: 'thread' }] } } : {}),
        },
      },
      guarded(async (args: { roots?: string[]; session?: string }) =>
        open(kind, args.roots, args.session),
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
      _meta: { ui: { visibility: ['app'] } },
    },
    guarded(async (input: z.infer<typeof inputSchema>) => {
      const { contextId, expectedRevision, request } = inputSchema.parse(input);
      const c = contexts.get(contextId);
      if (!c) throw new Error('Report context expired. Reopen the report.');
      if (expectedRevision !== c.binding.revision)
        throw new Error('Report changed. Reopen or refresh the panel.');
      if (request.action === 'status')
        return privateResult({
          refreshing: c.refreshing,
          updated: !!c.pending,
          error: c.error,
          timings: c.timings,
        });
      if (c.busy) throw new Error('Report operation in progress. Try again after it finishes.');
      const exclusive = ['refresh', 'trace', 'select_usage', 'select_trace'].includes(
        request.action,
      );
      if (exclusive) c.busy = true;
      try {
        if (request.action === 'refresh') {
          if (!c.pending && !c.refreshing) startScan(c);
          await c.ready;
          if (!c.pending) throw new Error(c.error ?? 'History is still refreshing.');
          const binding = { ...c.binding, revision: c.binding.revision + 1 };
          // A failed delivery-size check must leave the displayed revision usable.
          const result = privateResult({
            binding,
            snapshot: c.pending.overviews.find((o) => o.timezone === request.timezone),
            refreshing: false,
            timings: c.timings,
          });
          adopt(c);
          c.binding = binding;
          return result;
        }
        if (request.action === 'snapshot') {
          if (!c.snapshot && !c.overviews.has(request.timezone)) {
            const cached = await loadOverview(c.index, request.timezone);
            if (cached && JSON.stringify(cached.roots) === JSON.stringify(c.roots))
              c.overviews.set(request.timezone, cached);
          }
          if (!c.overviews.has(request.timezone)) {
            if (c.overviews.size)
              throw new Error(
                'This time zone is not cached. Refresh logs before switching time zone.',
              );
            await c.ready;
            adopt(c);
          }
          return privateResult({
            binding: c.binding,
            snapshot: c.overviews.get(request.timezone),
            refreshing: !c.snapshot,
            timings: c.timings,
            document: c.binding.session ? c.traces.get(c.binding.session) : undefined,
          });
        }
        if (request.action === 'evidence' || request.action === 'export') {
          if (!c.snapshot)
            throw new Error(
              'Cached summary shown. History is still refreshing; try again shortly.',
            );
          if (request.action === 'evidence') {
            const ids = new Set(c.overviews.get(request.timezone)?.records.map((row) => row.id));
            if (request.ids.some((id) => !ids.has(id)))
              throw new Error('Evidence selection changed. Reopen it from the current summary.');
          }
          return privateResult({
            records:
              request.action === 'evidence'
                ? evidenceRecords(c.snapshot, request.timezone, request.ids)
                : selectRecords(c.snapshot.records, request.filters),
          });
        }
        if (request.action === 'trace') {
          const trace = await c.reader(request.session);
          if (!trace) throw new Error('Session is not in this report. Refresh logs first.');
          const result = privateResult({ document: trace.data });
          if (c.traces.size >= 8) c.traces.delete(c.traces.keys().next().value!);
          c.traces.set(request.session, trace.data);
          return result;
        }
        if (request.action === 'text' || request.action === 'image') {
          const data = c.traces.get(request.session);
          if (!data) throw new Error('Trace expired. Reopen it from the dashboard.');
          const body = await readRecord(data, request.event, request.revision);
          if (request.action === 'text')
            return privateResult(
              textBlock(
                request.field === 'output' ? (body.output ?? '') : body.text,
                request.offset,
              ),
            );
          const image = body.imageUrls[request.index];
          if (
            !image ||
            !/^data:image\/(png|jpeg|webp|gif);base64,/.test(image) ||
            image.length > 12 * 1024 * 1024
          )
            throw new Error('Image unavailable or too large for this panel.');
          return privateResult({ image });
        }
        if (request.action === 'select_usage') {
          const snapshot = c.snapshot ?? c.overviews.get(request.filters.timezone);
          if (!snapshot)
            throw new Error('Wait for this time zone to load before attaching context.');
          return privateResult(selections.usage(snapshot, request.filters, request.ids));
        }
        const document = c.traces.get(request.session);
        if (!document) throw new Error('Open the trace before attaching context.');
        return privateResult(selections.trace(document, request.scope));
      } finally {
        if (exclusive) c.busy = false;
      }
    }),
  );
  const result = (value: unknown) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  });
  server.registerTool(
    'usage_summary',
    {
      description:
        'Read token totals and filters for one explicitly attached frozen usage selection. No source metadata or transcript. Use only when the message summary is insufficient.',
      inputSchema: selectionInput,
      annotations,
    },
    guarded(({ selectionId }: { selectionId: string }) =>
      result(selections.usageSummary(selectionId)),
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
      ({ selectionId, offset, limit }: { selectionId: string; offset: number; limit: number }) =>
        result(selections.usageRecords(selectionId, offset, limit)),
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
      ({ selectionId, offset, limit }: { selectionId: string; offset: number; limit: number }) =>
        result(selections.traceEvents(selectionId, offset, limit)),
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
      async ({
        selectionId,
        eventId,
        field,
        offset,
      }: {
        selectionId: string;
        eventId: string;
        field: 'text' | 'output';
        offset: number;
      }) => result(await selections.traceText(selectionId, eventId, field, offset)),
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
      ({ selectionId, offset, limit }: { selectionId: string; offset: number; limit: number }) =>
        result(selections.provenance(selectionId, offset, limit)),
    ),
  );
  return server;
}
