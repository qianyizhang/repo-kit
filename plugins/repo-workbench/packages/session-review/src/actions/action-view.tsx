import { SignalFilter } from './signal-filter.tsx';
import { TurnMetadata } from '../records/metadata.tsx';
import { useEffect, useMemo, useRef } from 'react';
import type { TraceEvent } from '../model/contracts.ts';
import { useReview } from '../app/context.tsx';
import { ActionCard } from './action-card.tsx';
import { actionKind } from '../model/actions.ts';
import { Minimap } from './minimap.tsx';
import { AgentOptions, Pager } from '../app/ui.tsx';
const size = 35;
const turnKey = (thread: string, turn: string) => JSON.stringify([thread, turn]);
export function ActionView({ inspect }: { inspect: (event: TraceEvent) => void }) {
  const {
    document: data,
    state,
    update,
    actions,
    visible,
    matchesAgent,
    turns,
    label,
    turnNumber,
  } = useReview();
  const episode =
    data.curation?.episodes.find((s) => s.id === state.episode) ??
    data.curation?.episodes[state.stage];
  const list = useRef<HTMLDivElement>(null);
  const eligibleTurns = turns.filter(
    (t) => matchesAgent(t.threadId, state.session) && t.events.some(visible),
  );
  const position = eligibleTurns.findIndex((t) => turnKey(t.threadId, t.id) === state.actionTurn);
  const chooseTurn = (position: number) => {
    const t = eligibleTurns[position - 1];
    update({ actionTurn: t ? turnKey(t.threadId, t.id) : 'all' });
  };
  const scope = useMemo(() => {
    const episode = data.curation?.episodes.find((s) => s.id === state.scope);
    const query = state.search.toLowerCase();
    const result = actions.filter(
      (a) =>
        a.records.some(
          (e) =>
            state.reviews ||
            (e.kind !== 'auto-review' &&
              data.threads.find((t) => t.id === e.threadId)?.purpose !== 'auto-review'),
        ) &&
        matchesAgent(a.anchor.threadId, state.session) &&
        (state.actionTurn === 'all' ||
          turnKey(a.anchor.threadId, a.anchor.turnId) === state.actionTurn) &&
        a.records.some((e) =>
          `${e.title}\n${e.text}\n${e.output ?? ''}\n${e.callId ?? ''}`
            .toLowerCase()
            .includes(query),
        ) &&
        (!episode ||
          a.records.some((e) =>
            episode.evidence.some(
              (r) =>
                r.key === e.key &&
                (state.evidenceRole === 'all' || r.roles.includes(state.evidenceRole)),
            ),
          )) &&
        (state.evidenceRole === 'all' ||
          data.curation?.episodes.some((s) =>
            s.evidence.some(
              (r) => r.roles.includes(state.evidenceRole) && a.records.some((e) => e.key === r.key),
            ),
          )),
    );
    const order = (a: (typeof actions)[number], b: (typeof actions)[number]) =>
      data.threads.findIndex((t) => t.id === a.anchor.threadId) -
        data.threads.findIndex((t) => t.id === b.anchor.threadId) ||
      (a.anchor.sourceLine ?? a.anchor.ordinal) - (b.anchor.sourceLine ?? b.anchor.ordinal);
    return result.sort(
      state.order === 'time'
        ? (a, b) => {
            const delta =
              (a.anchor.timestamp ? Date.parse(a.anchor.timestamp) : Infinity) -
              (b.anchor.timestamp ? Date.parse(b.anchor.timestamp) : Infinity);
            return (Number.isNaN(delta) ? 0 : delta) || order(a, b);
          }
        : order,
    );
  }, [
    data,
    matchesAgent,
    actions,
    state.reviews,
    state.session,
    state.actionTurn,
    state.search,
    state.scope,
    state.evidenceRole,
    state.order,
  ]);
  const filtered = useMemo(
    () =>
      scope.filter(
        (a) =>
          (state.kind === 'all' || actionKind(a) === state.kind) &&
          (state.signal === 'all' || a.signals.some((signal) => signal === state.signal)),
      ),
    [scope, state.kind, state.signal],
  );
  const selected = filtered.findIndex((a) => a.records.some((e) => e.key === state.event));
  const page = Math.min(
    selected >= 0 ? Math.floor(selected / size) : state.page,
    Math.max(0, Math.ceil(filtered.length / size) - 1),
  );
  const filter = (kind: string) =>
    update({ kind: state.kind === kind ? 'all' : kind, page: 0, event: '' });
  useEffect(() => {
    if (selected >= 0)
      document
        .getElementById('record-' + encodeURIComponent(filtered[selected].key))
        ?.scrollIntoView({ block: 'start' });
  }, [state.event, selected, filtered]);
  return (
    <section id="events">
      <SignalFilter
        actions={scope}
        value={state.signal}
        change={(signal) => update({ signal, page: 0, event: '' })}
      />
      <div className="controls">
        <label>
          Agent
          <select
            id="thread-filter"
            value={state.session}
            onChange={(e) => update({ session: e.target.value })}
          >
            <AgentOptions all />
          </select>
        </label>
        <label className="search-label">
          {data.curation ? 'Search text, output or file' : 'Search record previews or file'}
          <input
            id="search"
            value={state.search}
            onChange={(e) => update({ search: e.target.value, page: 0, event: '' })}
          />
        </label>
        <label>
          {data.curation ? 'Record type' : 'Type'}
          <select
            id="kind"
            value={state.kind}
            onChange={(e) => update({ kind: e.target.value, page: 0, event: '' })}
          >
            <option value="all">All visible records</option>
            {[...new Set(actions.map(actionKind))]
              .filter((k) => state.reviews || k !== 'auto-review')
              .map((k) => (
                <option key={k}>{k}</option>
              ))}
          </select>
        </label>
        <label>
          Order
          <select
            id="event-order"
            value={state.order}
            onChange={(e) => update({ order: e.target.value, page: 0, event: '' })}
          >
            <option value="session">Session / source order</option>
            <option value="time">Recorded time</option>
          </select>
        </label>
      </div>
      <div className="turn-navigation">
        <button id="all-turns" aria-pressed={position < 0} onClick={() => chooseTurn(0)}>
          All turns
        </button>
        <button
          aria-label="Previous action turn"
          disabled={position < 0}
          onClick={() => chooseTurn(position)}
        >
          ←
        </button>
        <input
          id="turn-slider"
          aria-label="Turn"
          type="range"
          min="0"
          max={eligibleTurns.length}
          value={position + 1}
          aria-valuetext={position < 0 ? 'All turns' : `Turn ${position + 1}`}
          onChange={(e) => chooseTurn(Number(e.target.value))}
        />
        <button
          aria-label="Next action turn"
          disabled={position >= eligibleTurns.length - 1}
          onClick={() => chooseTurn(position + 2)}
        >
          →
        </button>
        <span id="turn-position">
          {position < 0
            ? `All ${eligibleTurns.length} turns`
            : `${label(eligibleTurns[position].threadId)} · Turn ${turnNumber(eligibleTurns[position].threadId, eligibleTurns[position].id)}`}
        </span>
      </div>
      {data.curation && (
        <div className="controls">
          <label>
            Evidence scope
            <select
              value={state.scope}
              onChange={(e) => update({ scope: e.target.value, page: 0, event: '' })}
            >
              <option value="all">All episodes</option>
              {data.curation.episodes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Evidence role
            <select
              value={state.evidenceRole}
              onChange={(e) => update({ evidenceRole: e.target.value, page: 0, event: '' })}
            >
              <option value="all">All evidence roles</option>
              {[
                ...new Set(
                  data.curation.episodes.flatMap((s) => s.evidence.flatMap((r) => r.roles)),
                ),
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      <p id="event-count" className="small">
        {filtered.length} actions
      </p>
      <div className="action-layout">
        <Minimap
          actions={filtered}
          scope={scope}
          list={list}
          kind={state.kind}
          filter={filter}
          jump={(a) => update({ event: a.key })}
        >
          {position >= 0 && (
            <>
              {eligibleTurns[position].startedAt === undefined && (
                <p className="small">Turn start time unknown</p>
              )}
              <TurnMetadata turn={eligibleTurns[position]} />
            </>
          )}
          {episode && <p className="small">{episode.title}</p>}
        </Minimap>
        <div>
          <div id="event-list" ref={list}>
            {filtered.slice(page * size, (page + 1) * size).map((a) => (
              <ActionCard
                key={a.key}
                action={a}
                selected={a.records.some((e) => e.key === state.event)}
                filter={filter}
                inspect={data.curation ? inspect : undefined}
              />
            ))}
            {!filtered.length && (
              <p className="empty">
                {data.curation
                  ? 'No records match these filters.'
                  : 'No actions match these filters.'}
              </p>
            )}
          </div>
          <Pager
            page={page}
            total={filtered.length}
            size={size}
            change={(page) => {
              update({ page, event: '' });
              list.current?.scrollIntoView({ block: 'start' });
            }}
          />
        </div>
      </div>
    </section>
  );
}
