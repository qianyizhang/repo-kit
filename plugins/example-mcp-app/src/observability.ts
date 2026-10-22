import type { TraceEvent } from './contracts.ts';

export type Observation = Readonly<
  TraceEvent & { key: string; received: number; connectionId: string }
>;
/** Source-independent ingestion for graph, log and export. Sequence numbers are
 * scoped to a source connection; receipt order never asserts cross-clock causality. */
export class Observations {
  private retained: Observation[] = [];
  private connections = new Map<TraceEvent['source'], { id: string; seen: number }>();
  private ordinal = 0;
  dropped = 0;
  readonly limit: number;
  constructor(limit = 500) {
    this.limit = limit;
  }
  ingest(source: TraceEvent['source'], connectionId: string, events: readonly TraceEvent[]) {
    let cursor = this.connections.get(source);
    if (!cursor || cursor.id !== connectionId) {
      cursor = { id: connectionId, seen: 0 };
      this.connections.set(source, cursor);
    }
    for (const event of [...events].sort((a, b) => a.sequence - b.sequence)) {
      if (event.source !== source || event.sequence <= cursor.seen) continue;
      cursor.seen = event.sequence;
      this.retained.push(
        Object.freeze({
          ...event,
          connectionId,
          key: `${source}:${connectionId}:${event.sequence}`,
          received: ++this.ordinal,
        }),
      );
      if (this.retained.length > this.limit) {
        this.retained.shift();
        this.dropped++;
      }
    }
  }
  all(): readonly Observation[] {
    return this.retained;
  }
}
