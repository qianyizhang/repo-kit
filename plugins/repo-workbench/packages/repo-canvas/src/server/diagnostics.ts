import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { BUILD, VERSION } from '../model/build.ts';
import { Recorder } from '../../../../../mcp-app-runtime/src/events.ts';
import type { LogStore } from '../../../../../mcp-app-runtime/src/store.ts';

type Details = {
  repo?: string;
  contextId?: string;
  bindingId?: string;
  error?: string;
  threadId?: string;
  metadataKeys?: string[];
  panelId?: string;
  reason?: string;
};
/** Connection metadata is a projection; the shared store is the sole file writer. */
export class ConnectionDiagnostics {
  private readonly fallbackId = randomUUID();
  get serverId() {
    return this.store?.instance ?? this.fallbackId;
  }
  readonly startedAt = new Date().toISOString();
  private events: Array<Details & { time: string; event: string }> = [];
  private store?: LogStore;
  private recorder?: Recorder;
  constructor(store?: LogStore) {
    if (store) this.attach(store);
  }
  attach(store: LogStore) {
    this.store = store;
    this.recorder = new Recorder('server', (event) => store.append(event));
  }
  record(event: string, details: Details = {}) {
    const entry = { time: new Date().toISOString(), event, ...details };
    if (entry.error) entry.error = entry.error.slice(0, 2000);
    this.events.push(entry);
    this.events = this.events.slice(-200);
    this.recorder?.record(
      randomUUID(),
      event,
      'Server lifecycle',
      'result',
      details.error ? 'failed' : 'observed',
      entry,
    );
  }
  snapshot() {
    return {
      version: VERSION,
      build: BUILD,
      startedAt: this.startedAt,
      serverId: this.serverId,
      pid: process.pid,
      file: this.store ? join(this.store.directory, 'server.jsonl') : null,
      fileError: this.store?.error ?? null,
      events: [...this.events],
    };
  }
}
