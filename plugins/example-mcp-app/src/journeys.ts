import { TraceLog, boundedPayload } from './trace.ts';
import type { JourneyId, Run, TraceEvent } from './contracts.ts';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export const journeys: Record<
  JourneyId,
  {
    title: string;
    description: string;
    expected: string;
    button: string;
    route: string;
    input: boolean;
  }
> = {
  startup: {
    title: 'Open the app',
    description: 'Two handshakes connect the server and the interface.',
    expected:
      'The host discovers the tool, reads its HTML resource, then negotiates the app bridge. Resource preloading can change this order.',
    button: 'Inspect startup',
    route: 'Host ↔ Server, then App ↔ Host',
    input: false,
  },
  tool: {
    title: 'Call a tool',
    description: 'Follow one echo request across both connections.',
    expected:
      'The server returns the exact demo text. Both transport legs share an interaction ID; their wire request IDs can differ.',
    button: 'Call echo',
    route: 'App → Host → Server → Host → App',
    input: true,
  },
  resource: {
    title: 'Read a resource',
    description: 'Load JSON through the host, without a browser fetch.',
    expected:
      'The server returns application/json with the interaction ID and current server instance.',
    button: 'Read resource',
    route: 'App → Host → Server → Host → App',
    input: false,
  },
  context: {
    title: 'Update model context',
    description: 'Provide context for a later conversation turn.',
    expected:
      'The host acknowledges the update. This does not start a model turn or prove that a model used the context.',
    button: 'Update context',
    route: 'App ↔ Host · no server operation',
    input: true,
  },
  message: {
    title: 'Send a chat message',
    description: 'Ask the host to send text into this conversation.',
    expected:
      'An acknowledgment proves the host accepted the request. Check this Codex chat for arrival and any model response; neither is implied by the acknowledgment.',
    button: 'Send message',
    route: 'App ↔ Host · no server operation',
    input: true,
  },
  error: {
    title: 'Understand failures',
    description: 'Compare an application failure with a protocol failure.',
    expected:
      'A tool error returns a valid response with isError: true. A missing resource returns a JSON-RPC error. Neither should be shown as a successful action.',
    button: 'Run error case',
    route: 'App → Host → Server → Host → App',
    input: false,
  },
  teardown: {
    title: 'Close the app',
    description: 'Observe a host-mediated cleanup request.',
    expected:
      'The app requests closure. If the host agrees, it sends ui/resource-teardown and the app acknowledges. The panel may disappear; silence does not prove closure.',
    button: 'Request close',
    route: 'App → Host → App · host decides',
    input: false,
  },
};
export type Scenario = 'success' | 'rejected' | 'timeout' | 'tool-error' | 'protocol-error';
export function makeFixture(
  journey: JourneyId,
  scenario: Scenario,
): { run: Run; events: TraceEvent[] } {
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
  } else if (journey === 'tool' || journey === 'resource' || journey === 'error') {
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
          arguments: { text: 'Hello from the example', runId: id, fail: journey === 'error' },
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
        journey === 'error'
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
                content: [{ type: 'text', text: 'Hello from the example' }],
                structuredContent: { echo: 'Hello from the example', runId: id },
              };
      response(server, false, 42, data);
      response(app, true, 7, data);
      result = data;
      if (journey === 'error') {
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
      content: [{ type: 'text', text: 'Example text. No real message is sent.' }],
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
      summary,
      result: boundedPayload(result),
      startedAt: '2026-01-01T00:00:00.000Z',
    },
    events,
  };
}

export function runEvents(run: Run, events: TraceEvent[]) {
  return events.filter((event) => event.runId === run.id && !event.observer);
}
export function hostEvidence(run: Run, events: TraceEvent[]): { label: string; body: string } {
  const hasApp = events.some((e) => e.source === 'app'),
    hasServer = events.some((e) => e.source === 'server');
  if (run.journey === 'startup')
    return {
      label: 'Two separate connections',
      body: 'Server initialization and UI initialization are separate handshakes. The middle of the host is not instrumented.',
    };
  if (hasApp && hasServer)
    return {
      label: 'Forwarding inferred',
      body: 'The two recorded legs carry the same interaction ID. This supports the route through the host; internal host processing is not directly captured.',
    };
  if (run.journey === 'tool' || run.journey === 'resource' || run.journey === 'error')
    return {
      label: 'Partial evidence',
      body: 'One transport leg is missing. Do not infer forwarding from similar IDs or timestamps. Refresh server evidence or inspect a host error.',
    };
  if (run.journey === 'teardown')
    return {
      label: run.status === 'closed' ? 'Cleanup request captured' : 'Host decision pending',
      body: 'The host controls closure. A sent notification alone does not prove that it closed the panel.',
    };
  const response = events.find((e) => e.source === 'app' && e.kind === 'response');
  return {
    label: response
      ? response.status === 'success'
        ? 'Host acknowledgment captured'
        : 'Host rejection captured'
      : 'No host acknowledgment',
    body:
      run.journey === 'message'
        ? 'A bridge reply does not prove message arrival or model execution. Check the owning conversation.'
        : 'The bridge can acknowledge context receipt. Model use of that context is not observable here.',
  };
}
