import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { TraceEvent } from './contracts.ts';

/** Payloads are frozen, bounded and visibly abbreviated. This is a demo recorder,
 * not a production secrets filter: free text is deliberately inspectable. */
export function boundedPayload(value: unknown): string {
  const result =
    JSON.stringify(
      value,
      (key, value: unknown) => {
        if (/authorization|cookie|password|secret|token|api[-_]?key/i.test(key))
          return '[redacted]';
        if (typeof value === 'string' && value.includes('<!DOCTYPE html>'))
          return `[HTML omitted: ${value.length} characters; read the registered resource for source]`;
        return value;
      },
      2,
    ) ?? 'null';
  return result.length > 12000
    ? `${result.slice(0, 12000)}\n[truncated at 12000 characters]`
    : result;
}

export class TraceLog {
  readonly events: TraceEvent[] = [];
  dropped = 0;
  private sequence = 0;
  private pending = new Map<
    string,
    { method: string; started: number; observer: boolean; runId?: string }
  >();
  activeRun: string | undefined;
  teardownRun: string | undefined;
  readonly source: 'server' | 'app';
  private changed: () => void;
  constructor(source: 'server' | 'app', changed = () => {}) {
    this.source = source;
    this.changed = changed;
  }
  local(method: string, detail: unknown, status = 'captured', runId = this.activeRun) {
    this.append({
      direction: this.source,
      method,
      kind: 'local',
      status,
      payload: boundedPayload(detail),
      observer: false,
      runId,
    });
  }
  wire(message: JSONRPCMessage, incoming: boolean) {
    const direction =
      this.source === 'server'
        ? incoming
          ? 'Host → Server'
          : 'Server → Host'
        : incoming
          ? 'Host → App'
          : 'App → Host';
    const id = 'id' in message ? message.id : undefined;
    let method = 'unmatched response',
      observer = false,
      elapsedMs: number | undefined,
      runId: string | undefined;
    if ('method' in message) {
      method = message.method;
      observer =
        method === 'tools/call' &&
        ['example_trace', 'example_report'].includes(String(message.params?.name));
      const args = message.params?.arguments;
      const supplied = args && typeof args === 'object' && 'runId' in args ? args.runId : undefined;
      if (
        typeof supplied === 'string' &&
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(supplied)
      )
        runId = supplied;
      if (method === 'resources/read' && typeof message.params?.uri === 'string') {
        const match = /^example:\/\/sample\/(?:run|missing)\/([a-f0-9-]{36})$/.exec(
          message.params.uri,
        );
        if (match) runId = match[1];
      }
      if (
        this.source === 'app' &&
        !incoming &&
        !observer &&
        (id !== undefined || method === 'ui/notifications/request-teardown')
      )
        runId ??= this.activeRun;
      if (method === 'ui/resource-teardown') runId ??= this.teardownRun ?? 'host-teardown';
      if (
        !runId &&
        [
          'initialize',
          'notifications/initialized',
          'tools/list',
          'resources/list',
          'ui/initialize',
          'ui/notifications/initialized',
          'ui/notifications/tool-input',
          'ui/notifications/tool-input-partial',
          'ui/notifications/tool-result',
        ].includes(method)
      )
        runId = 'startup';
      if (!runId && method === 'resources/read' && String(message.params?.uri).startsWith('ui://'))
        runId = 'startup';
      if (id !== undefined) {
        this.pending.set(`${incoming}:${typeof id}:${id}`, {
          method,
          started: performance.now(),
          observer,
          runId,
        });
        if (this.pending.size > 250) this.pending.delete(this.pending.keys().next().value!);
      }
    } else if (id !== undefined) {
      const key = `${!incoming}:${typeof id}:${id}`,
        request = this.pending.get(key);
      if (request) {
        method = request.method;
        observer = request.observer;
        runId = request.runId;
        elapsedMs = Math.round((performance.now() - request.started) * 10) / 10;
        this.pending.delete(key);
      }
    }
    const toolError = 'result' in message && message.result.isError === true;
    this.append({
      direction,
      method,
      kind: 'method' in message ? (id === undefined ? 'notification' : 'request') : 'response',
      status:
        'error' in message
          ? 'RPC error'
          : toolError
            ? method === 'tools/call'
              ? 'tool error'
              : 'application error'
            : 'method' in message
              ? 'captured'
              : 'success',
      ...(id !== undefined ? { requestId: id } : {}),
      ...(elapsedMs !== undefined ? { elapsedMs } : {}),
      observer,
      runId: observer ? undefined : runId,
      payload:
        observer && !('error' in message)
          ? boundedPayload({
              jsonrpc: message.jsonrpc,
              id,
              ...('method' in message
                ? {
                    method: message.method,
                    params: { name: message.params?.name, arguments: '[observer payload omitted]' },
                  }
                : { result: '[observer payload omitted to prevent recursive traces]' }),
            })
          : boundedPayload(message),
    });
  }
  private append(event: Omit<TraceEvent, 'sequence' | 'time' | 'source' | 'provenance'>) {
    this.events.push({
      ...event,
      sequence: ++this.sequence,
      time: new Date().toISOString(),
      source: this.source,
      provenance: 'captured',
    });
    if (this.events.length > 250) {
      this.events.shift();
      this.dropped++;
    }
    this.changed();
  }
}

/** Observe the actual SDK transport, not reconstructed API calls. IDs are local
 * to each leg: the host may assign a different ID when forwarding to stdio. */
export function observedTransport(inner: Transport, log: TraceLog): Transport {
  const outer: Transport = {
    async start() {
      inner.onmessage = (message, extra) => {
        log.wire(message, true);
        outer.onmessage?.(message, extra);
      };
      inner.onerror = (error) => {
        log.local('transport.error', String(error), 'error');
        outer.onerror?.(error);
      };
      inner.onclose = () => {
        log.local('transport.closed', {});
        outer.onclose?.();
      };
      await inner.start();
    },
    async send(message, options) {
      log.wire(message, false);
      try {
        await inner.send(message, options);
      } catch (error) {
        log.local('transport.send-failed', String(error), 'error');
        throw error;
      }
    },
    close: () => inner.close(),
    setProtocolVersion: (version) => inner.setProtocolVersion?.(version),
  };
  return outer;
}
