import { actionSignals, type ReviewSignal } from './signals.ts';
import type { TraceEvent } from './contracts.ts';
export interface TraceAction {
  key: string;
  anchor: TraceEvent;
  records: TraceEvent[];
  executions: TraceEvent[];
  results: TraceEvent[];
  signals: ReviewSignal[];
}
/** A presentation group only: every source record keeps its identity and body. */
export function traceActions(events: TraceEvent[]): TraceAction[] {
  const groups = new Map<string, TraceAction>();
  const byKey = new Map(events.map((event, index) => [event.key, { event, index }]));
  const byCall = new Map<string, string>();
  for (const event of events)
    if (event.callId && !isResult(event))
      byCall.set(JSON.stringify([event.threadId, event.turnId, event.callId]), event.key);
  for (const event of events) {
    const parent =
      event.parentCall ??
      (event.callId && isResult(event)
        ? byCall.get(JSON.stringify([event.threadId, event.turnId, event.callId]))
        : undefined);
    const key = parent && byKey.has(parent) ? parent : event.key;
    let group = groups.get(key);
    if (!group) {
      const anchor = byKey.get(key)?.event ?? event;
      group = { key, anchor, records: [], executions: [], results: [], signals: [] };
      groups.set(key, group);
    }
    group.records.push(event);
    if (event.parentCall || /CommandExecution|McpToolCall/.test(event.sourceType ?? ''))
      group.executions.push(event);
    if (isResult(event)) group.results.push(event);
  }
  const sorted = [...groups.values()].sort(
    (a, b) => (byKey.get(a.key)?.index ?? 0) - (byKey.get(b.key)?.index ?? 0),
  );
  const activeTurns = new Set<string>();
  for (const action of sorted) {
    action.signals = actionSignals(action);
    const e = action.anchor,
      turn = JSON.stringify([e.threadId, e.turnId]);
    if (
      e.kind === 'request' &&
      !/^# AGENTS\.md instructions for /.test(e.text) &&
      activeTurns.has(turn)
    )
      action.signals.push('steering');
    if (
      e.title !== 'Recorded message' &&
      ['message', 'command', 'edit', 'image', 'delegation'].includes(e.kind)
    )
      activeTurns.add(turn);
  }
  return sorted;
}

const isResult = (e: TraceEvent) =>
  /\/(function_call_output|custom_tool_call_output)$/.test(e.sourceType ?? '');
export const recordType = (e: TraceEvent) =>
  isResult(e) ? 'result' : e.kind === 'command' ? 'call' : e.kind;
/** One dominant kind for grouping, badges, legend, and filtering. */
export const actionKind = (action: TraceAction) => {
  const kinds = new Set(action.executions.map((e) => e.kind));
  if (kinds.size > 1 && /(^|[.])exec$/.test(action.anchor.title)) return 'code-mode';
  const e = kinds.size === 1 ? action.executions[0] : action.anchor;
  return e.kind === 'message' && e.messagePhase
    ? e.messagePhase === 'commentary'
      ? 'commentary'
      : 'response'
    : e.kind;
};
export function actionDescription(action: TraceAction) {
  const e = action.executions[0] ?? action.anchor;
  if (e.kind === 'ask') return e.questions?.[0]?.title ?? 'Ask user';
  if (e.kind === 'compaction')
    return `${e.title}${e.compaction?.window !== undefined ? ' · window ' + e.compaction.window : ''}`;
  if (actionKind(action) === 'code-mode') return action.executions.map((r) => r.title).join(' → ');
  if (action.executions.length && e.kind === 'image')
    return `Image inspection · ${action.executions.filter((r) => r.kind === 'image').length} images`;
  if (e.kind === 'edit' && e.paths.length)
    return e.paths.map((path) => path.split('/').at(-1)).join(', ');
  if (isResult(e) && e.callId) return 'Output · ' + e.callId;
  const objective =
    e.kind === 'goal'
      ? e.preview.match(/<objective[^>]*>([\s\S]*?)(?:<\/objective>|$)/)?.[1]
      : undefined;
  return (objective ?? e.preview).replace(/\s+/g, ' ').trim().slice(0, 130) || e.title;
}
