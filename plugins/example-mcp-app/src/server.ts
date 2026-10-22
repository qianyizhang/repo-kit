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

declare const EXAMPLE_BUILD: string;
const build = EXAMPLE_BUILD,
  uri = `ui://example-mcp-app/app-${build}.html`;
const instance = randomUUID(),
  log = new TraceLog('server');
const reports = new PanelReports();
const server = new McpServer({ name: 'example-mcp-app', version: '0.3.0' });
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
      'Read real server transport evidence and a panel index. Pass panelId from the index to inspect that panel’s self-reported live bridge trace and grouped runs. App reports do not prove model delivery. Observer payloads are omitted from tracing.',
    inputSchema: { panelId: z.uuid().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { visibility: ['app', 'model'] } },
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
    reports.put({
      ...report,
      runs: report.runs.filter((run) => run.mode === 'live'),
      events: report.events.filter((event) => event.provenance === 'captured'),
    });
    return {
      content: [{ type: 'text', text: 'App-reported evidence stored.' }],
      structuredContent: { panelId: report.panelId, instance },
    };
  },
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
