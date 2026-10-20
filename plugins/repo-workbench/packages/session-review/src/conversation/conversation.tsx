import { TurnMetadata } from '../records/metadata.tsx';
import { SignalFilter } from '../actions/signal-filter.tsx';
import { useEffect, useMemo, useRef } from 'react';
import type { RecordedTurn, TraceEvent } from '../model/contracts.ts';
import { useReview } from '../app/context.tsx';
import { AgentOptions, Help, Pager } from '../app/ui.tsx';
import { ActionCard } from '../actions/action-card.tsx';
import { RecordBody } from '../records/record-body.tsx';
import { RecordText, RichText } from '../records/record-text.tsx';
import { actionKind, recordType } from '../model/actions.ts';
import { Minimap } from '../actions/minimap.tsx';
const size = 20;
function response(turn: RecordedTurn, visible: (event: TraceEvent) => boolean) {
  const messages = turn.events.filter(
    (e) => visible(e) && e.kind === 'message' && e.title !== 'Recorded message',
  );
  return (
    messages.findLast(
      (e) => e.messagePhase === 'final_answer' || e.title === 'Completion report',
    ) ?? messages.at(-1)
  );
}
function overviewText(event: TraceEvent) {
  const objective =
    event.kind === 'goal'
      ? /<objective>([\s\S]*?)(?:<\/objective>|$)/.exec(event.preview)?.[1]
      : undefined;
  const prose = (objective ?? event.preview).split(/\n\s*<[A-Za-z][\w:.-]*(?:\s[^>]*)?>/)[0].trim();
  return prose || event.title;
}
function contextRecord(event: TraceEvent) {
  return (
    event.title === 'Recorded message' ||
    (event.kind === 'request' &&
      /^# AGENTS\.md instructions for [^\n]+\n\s*<INSTRUCTIONS>/.test(event.text))
  );
}
function TurnPair({ turn, full = false }: { turn: RecordedTurn; full?: boolean }) {
  const { visible } = useReview();
  const requests = turn.events.filter(
    (e) => visible(e) && !contextRecord(e) && ['request', 'goal', 'auto-review'].includes(e.kind),
  );
  const answer = response(turn, visible);
  const final = answer?.messagePhase === 'final_answer' || answer?.title === 'Completion report';
  return (
    <>
      <section>
        <h3>
          {requests[0]?.kind === 'goal'
            ? 'Goal continuation'
            : requests[0]?.kind === 'auto-review'
              ? 'Approval review'
              : 'User request'}
        </h3>
        {!requests.length && <p className="small">Request not recorded.</p>}
        {(full ? requests : requests.slice(0, 1)).map((e, i) => (
          <div key={e.key}>
            {i > 0 && <h3>Further user message {i}</h3>}
            {full ? <RecordText event={e} /> : <RichText text={overviewText(e)} kind={e.kind} />}
          </div>
        ))}
        {!full && requests.length > 1 && (
          <p className="small">+{requests.length - 1} further user messages</p>
        )}
      </section>
      <section>
        <h3>{final ? 'Assistant response · final' : 'Last recorded response'}</h3>
        {answer ? (
          full ? (
            <RecordText event={answer} />
          ) : (
            <RichText text={overviewText(answer)} />
          )
        ) : (
          <p className="small">Assistant message not recorded.</p>
        )}
        {!final && <p className="small">Final status unavailable.</p>}
      </section>
    </>
  );
}
export function Conversation() {
  const { state, update, turns, matchesAgent, visible, actions, turnNumber } = useReview();
  const all = turns.filter((t) => matchesAgent(t.threadId, state.thread) && t.events.some(visible));
  const chosen = all.find((t) => t.id === state.turn);
  const list = useRef<HTMLDivElement>(null);
  const answer = chosen && response(chosen, visible);
  const work = useMemo(
    () =>
      chosen
        ? actions.filter(
            (a) =>
              a.anchor.threadId === chosen.threadId &&
              a.anchor.turnId === chosen.id &&
              !['request', 'goal', 'auto-review'].includes(a.anchor.kind) &&
              a.anchor !== answer &&
              !contextRecord(a.anchor) &&
              (state.reviews || a.anchor.kind !== 'auto-review'),
          )
        : [],
    [chosen, actions, answer, state.reviews],
  );
  const filteredWork = useMemo(
    () =>
      work.filter(
        (a) =>
          (state.type === 'all' ||
            actionKind(a) === state.type ||
            a.records.some((e) => recordType(e) === state.type)) &&
          (state.signal === 'all' || a.signals.some((signal) => signal === state.signal)),
      ),
    [work, state.type, state.signal],
  );
  const filter = (type: string) => update({ type: state.type === type ? 'all' : type, event: '' });
  const openTurn = (turn: string) => {
    update({ turn });
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    if (state.event)
      document
        .getElementById('turn-record-' + encodeURIComponent(state.event))
        ?.scrollIntoView({ block: 'start' });
  }, [state.event, state.turn]);
  if (chosen) {
    const index = all.indexOf(chosen);
    return (
      <section id="conversation">
        <div id="turn-detail">
          <div className="section-heading">
            <button onClick={() => update({ turn: '', event: '' })}>← Conversation overview</button>
            <div className="actions">
              <button disabled={!index} onClick={() => openTurn(all[index - 1].id)}>
                ← Previous turn
              </button>
              <button
                disabled={index >= all.length - 1}
                onClick={() => openTurn(all[index + 1].id)}
              >
                Next turn →
              </button>
            </div>
          </div>
          <h2 id="turn-title">Turn {turnNumber(chosen.threadId, chosen.id)}</h2>
          <TurnMetadata turn={chosen} />
          <SignalFilter
            actions={work}
            value={state.signal}
            change={(signal) => update({ signal, event: '' })}
          />
          <div id="turn-pair" className="conversation-pair">
            <TurnPair turn={chosen} full />
          </div>
          {chosen.events.some(contextRecord) && (
            <details className="session-context">
              <summary>
                Session context ({chosen.events.filter(contextRecord).length} records)
              </summary>
              {chosen.events.filter(contextRecord).map((e) => (
                <RecordBody key={e.key} event={e} />
              ))}
            </details>
          )}
          <div className="section-heading">
            <h3>Work in this turn</h3>
            <label>
              Type
              <select
                id="turn-kind"
                value={state.type}
                onChange={(e) => update({ type: e.target.value, event: '' })}
              >
                <option value="all">All types</option>
                {[
                  ...new Set(work.flatMap((a) => [actionKind(a), ...a.records.map(recordType)])),
                ].map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="action-layout">
            <Minimap
              id="turn-minimap"
              actions={filteredWork}
              scope={work}
              list={list}
              kind={state.type}
              filter={filter}
              jump={(a) => update({ event: a.key })}
            />
            <div id="turn-work" ref={list}>
              {filteredWork.map((a) => (
                <ActionCard
                  key={a.key}
                  action={a}
                  prefix="turn-record-"
                  selected={a.records.some((e) => e.key === state.event)}
                  filter={filter}
                />
              ))}
              {!filteredWork.length && <p className="empty">No intervening work recorded.</p>}
            </div>
          </div>
        </div>
        <span id="conversation-count" hidden />
      </section>
    );
  }
  const query = state.query.trim().toLowerCase();
  const filtered = all.filter((t) =>
    [
      ...t.events
        .filter((e) => visible(e) && ['request', 'goal', 'auto-review'].includes(e.kind))
        .map((e) => e.text),
      response(t, visible)?.text ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(query),
  );
  const page = Math.min(state.turnPage, Math.max(0, Math.ceil(filtered.length / size) - 1));
  return (
    <section id="conversation">
      <div className="controls">
        <label>
          Agent
          <select
            id="conversation-thread"
            value={state.thread}
            onChange={(e) => update({ thread: e.target.value })}
          >
            <AgentOptions />
          </select>
        </label>
        <label className="search-label">
          Find a request or response{' '}
          <Help label="About conversation search">
            Filters turns by words in indexed request and response previews. Large record bodies
            load on demand.
          </Help>
          <input
            value={state.query}
            onChange={(e) => update({ query: e.target.value, turnPage: 0 })}
          />
        </label>
      </div>
      <p id="conversation-count" className="small">
        {filtered.length} of {all.length} recorded turns · page {filtered.length ? page + 1 : 0} /{' '}
        {Math.ceil(filtered.length / size)}
      </p>
      <div id="conversation-list">
        {filtered.slice(page * size, (page + 1) * size).map((t) => (
          <article
            key={JSON.stringify([t.threadId, t.id])}
            className="conversation-card"
            onClick={(event) => {
              if (
                !(event.target as HTMLElement).closest('a, button, input, summary, details') &&
                !window.getSelection()?.toString()
              )
                openTurn(t.id);
            }}
          >
            <div className="section-heading">
              <h2>Turn {turnNumber(t.threadId, t.id)}</h2>
              <button onClick={() => openTurn(t.id)}>Inspect turn</button>
            </div>
            <TurnMetadata turn={t} />
            <div className="conversation-pair overview">
              <TurnPair turn={t} />
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <p className="empty">No recorded turns match this request or response.</p>
      )}
      <Pager
        page={page}
        total={filtered.length}
        size={size}
        change={(turnPage) => update({ turnPage })}
        previous="← Earlier turns"
        next="Later turns →"
      />
    </section>
  );
}
