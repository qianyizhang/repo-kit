import { createHash } from 'node:crypto';
import { LogStore } from './diagnostic-store.ts';
import { snapshot } from './diagnostic-events.ts';
import type { TraceEvent } from './contracts.ts';

function eventId(value: string) {
  const hex = createHash('sha256').update(value).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
/** Project the existing trace owner into metadata storage; never recapture actions. */
export class Diagnostics {
  readonly store: LogStore;
  constructor(root?: string) {
    this.store = new LogStore('example-mcp-app', root);
  }
  private seen = new Map<string, number>();
  record(connection: string, event: TraceEvent) {
    if (event.observer || event.provenance !== 'captured') return;
    if (event.sequence <= (this.seen.get(connection) ?? 0)) return;
    this.seen.set(connection, event.sequence);
    if (this.seen.size > 16) this.seen.delete(this.seen.keys().next().value!);
    this.store.append({
      id: eventId(`${connection}:${event.sequence}`),
      session: connection,
      interaction:
        /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
          event.runId ?? '',
        )
          ? event.runId!
          : eventId(`${connection}:${event.runId ?? event.sequence}`),
      time: event.time,
      source: event.source,
      method: event.method.slice(0, 120),
      direction: event.direction.slice(0, 120),
      phase: event.kind === 'response' ? 'result' : 'request',
      status: event.status.slice(0, 80),
      // The captured value is the existing frozen trace record. Its wire payload
      // keeps the graph recorder's masking, truncation and provenance markers.
      payload: snapshot(event),
    });
  }
}
