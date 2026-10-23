import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { summarize, selectRecords, type UsageData, type UsageRow } from '../usage/model.ts';
import { bucketId } from '../usage/overview.ts';
import type { ReviewDocument, TraceEvent } from '../session-review/src/model/contracts.ts';
import { traceActions } from '../session-review/src/model/actions.ts';
import { readRecord, textBlock } from '../usage/trace-service.ts';
import { filtersSchema, traceScopeSchema } from './contracts.ts';

type Scope = z.infer<typeof traceScopeSchema>;
type UsageSelection = {
  kind: 'usage';
  snapshot: UsageData;
  rows: UsageRow[];
  filters: z.infer<typeof filtersSchema>;
};
type TraceSelection = {
  kind: 'trace';
  document: ReviewDocument;
  events: TraceEvent[];
  scope: Scope;
};
type Selection = UsageSelection | TraceSelection;
const pageSchema = {
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(20).default(10),
};
export const selectionInput = { selectionId: z.string().uuid() };
export const pageInput = { ...selectionInput, ...pageSchema };
function page<T>(rows: T[], offset: number, limit: number) {
  return {
    total: rows.length,
    offset,
    nextOffset: offset + limit < rows.length ? offset + limit : null,
    items: rows.slice(offset, offset + limit),
  };
}
const preview = (event: TraceEvent) => ({
  eventId: event.key,
  kind: event.kind,
  role: event.role,
  title: event.title.slice(0, 200),
  preview: event.preview.slice(0, 400),
});

export class ReportSelections {
  private selections = new Map<string, Selection>();
  private save(value: Selection) {
    if (this.selections.size >= 40) this.selections.delete(this.selections.keys().next().value!);
    const selectionId = randomUUID();
    this.selections.set(selectionId, value);
    return selectionId;
  }
  private get(id: string): Selection {
    const value = this.selections.get(id);
    if (!value) throw new Error('Selection expired. Attach the selection again.');
    return value;
  }
  usage(snapshot: UsageData, filters: z.infer<typeof filtersSchema>, ids?: string[]) {
    const selected = ids && new Set(ids);
    const rows = selectRecords<UsageRow>(snapshot.records, filters).filter(
      (row) =>
        !selected || selected.has('events' in row ? row.id : bucketId(row, filters.timezone)),
    );
    if (ids && !rows.length) throw new Error('Usage selection changed. Select it again.');
    const selectionId = this.save({ kind: 'usage', snapshot, rows, filters: { ...filters } });
    return { selectionId, ...this.usageSummary(selectionId) };
  }
  usageSummary(id: string) {
    const s = this.get(id);
    if (s.kind !== 'usage') throw new Error('This is a trace selection. Use trace_events.');
    const total = summarize(s.rows, {});
    return {
      kind: s.kind,
      generatedAt: s.snapshot.generatedAt,
      cached: 'overviewVersion' in s.snapshot,
      filters: Object.fromEntries(Object.entries(s.filters).filter(([, v]) => v !== '')),
      sessions: total.sessions,
      events: total.events,
      tokens: total.tokens,
    };
  }
  usageRecords(id: string, offset: number, limit: number) {
    const s = this.get(id);
    if (s.kind !== 'usage') throw new Error('This is a trace selection. Use trace_events.');
    if (s.rows.some((row) => 'events' in row))
      throw new Error(
        'This frozen cached summary has no exact records. Refresh and attach the selection again.',
      );
    return page(
      s.rows
        .filter((row) => 'line' in row)
        .map((row) => ({
          id: row.id,
          session: row.session,
          at: row.at,
          model: row.model,
          effort: row.effort,
          tokens: row.tokens,
          method: row.method,
        })),
      offset,
      limit,
    );
  }
  trace(document: ReviewDocument, scope: Scope) {
    const thread = document.threads.find((t) => t.id === scope.thread);
    const turn = thread?.turns.find((t) => t.id === scope.turn);
    if (!turn || (!scope.reviews && thread?.purpose === 'auto-review'))
      throw new Error('Select a visible turn or action first.');
    let events = turn.events.filter((e) => scope.reviews || e.kind !== 'auto-review');
    if (scope.event) {
      const action = traceActions(events).find((a) => a.records.some((e) => e.key === scope.event));
      if (!action) throw new Error('Selected action is not in this turn.');
      events = action.records;
    }
    const selectionId = this.save({ kind: 'trace', document, events, scope: { ...scope } });
    return {
      selectionId,
      kind: 'trace',
      thread: scope.thread,
      turn: scope.turn,
      event: scope.event,
      totalEvents: events.length,
      previews: events.slice(0, 2).map(preview),
      shown: Math.min(2, events.length),
    };
  }
  traceEvents(id: string, offset: number, limit: number) {
    const s = this.get(id);
    if (s.kind !== 'trace') throw new Error('This is a usage selection. Use usage_records.');
    return page(s.events.map(preview), offset, limit);
  }
  async traceText(id: string, eventId: string, field: 'text' | 'output', offset: number) {
    const s = this.get(id);
    if (s.kind !== 'trace') throw new Error('This is a usage selection.');
    const event = s.events.find((e) => e.key === eventId);
    if (!event) throw new Error('Event is outside this frozen selection.');
    const body = event.body
      ? await readRecord(s.document, eventId, event.body.sources.map((s) => s.sha256).join('.'))
      : event;
    return textBlock(field === 'output' ? (body.output ?? '') : body.text, offset);
  }
  provenance(id: string, offset: number, limit: number) {
    const s = this.get(id);
    if (s.kind === 'usage') {
      const paths = new Set(s.rows.map((r) => r.source));
      return page(
        s.snapshot.sources
          .filter((source) => paths.has(source.path))
          .map((source) => ({
            source,
            gapCount: s.snapshot.gaps
              .filter((g) => g.source === source.path)
              .reduce((n, g) => n + g.count, 0),
          })),
        offset,
        limit,
      );
    }
    const threads = new Set(s.events.map((e) => e.threadId));
    return page(
      s.document.threads
        .filter((t) => threads.has(t.id))
        .map((t) => ({
          thread: t.id,
          source: t.source,
          coverage: {
            ...t.coverage,
            unsupportedItems: t.coverage.unsupportedItems.length,
            excludedItems: t.coverage.excludedItems.length,
          },
        })),
      offset,
      limit,
    );
  }
}
