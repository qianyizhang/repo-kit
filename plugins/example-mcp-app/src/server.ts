import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { TraceLog, observedTransport } from './trace.ts';
import { PanelReports, reportSchema } from './contracts.ts';
import { Diagnostics } from './diagnostics.ts';

declare const EXAMPLE_BUILD: string;
const build = EXAMPLE_BUILD,
  uri = `ui://example-mcp-app/app-${build}.html`;
const instance = randomUUID(),
  diagnostics = new Diagnostics();
const log = new TraceLog('server', () => diagnostics.record(instance, log.events.at(-1)!));
const reports = new PanelReports();
const server = new McpServer({ name: 'example-mcp-app', version: '0.4.0' });
log.local('server.started', { instance, build, pid: process.pid });
registerAppTool(
  server,
  'example_open',
  {
    title: 'Example MCP App',
    description:
      'Open the developer playground for inspecting MCP App tools, resources, bridge messages and lifecycle.',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { resourceUri: uri }, 'openai/ui': { entrypoints: [{ type: 'thread' }] } },
  },
  () => ({
    content: [
      {
        type: 'text',
        text: 'Example MCP App opened. Select an action, then inspect its protocol events.',
      },
    ],
    structuredContent: { build, uri, instance },
    _meta: { ui: { resourceUri: uri } },
  }),
);
registerAppTool(
  server,
  'example_echo',
  {
    description:
      'Echo a bounded demo payload, or deliberately return a tool error. No files or external services are used.',
    inputSchema: {
      text: z.string().max(2000),
      fail: z.boolean().default(false),
      runId: z.uuid().optional(),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { visibility: ['app', 'model'] } },
  },
  ({ text, fail, runId }) =>
    fail
      ? {
          isError: true,
          content: [
            {
              type: 'text',
              text: 'Deliberate demo failure. JSON-RPC succeeded; the tool returned isError: true.',
            },
          ],
        }
      : {
          content: [{ type: 'text', text }],
          structuredContent: {
            echo: text,
            characters: text.length,
            instance,
            ...(runId ? { runId } : {}),
          },
        },
);
registerAppTool(
  server,
  'example_trace',
  {
    description:
      'App-only graph snapshot. Conversation investigations use example_status, example_events and example_event for scoped reads. App reports never prove model delivery.',
    inputSchema: { panelId: z.uuid().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { visibility: ['app'] } },
  },
  ({ panelId }) => ({
    content: [{ type: 'text', text: `${log.events.length} retained server events.` }],
    structuredContent: {
      instance,
      build,
      uri,
      events: [...log.events],
      dropped: log.dropped,
      panels: panelId ? reports.list(panelId) : [],
      panelIndex: reports.list().map((report) => ({
        panelId: report.panelId,
        host: report.host.name,
        build: report.build,
        reportedAt: report.reportedAt,
      })),
    },
  }),
);
registerAppTool(
  server,
  'example_report',
  {
    description:
      'Store a bounded self-reported trace from this app panel. Diagnostic only; never proves host or model behavior.',
    inputSchema: { report: reportSchema },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { visibility: ['app'] } },
  },
  ({ report }) => {
    if (report.build !== build)
      return {
        isError: true,
        content: [
          { type: 'text', text: 'App/server build mismatch. Reopen the panel after reconnecting.' },
        ],
      };
    // Only actual live captures belong in the server’s panel evidence.
    const liveEvents = report.events.filter(
      (event) => event.provenance === 'captured' && event.source === 'app',
    );
    liveEvents.forEach((event) => diagnostics.record(report.panelId, event));
    reports.put({
      ...report,
      runs: report.runs.filter((run) => run.mode === 'live'),
      events: liveEvents,
    });
    return {
      content: [{ type: 'text', text: 'App-reported evidence retained in memory.' }],
      structuredContent: { panelId: report.panelId, instance },
    };
  },
);
const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
registerAppTool(
  server,
  'example_status',
  {
    description:
      'Read the active build and panel identities without event payloads. Ordinary messages need no diagnostic read.',
    inputSchema: {},
    annotations: readOnly,
    _meta: { ui: { visibility: ['app', 'model'] } },
  },
  () => ({
    content: [],
    structuredContent: {
      instance,
      build,
      uri,
      panels: reports
        .list()
        .map(({ panelId, host, reportedAt }) => ({ panelId, host, reportedAt })),
    },
  }),
);
registerAppTool(
  server,
  'example_events',
  {
    description:
      'List at most 20 retained event summaries from the server or one explicit panel. Filter by run ID when known; no payloads.',
    inputSchema: {
      panelId: z.uuid().optional(),
      runId: z.string().max(100).optional(),
      limit: z.number().int().min(1).max(20).default(20),
    },
    annotations: readOnly,
    _meta: { ui: { visibility: ['app', 'model'] } },
  },
  ({ panelId, runId, limit }) => {
    const events = panelId ? (reports.list(panelId)[0]?.events ?? []) : log.events;
    return {
      content: [],
      structuredContent: {
        instance,
        panelId,
        events: events
          .filter((event) => !event.observer && (!runId || event.runId === runId))
          .slice(-limit)
          .map((event) => ({
            sequence: event.sequence,
            time: event.time,
            source: event.source,
            method: event.method,
            kind: event.kind,
            status: event.status,
            runId: event.runId,
          })),
      },
    };
  },
);
registerAppTool(
  server,
  'example_event',
  {
    description:
      'Read one exact frozen event payload by its source-local sequence and optional panel ID. App reports remain self-reported evidence.',
    inputSchema: {
      expectedInstance: z.uuid(),
      panelId: z.uuid().optional(),
      sequence: z.number().int().positive(),
    },
    annotations: readOnly,
    _meta: { ui: { visibility: ['app', 'model'] } },
  },
  ({ expectedInstance, panelId, sequence }) => {
    if (expectedInstance !== instance)
      throw new Error('Server changed; read fresh event summaries.');
    const events = panelId ? (reports.list(panelId)[0]?.events ?? []) : log.events;
    const event = events.find((event) => event.sequence === sequence);
    if (!event) throw new Error('Event unavailable or expired');
    return { content: [], structuredContent: { instance, panelId, event } };
  },
);
registerAppTool(
  server,
  'diagnostics_info',
  {
    description:
      'Read build, canonical log location, recording health and retention. No event payloads.',
    inputSchema: {},
    annotations: readOnly,
    _meta: { ui: { visibility: ['app'] } },
  },
  () => ({
    content: [],
    structuredContent: {
      build,
      instance,
      ...diagnostics.store.status(),
      coverage:
        'Persisted metadata and explicit captures are projections of the existing app/server trace records; host internals remain unobserved.',
    },
  }),
);
registerAppTool(
  server,
  'diagnostics_tools',
  {
    description: 'Read the tool catalog generated from this bundled server during build.',
    inputSchema: {},
    annotations: readOnly,
    _meta: { ui: { visibility: ['app'] } },
  },
  async () => ({
    content: [],
    structuredContent: {
      tools: JSON.parse(
        await readFile(new URL('./tool-catalog.json', import.meta.url), 'utf8'),
      ) as unknown,
    },
  }),
);
registerAppTool(
  server,
  'diagnostics_capture',
  {
    description:
      'Save diagnostic capture for one selected live interaction. Only currently retained masked observations are saved; no action is replayed.',
    inputSchema: { interaction: z.uuid() },
    annotations: { ...readOnly, readOnlyHint: false },
    _meta: { ui: { visibility: ['app'] } },
  },
  ({ interaction }) => ({ content: [], structuredContent: diagnostics.store.capture(interaction) }),
);
server.registerResource(
  'example-run-data',
  new ResourceTemplate('example://sample/run/{runId}', { list: undefined }),
  {
    description: 'JSON resource with an explicit interaction ID for cross-transport correlation.',
    mimeType: 'application/json',
  },
  (url, { runId }) => {
    const id = z.uuid().parse(runId);
    return {
      contents: [
        {
          uri: url.href,
          mimeType: 'application/json',
          text: JSON.stringify(
            { message: 'Resources supply context; tools perform operations.', runId: id, instance },
            null,
            2,
          ),
        },
      ],
    };
  },
);
server.registerResource(
  'example-data',
  'example://sample/welcome',
  {
    description: 'A JSON resource independent of the UI HTML resource.',
    mimeType: 'application/json',
  },
  () => ({
    contents: [
      {
        uri: 'example://sample/welcome',
        mimeType: 'application/json',
        text: JSON.stringify(
          {
            message: 'Resources supply context; tools perform operations.',
            owner: 'MCP server',
            instance,
            route: [
              'App: resources/read',
              'Host: forward request',
              'Server: resource callback',
              'Host: forward result',
              'App: render',
            ],
          },
          null,
          2,
        ),
      },
    ],
  }),
);
registerAppResource(server, 'example-ui', uri, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
  contents: [
    {
      uri,
      mimeType: RESOURCE_MIME_TYPE,
      text: await readFile(new URL('./app.html', import.meta.url), 'utf8'),
      _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true } },
    },
  ],
}));
await server.connect(observedTransport(new StdioServerTransport(), log));
