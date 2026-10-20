import { useCallback, useMemo, useSyncExternalStore } from 'react';
export type View = 'conversation' | 'events' | 'process' | 'story' | 'compare' | 'sources';
export interface ReviewState {
  view: View;
  thread: string;
  turn: string;
  query: string;
  turnPage: number;
  type: string;
  text: string;
  reviews: boolean;
  order: string;
  session: string;
  actionTurn: string;
  kind: string;
  signal: string;
  search: string;
  scope: string;
  evidenceRole: string;
  event: string;
  page: number;
  episode: string;
  stage: number;
  assessment: string;
  find: string;
  subject: string;
  lessons: boolean;
}
function readState(hash: string, curated: boolean, firstThread: string): ReviewState {
  const q = new URLSearchParams(hash.slice(1));
  const number = (key: string) => Math.max(0, Number(q.get(key)) || 0);
  const view = q.get('view') as View;
  return {
    view: [
      'conversation',
      'events',
      'sources',
      ...(curated ? ['process', 'story', 'compare'] : []),
    ].includes(view)
      ? view
      : curated
        ? 'story'
        : 'conversation',
    thread: q.get('thread') ?? firstThread,
    turn: q.get('turn') ?? '',
    query: q.get('query') ?? '',
    turnPage: number('turnPage'),
    type: q.get('type') ?? 'all',
    text: q.get('text') ?? 'rendered',
    reviews: q.get('reviews') === 'show',
    order: q.get('order') ?? 'session',
    session: q.get('session') ?? 'all',
    actionTurn: q.get('actionTurn') ?? 'all',
    kind: q.get('kind') ?? 'all',
    signal: q.get('signal') ?? 'all',
    search: q.get('search') ?? '',
    scope: q.get('scope') ?? 'all',
    evidenceRole: q.get('evidenceRole') ?? 'all',
    event: q.get('event') ?? '',
    page: number('page'),
    episode: q.get('episode') ?? '',
    stage: number('stage'),
    assessment: q.get('assessment') ?? '',
    find: q.get('find') ?? '',
    subject: q.get('subject') ?? 'all',
    lessons: q.get('lessons') === 'true',
  };
}

/** Related selections reset together; explicit destination values win over resets. */
function transition(
  prior: ReviewState,
  patch: Partial<ReviewState>,
  firstThread: string,
): ReviewState {
  const reset: Partial<ReviewState> = {};
  const has = (key: keyof ReviewState) => key in patch;
  if (has('reviews'))
    Object.assign(reset, {
      session: prior.session === '__reviews__' ? 'all' : prior.session,
      thread: prior.thread === '__reviews__' ? firstThread : prior.thread,
      kind: prior.kind === 'auto-review' ? 'all' : prior.kind,
      turn: '',
      actionTurn: 'all',
      event: '',
      assessment: '',
      page: 0,
      turnPage: 0,
    });

  if (has('thread'))
    Object.assign(reset, { turn: '', turnPage: 0, type: 'all', signal: 'all', event: '' });
  if (has('session')) Object.assign(reset, { actionTurn: 'all', page: 0, event: '' });
  if (has('turn')) Object.assign(reset, { type: 'all', signal: 'all', event: '' });
  if (has('actionTurn')) Object.assign(reset, { page: 0, event: '' });
  if (['kind', 'search', 'signal', 'scope', 'evidenceRole', 'order'].some((key) => key in patch))
    Object.assign(reset, { page: 0, event: '' });
  if (has('type')) reset.event = '';
  if (has('query')) reset.turnPage = 0;
  if (['view', 'episode', 'stage'].some((key) => key in patch))
    Object.assign(reset, { event: '', assessment: '' });
  return { ...prior, ...reset, ...patch };
}
function fragment(state: ReviewState) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (key === 'reviews') {
      if (value) q.set(key, 'show');
    } else if (
      value !== '' &&
      value !== false &&
      value !== 'all' &&
      value !== 0 &&
      value !== 'rendered'
    ) {
      q.set(key, String(value));
    }
  }
  return '#' + q.toString();
}
const changed = 'review-state-change';
function subscribe(restore: () => void) {
  window.addEventListener('popstate', restore);
  window.addEventListener('hashchange', restore);
  window.addEventListener(changed, restore);
  return () => {
    window.removeEventListener('popstate', restore);
    window.removeEventListener('hashchange', restore);
    window.removeEventListener(changed, restore);
  };
}
const snapshot = () => location.hash;
export function useReviewState(curated: boolean, firstThread: string) {
  // The URL is the single owner. Rendering and state calculation never write browser history.
  const hash = useSyncExternalStore(subscribe, snapshot);
  const state = useMemo(() => readState(hash, curated, firstThread), [hash, curated, firstThread]);
  const update = useCallback(
    (patch: Partial<ReviewState>) => {
      const prior = readState(location.hash, curated, firstThread);
      const next = transition(prior, patch, firstThread);
      const target = fragment(next);
      if (target === fragment(prior)) return;
      const navigation = (['view', 'turn', 'actionTurn', 'episode', 'stage'] as const).some(
        (key) => key in patch && next[key] !== prior[key],
      );
      if (navigation) history.pushState(null, '', target);
      else history.replaceState(null, '', target);
      window.dispatchEvent(new Event(changed));
    },
    [curated, firstThread],
  );
  return [state, update] as const;
}
