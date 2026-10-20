import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { ReviewDocument, TraceEvent } from '../model/contracts.ts';
import { traceActions } from '../model/actions.ts';
import { recordSource } from '../model/data-source.ts';
import { useReviewState } from './state.ts';
function useModel(document: ReviewDocument) {
  const [state, update] = useReviewState(!!document.curation, document.threads[0]?.id ?? '');
  const index = useMemo(() => {
    const threads = new Map(document.threads.map((t) => [t.id, t]));
    const turns = document.threads.flatMap((t) => t.turns);
    const events = turns.flatMap((t) => t.events);
    return {
      threads,
      turns,
      events,
      eventMap: new Map(events.map((e) => [e.key, e])),
      actions: traceActions(events),
      source: recordSource(document),
    };
  }, [document]);
  const review = (e: TraceEvent) =>
    e.kind === 'auto-review' || index.threads.get(e.threadId)?.purpose === 'auto-review';
  const visible = (e: TraceEvent) => state.reviews || !review(e);
  const label = (id: string) =>
    `${index.threads.get(id)?.purpose === 'auto-review' ? 'Auto-review' : document.curation ? (index.threads.get(id)?.role ?? 'Session') : id === document.threads[0]?.id ? 'Main' : 'Subagent'} · ${id.slice(0, 8)}`;
  const matchesAgent = useCallback(
    (id: string, agent: string) =>
      agent === 'all' ||
      (agent === '__reviews__' ? index.threads.get(id)?.purpose === 'auto-review' : id === agent),
    [index.threads],
  );
  const turnNumber = (thread: string, turn: string) =>
    (index.threads.get(thread)?.turns.findIndex((t) => t.id === turn) ?? -1) + 1;
  return { document, state, update, ...index, visible, review, label, matchesAgent, turnNumber };
}
const Context = createContext<ReturnType<typeof useModel> | null>(null);
export function ReviewProvider({
  document,
  children,
}: {
  document: ReviewDocument;
  children: ReactNode;
}) {
  const model = useModel(document);
  return <Context value={model}>{children}</Context>;
}
export function useReview() {
  const value = useContext(Context);
  if (!value) throw new Error('Missing review context');
  return value;
}
