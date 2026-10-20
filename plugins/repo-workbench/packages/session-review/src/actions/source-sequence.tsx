import { useState } from 'react';
import type { TraceAction } from '../model/actions.ts';
import { useReview } from '../app/context.tsx';
const omissionLabel = (type: string) =>
  /reasoning/i.test(type)
    ? 'Private reasoning record · content excluded'
    : /token|usage/.test(type)
      ? 'Usage bookkeeping'
      : type === 'duplicate_message_envelope'
        ? 'Duplicate message envelope'
        : type;
/** Show recorded structure without retrieving or exposing excluded payloads. */
export function SourceSequence({ action }: { action: TraceAction }) {
  const { events, threads, update } = useReview();
  const [open, setOpen] = useState(false);
  const e = action.anchor,
    last = Math.max(...action.records.map((r) => r.ordinal));
  const sameTurn = events.filter((r) => r.threadId === e.threadId && r.turnId === e.turnId);
  const previous = sameTurn.filter((r) => r.ordinal < e.ordinal).at(-1)?.ordinal;
  const coverage = threads.get(e.threadId)?.coverage;
  const omissions = [
    ...(coverage?.excludedItems ?? []),
    ...(coverage?.unsupportedItems ?? []),
  ].flatMap((group) =>
    group.refs
      .filter(
        (ref) =>
          ref.turn === e.turnId && ref.ordinal > (previous ?? e.ordinal - 1) && ref.ordinal <= last,
      )
      .map((ref) => ({
        ...ref,
        type: group.type,
        unsupported: coverage?.unsupportedItems.includes(group),
      })),
  );
  const before = omissions.filter((r) => r.ordinal < e.ordinal);
  const sequence = open
    ? [
        ...sameTurn
          .filter((r) => r.ordinal >= e.ordinal && r.ordinal <= last)
          .map((record) => ({ ordinal: record.ordinal, record })),
        ...omissions.map((omission) => ({ ordinal: omission.ordinal, omission })),
      ].sort((a, b) => a.ordinal - b.ordinal)
    : [];
  const interleaved = sameTurn.some(
    (r) => r.ordinal > e.ordinal && r.ordinal < last && !action.records.includes(r),
  );
  if (action.records.length < 2 && !omissions.length) return null;
  return (
    <details className="source-sequence" onToggle={(ev) => setOpen(ev.currentTarget.open)}>
      <summary>
        Source sequence{interleaved ? ' · other activity occurred during this action' : ''}
        {before.length ? ` · ${before.length} hidden records before this step` : ''}
      </summary>
      {open && (
        <ol>
          {sequence.map((entry) => (
            <li key={entry.ordinal}>
              {'record' in entry ? (
                <>
                  <button
                    onClick={() =>
                      update({
                        view: 'events',
                        session: e.threadId,
                        actionTurn: JSON.stringify([e.threadId, e.turnId]),
                        event: entry.record.key,
                        kind: 'all',
                        signal: 'all',
                        search: '',
                        scope: 'all',
                        evidenceRole: 'all',
                      })
                    }
                  >
                    #{entry.ordinal} · {entry.record.title}
                    {!action.records.includes(entry.record) ? ' · separate action' : ''}
                  </button>
                  {entry.record.timestamp && (
                    <time dateTime={entry.record.timestamp}>
                      {entry.record.timestamp.slice(11, 23)}
                    </time>
                  )}
                </>
              ) : (
                <span className="omitted-record">
                  #{entry.ordinal} · {entry.omission.unsupported ? 'Unsupported record · ' : ''}
                  {omissionLabel(entry.omission.type)}
                  {entry.ordinal < e.ordinal ? ' · before this step' : ''}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
