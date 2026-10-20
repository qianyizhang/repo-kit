import type { TraceEvent } from './contracts.ts';
const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const str = (value: unknown) => (typeof value === 'string' ? value : '');
export function readQuestions(value: unknown): NonNullable<TraceEvent['questions']> {
  return (Array.isArray(value) ? value : [])
    .map(obj)
    .map((q) => ({
      id: str(q.id),
      title: str(q.title) || str(q.question),
      options: (Array.isArray(q.options) ? q.options : [])
        .map((o) =>
          typeof o === 'string'
            ? { label: o }
            : { label: str(obj(o).label), description: str(obj(o).description) },
        )
        .filter((o) => o.label),
    }))
    .filter((q) => q.title);
}
export function questionResult(value: unknown): TraceEvent['questionResult'] {
  try {
    const result = obj(typeof value === 'string' ? JSON.parse(value) : value);
    const answers = Object.fromEntries(
      Object.entries(obj(result.answers)).flatMap(([id, answer]) => {
        const values = Array.isArray(answer) ? answer : obj(answer).answers;
        return Array.isArray(values) && values.every((v) => typeof v === 'string') && values.length
          ? [[id, values]]
          : [];
      }),
    );
    return {
      ...(typeof result.accepted === 'boolean' ? { delivered: result.accepted } : {}),
      ...(Object.keys(answers).length ? { answers } : {}),
    };
  } catch {
    return undefined;
  }
}
/** Match compaction metadata to its completion by the recorded interval, never by proximity alone. */
export function linkCompactions(events: TraceEvent[]) {
  for (const marker of events.filter(
    (e) => e.kind === 'compaction' && e.sourceType === 'compacted/',
  )) {
    const time = marker.timestamp ? Date.parse(marker.timestamp) : NaN;
    const matches = events.filter(
      (e) =>
        e !== marker &&
        e.compaction?.startedAt !== undefined &&
        e.compaction.completedAt !== undefined &&
        e.ordinal > marker.ordinal &&
        time >= e.compaction.startedAt &&
        time <= e.compaction.completedAt,
    );
    if (matches.length === 1) {
      matches[0].parentCall = marker.key;
      matches[0].compaction!.window = marker.compaction?.window;
    }
  }
}
