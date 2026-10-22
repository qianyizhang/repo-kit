import { TraceLog, boundedPayload } from './trace.ts';
import type { JourneyId, Run, TraceEvent } from './contracts.ts';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export const journeys: Record<
  JourneyId,
  {
    title: string;
    description: string;
    button: string;
    input: boolean;
  }
> = {
  startup: {
    title: 'Open the app',
    description: 'Two handshakes connect the server and the interface.',
    button: 'Inspect startup',
    input: false,
  },
  tool: {
    title: 'Call a tool',
    description: 'Follow one echo request across both connections.',
    button: 'Call echo',
    input: true,
  },
  resource: {
    title: 'Read a resource',
    description: 'Load JSON through the host, without a browser fetch.',
    button: 'Read resource',
    input: false,
  },
  context: {
    title: 'Update model context',
    description: 'Provide context for a later conversation turn.',
    button: 'Update context',
    input: true,
  },
  message: {
    title: 'Send a chat message',
    description: 'Ask the host to send text into this conversation.',
    button: 'Send message',
    input: true,
  },
  investigate: {
    title: 'Investigate → ask',
    description: 'Read a resource, test a tool, provide context, then explicitly send a message.',
    button: 'Read resource',
    input: true,
  },
  teardown: {
    title: 'Close the app',
    description: 'Observe a host-mediated cleanup request.',
    button: 'Request close',
    input: false,
  },
};
export type Scenario = Run['scenario'];
export function makeFixture(
  journey: JourneyId,
  scenario: Scenario,
  input = 'Hello from the MCP App',
): { run: Run; events: TraceEvent[] } {
  if (journey === 'investigate') {
    const parts = (['resource', 'tool', 'context', 'message'] as const).map((id) =>
      makeFixture(id, id === 'message' ? scenario : 'success', input),
    );
    const id = `fixture-investigate-${scenario}`;
    return {
      run: { ...parts.at(-1)!.run, id, journey },
      events: parts.flatMap((p) => p.events).map((e, i) => ({ ...e, runId: id, sequence: i + 1 })),
    };
  }
  const id = `fixture-${journey}-${scenario}`,
    app = new TraceLog('app'),
    server = new TraceLog('server');
  app.activeRun = id;
  const events: TraceEvent[] = [];
  const emit = (log: TraceLog, incoming: boolean, message: JSONRPCMessage) => {
    log.wire(message, incoming);
    const event = log.events.at(-1)!;
    events.push({
      ...event,
      sequence: events.length + 1,
      time: `2026-01-01T00:00:00.${String(events.length * 10).padStart(3, '0')}Z`,
      elapsedMs: event.kind === 'response' ? 20 : undefined,
      provenance: 'fixture',
      runId: id,
    });
  };
  const request = (
    log: TraceLog,
    incoming: boolean,
    wire: number,
    method: string,
    params: Record<string, unknown> = {},
  ) => emit(log, incoming, { jsonrpc: '2.0', id: wire, method, params });
  const response = (
    log: TraceLog,
    incoming: boolean,
    wire: number,
    result: Record<string, unknown> = {},
  ) => emit(log, incoming, { jsonrpc: '2.0', id: wire, result });
  let status: Run['status'] = 'success',
    summary = 'Fixture complete. These are authored example events, not captured traffic.',
    result: unknown = { example: true };
  if (journey === 'startup') {
    request(server, true, 0, 'initialize', {
      clientInfo: { name: 'Example host', version: 'fixture' },
    });
    response(server, false, 0, { capabilities: { tools: {}, resources: {} } });
    emit(server, true, { jsonrpc: '2.0', method: 'notifications/initialized' });
    request(server, true, 1, 'tools/list');
    response(server, false, 1, {
      tools: [{ name: 'example_open', _meta: { ui: { resourceUri: 'ui://example/app.html' } } }],
    });
    request(server, true, 2, 'resources/read', { uri: 'ui://example/app.html' });
    response(server, false, 2, {
      contents: [
        {
          uri: 'ui://example/app.html',
          mimeType: 'text/html;profile=mcp-app',
          text: '[example HTML]',
        },
      ],
    });
    request(app, false, 1, 'ui/initialize', {
      appInfo: { name: 'Example app', version: 'fixture' },
    });
    response(app, true, 1, {
      hostInfo: { name: 'Example host', version: 'fixture' },
      hostCapabilities: { serverTools: {}, message: { text: {} } },
    });
    emit(app, false, { jsonrpc: '2.0', method: 'ui/notifications/initialized' });
    summary =
      'Server discovery, HTML loading and the separate UI handshake are complete in this example.';
  } else if (journey === 'tool' || journey === 'resource') {
    const resource = journey === 'resource' || scenario === 'protocol-error';
    const method = resource ? 'resources/read' : 'tools/call';
    const params = resource
      ? {
          uri:
            scenario === 'protocol-error'
              ? 'example://missing'
              : 'example://sample/run/11111111-1111-4111-8111-111111111111',
        }
      : {
          name: 'example_echo',
          arguments: { text: input, runId: id, fail: scenario === 'tool-error' },
        };
    request(app, false, 7, method, params);
    request(server, true, 42, method, params);
    if (scenario === 'protocol-error') {
      const error = { code: -32002, message: 'Resource not found' };
      emit(server, false, { jsonrpc: '2.0', id: 42, error });
      emit(app, true, { jsonrpc: '2.0', id: 7, error });
      status = 'error';
      summary = 'Expected protocol failure: the resource does not exist.';
      result = error;
    } else {
      const data =
        scenario === 'tool-error'
          ? { isError: true, content: [{ type: 'text', text: 'Deliberate tool failure' }] }
          : resource
            ? {
                contents: [
                  {
                    uri: params.uri,
                    mimeType: 'application/json',
                    text: '{"message":"Resources supply context"}',
                  },
                ],
              }
            : {
                content: [{ type: 'text', text: input }],
                structuredContent: { echo: input, runId: id },
              };
      response(server, false, 42, data);
      response(app, true, 7, data);
      result = data;
      if (scenario === 'tool-error') {
        status = 'error';
        summary = 'Expected tool failure: JSON-RPC succeeded, but isError is true.';
      } else
        summary = resource
          ? 'JSON resource returned through the host.'
          : 'Echo returned across both connections. Notice App wire ID 7 versus Server wire ID 42 in details.';
    }
  } else if (journey === 'teardown') {
    emit(app, false, { jsonrpc: '2.0', method: 'ui/notifications/request-teardown' });
    request(app, true, 9, 'ui/resource-teardown');
    response(app, false, 9, {});
    status = 'closed';
    summary =
      'Example host requested cleanup; the example app acknowledged. No real panel was closed.';
  } else {
    const method = journey === 'message' ? 'ui/message' : 'ui/update-model-context';
    request(app, false, 7, method, {
      ...(journey === 'message' ? { role: 'user' } : {}),
      content: [{ type: 'text', text: input }],
    });
    if (scenario === 'timeout') {
      status = 'uncertain';
      summary =
        'No response arrived in the example. Delivery is uncertain; do not automatically resend.';
      result = { error: 'Example timeout' };
    } else if (scenario === 'rejected') {
      response(app, true, 7, { isError: true });
      status = 'error';
      summary = 'The example host rejected the message.';
      result = { isError: true };
    } else {
      response(app, true, 7, {});
      summary =
        journey === 'message'
          ? 'Example host acknowledged. Acknowledgment is not evidence of model execution.'
          : 'Example host acknowledged the context update. No model turn started.';
    }
  }
  return {
    run: {
      id,
      ordinal: 1,
      journey,
      mode: 'fixture',
      status,
      scenario,
      input,
      summary,
      result: boundedPayload(result),
      startedAt: '2026-01-01T00:00:00.000Z',
    },
    events: scenario === 'missing-trace' ? events.filter((e) => e.source === 'app') : events,
  };
}
