import { randomUUID } from 'node:crypto';
import { usageIndexPath, type ScanCache } from '../usage/scan.ts';
import { selectRecords, type Snapshot, type UsageOverview } from '../usage/model.ts';
import { overview, evidenceRecords } from '../usage/overview.ts';
import { loadOverview, scanHistory, type HistoryResult } from './history.ts';
import { createTraceReader, readRecord, textBlock } from '../usage/trace-service.ts';
import type { ReviewDocument } from '../session-review/src/model/contracts.ts';
import { BUILD } from '../repo-canvas/src/model/build.ts';
import {
  requestSchema,
  parseReportOutput,
  type Request,
  type Binding,
  type ReportOutput,
} from './contracts.ts';
import { ReportSelections } from './selections.ts';
import { immutable, RuntimeError } from '../../../mcp-app-runtime/src/definition.ts';
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

export class ReportSession {
  #c: Context;
  #closed = false;
  #scan?: ReturnType<typeof scanHistory>;
  #selections: ReportSelections;
  #traceBytes = new Map<string, number>();
  #snapshotBytes = 0;
  #pendingBytes = 0;
  #account: (bytes: number) => void;
  #seed?: ScanCache;
  constructor(
    declaration: { roots: string[]; kind: 'usage' | 'trace'; session?: string; index?: string },
    selections: ReportSelections,
    initial: { snapshot?: Snapshot; cache?: ScanCache; account?: (bytes: number) => void } = {},
  ) {
    const { roots, kind, session, index } = immutable(declaration);
    this.#account = initial.account ?? (() => {});
    this.#seed = initial.cache && structuredClone(initial.cache);
    this.#selections = selections;
    const c: Context = {
      binding: { contextId: randomUUID(), revision: 0, kind, session, build: BUILD },
      roots: [...roots],
      overviews: new Map(),
      refreshing: false,
      ready: Promise.resolve(),
      index: index ?? usageIndexPath(roots),
      traces: new Map(),
      reader: () => Promise.reject(new Error('Report reader not initialized')),
      busy: false,
    };
    c.reader = createTraceReader(() => {
      this.assertOpen();
      if (!c.snapshot)
        throw new Error('Cached summary shown. History is still refreshing; try again shortly.');
      return c.snapshot;
    });
    this.#c = c;
    if (initial.snapshot) {
      c.pending = {
        snapshot: structuredClone(initial.snapshot),
        overviews: ['Asia/Shanghai', 'UTC'].map((t) => overview(initial.snapshot!, t)),
        timings: {},
      };
      this.adopt();
    } else this.startScan();
  }
  get binding() {
    return immutable(this.#c.binding);
  }
  get retainedBytes() {
    return (
      this.#pendingBytes +
      this.#snapshotBytes +
      [...this.#traceBytes.values()].reduce((a, b) => a + b, 0)
    );
  }
  private assertOpen() {
    if (this.#closed) throw new RuntimeError('closed', 'Report session closed. Reopen it.');
  }
  private startScan() {
    this.assertOpen();
    const c = this.#c;
    if (c.refreshing) return;
    const job = scanHistory(c.roots, c.index, this.#seed);
    this.#seed = undefined;
    this.#scan = job;
    c.refreshing = true;
    c.error = undefined;
    c.ready = job.promise
      .then((result) => {
        if (this.#closed) return;
        if (Buffer.byteLength(JSON.stringify(result)) > 128 * 1024 * 1024)
          throw new RuntimeError(
            'limit',
            'Report exceeds its 128 MiB memory budget. Choose smaller log roots.',
          );
        const bytes = Buffer.byteLength(JSON.stringify(result));
        this.#account(this.retainedBytes - this.#pendingBytes + bytes);
        this.#pendingBytes = bytes;
        c.pending = result;
        c.timings = result.timings;
      })
      .catch((error: unknown) => {
        if (!this.#closed) c.error = String(error);
      })
      .finally(() => {
        if (!this.#closed) c.refreshing = false;
        if (this.#scan === job) this.#scan = undefined;
      });
  }
  private adopt() {
    this.assertOpen();
    const c = this.#c;
    if (!c.pending) throw new Error(c.error ?? 'History is still refreshing. Try again shortly.');
    const bytes = Buffer.byteLength(JSON.stringify(c.pending));
    if (bytes > 128 * 1024 * 1024)
      throw new RuntimeError('limit', 'Report exceeds its 128 MiB memory budget');
    this.#snapshotBytes = bytes;
    c.snapshot = c.pending.snapshot;
    c.overviews = new Map(c.pending.overviews.map((o) => [o.timezone, o]));
    c.pending = undefined;
    this.#pendingBytes = 0;
    c.traces.clear();
    this.#traceBytes.clear();
    this.#account(this.retainedBytes);
  }
  async initializeTrace() {
    await this.#c.ready;
    this.assertOpen();
    this.adopt();
    if (this.#c.binding.session) await this.trace(this.#c.binding.session);
  }
  async trace(id: string) {
    this.assertOpen();
    const revision = this.#c.binding.revision;
    const value = await this.#c.reader(id);
    this.assertOpen();
    if (this.#c.binding.revision !== revision)
      throw new RuntimeError('stale', 'Report changed while reading the trace. Reopen it.');
    if (!value)
      throw new RuntimeError('not_found', 'Session is not in these log roots. Refresh logs first.');
    const bytes = Buffer.byteLength(JSON.stringify(value.data));
    if (bytes > 64 * 1024 * 1024)
      throw new RuntimeError('limit', 'Trace exceeds its 64 MiB memory budget');
    this.#c.traces.delete(id);
    this.#traceBytes.delete(id);
    while (
      this.#c.traces.size >= 8 ||
      [...this.#traceBytes.values()].reduce((a, b) => a + b, bytes) > 64 * 1024 * 1024
    ) {
      const first = this.#c.traces.keys().next().value!;
      this.#c.traces.delete(first);
      this.#traceBytes.delete(first);
    }
    this.#account(this.retainedBytes + bytes);
    this.#c.traces.set(id, value.data);
    this.#traceBytes.set(id, bytes);
    return immutable(value);
  }
  /** Transport prepares its output before the new snapshot becomes authoritative. */
  async refreshRaw<T>(publish: (value: Snapshot) => Promise<T>): Promise<T> {
    this.assertOpen();
    const c = this.#c;
    if (c.busy) throw new RuntimeError('busy', 'Scan already running');
    c.busy = true;
    try {
      if (!c.pending && !c.refreshing) this.startScan();
      await c.ready;
      this.assertOpen();
      if (!c.pending) throw new Error(c.error ?? 'History is still refreshing');
      const result = await publish(c.pending.snapshot);
      this.assertOpen();
      this.adopt();
      c.binding = { ...c.binding, revision: c.binding.revision + 1 };
      return result;
    } finally {
      c.busy = false;
    }
  }
  execute<R extends Request>(input: R, revision: number): Promise<ReportOutput<R['action']>>;
  execute<T>(input: Request, revision: number, deliver: (value: unknown) => T): Promise<T>;
  async execute(
    input: Request,
    revision: number,
    deliver: (value: unknown) => unknown = (value) => value,
  ): Promise<unknown> {
    this.assertOpen();
    const c = this.#c;
    const request = requestSchema.parse(input);
    if (revision !== c.binding.revision)
      throw new RuntimeError('stale', 'Report changed. Reopen or refresh the panel.');
    const publish = (value: unknown) => {
      this.assertOpen();
      if (revision !== c.binding.revision)
        throw new RuntimeError(
          'stale',
          'Report changed while reading. Reopen or refresh the panel.',
        );
      return deliver(immutable(parseReportOutput(request.action, value)));
    };
    if (request.action === 'status')
      return publish({
        refreshing: c.refreshing,
        updated: !!c.pending,
        error: c.error,
        timings: c.timings,
      });
    if (c.busy) throw new Error('Report operation in progress. Try again after it finishes.');
    const exclusive = ['refresh', 'trace', 'select_usage', 'select_trace'].includes(request.action);
    if (exclusive) c.busy = true;
    try {
      if (request.action === 'refresh') {
        if (!c.pending && !c.refreshing) this.startScan();
        await c.ready;
        this.assertOpen();
        if (!c.pending) throw new Error(c.error ?? 'History is still refreshing.');
        const binding = { ...c.binding, revision: c.binding.revision + 1 };
        // A failed delivery-size check must leave the displayed revision usable.
        const result = publish({
          binding,
          snapshot: c.pending.overviews.find((o) => o.timezone === request.timezone),
          refreshing: false,
          timings: c.timings,
        });
        this.adopt();
        c.binding = binding;
        return result;
      }
      if (request.action === 'snapshot') {
        if (!c.snapshot && !c.overviews.has(request.timezone)) {
          const cached = await loadOverview(c.index, request.timezone);
          this.assertOpen();
          if (cached && JSON.stringify(cached.roots) === JSON.stringify(c.roots))
            c.overviews.set(request.timezone, cached);
        }
        if (!c.overviews.has(request.timezone)) {
          if (c.overviews.size)
            throw new Error(
              'This time zone is not cached. Refresh logs before switching time zone.',
            );
          await c.ready;
          this.assertOpen();
          this.adopt();
        }
        return publish({
          binding: c.binding,
          snapshot: c.overviews.get(request.timezone),
          refreshing: !c.snapshot,
          timings: c.timings,
          document: c.binding.session ? c.traces.get(c.binding.session) : undefined,
        });
      }
      if (request.action === 'evidence' || request.action === 'export') {
        if (!c.snapshot)
          throw new Error('Cached summary shown. History is still refreshing; try again shortly.');
        if (request.action === 'evidence') {
          const ids = new Set(c.overviews.get(request.timezone)?.records.map((row) => row.id));
          if (request.ids.some((id) => !ids.has(id)))
            throw new Error('Evidence selection changed. Reopen it from the current summary.');
        }
        return publish({
          records:
            request.action === 'evidence'
              ? evidenceRecords(c.snapshot, request.timezone, request.ids)
              : selectRecords(c.snapshot.records, request.filters),
        });
      }
      if (request.action === 'trace') {
        const trace = await this.trace(request.session);
        return publish({ document: trace.data });
      }
      if (request.action === 'text' || request.action === 'image') {
        const data = c.traces.get(request.session);
        if (!data) throw new Error('Trace expired. Reopen it from the dashboard.');
        const body = await readRecord(data, request.event, request.revision);
        this.assertOpen();
        if (request.action === 'text')
          return publish(
            textBlock(request.field === 'output' ? (body.output ?? '') : body.text, request.offset),
          );
        const image = body.imageUrls[request.index];
        if (
          !image ||
          !/^data:image\/(png|jpeg|webp|gif);base64,/.test(image) ||
          image.length > 12 * 1024 * 1024
        )
          throw new Error('Image unavailable or too large for this panel.');
        return publish({ image });
      }
      if (request.action === 'select_usage') {
        const snapshot = c.snapshot ?? c.overviews.get(request.filters.timezone);
        if (!snapshot) throw new Error('Wait for this time zone to load before attaching context.');
        return publish(this.#selections.usage(snapshot, request.filters, request.ids));
      }
      const document = c.traces.get(request.session);
      if (!document) throw new Error('Open the trace before attaching context.');
      return publish(this.#selections.trace(document, request.scope));
    } finally {
      if (exclusive) c.busy = false;
    }
  }
  dispose() {
    if (this.#closed) return;
    this.#closed = true;
    void this.#scan?.stop();
    this.#scan = undefined;
    this.#seed = undefined;
    this.#c.traces.clear();
    this.#c.overviews.clear();
    this.#c.snapshot = undefined;
    this.#c.pending = undefined;
    this.#traceBytes.clear();
    this.#snapshotBytes = 0;
    this.#pendingBytes = 0;
  }
}
