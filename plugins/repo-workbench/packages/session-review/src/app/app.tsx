import { useCallback, useEffect, useState } from 'react';
import { useReview } from './context.tsx';
import { Conversation } from '../conversation/conversation.tsx';
import { ActionView } from '../actions/action-view.tsx';
import { InspectionDrawer, type Inspection } from '../curation/evidence.tsx';
import { Story } from '../curation/story.tsx';
import { Process } from '../curation/process.tsx';
import { Compare } from '../curation/compare.tsx';
import { Sources } from './sources.tsx';
import type { View } from './state.ts';
function Coverage() {
  const { document, state, visible, events, turns } = useReview();
  const regular = document.threads.filter((t) => t.purpose !== 'auto-review');
  const active = state.reviews ? document.threads : regular;
  const unsupported = active.reduce(
    (n, t) => n + t.coverage.unsupportedItems.reduce((n, g) => n + g.count, 0),
    0,
  );
  const metrics = [
    [
      `${regular.length} sessions`,
      'The main conversation and child agent conversations. Auto-review sessions are counted separately.',
    ],
    [
      `${turns.filter((t) => t.events.some(visible)).length} turns`,
      'Each turn begins with a request and can contain messages, tool calls and results.',
    ],
    [
      `${events.filter(visible).length} records`,
      'Indexed observable records. Linked inputs and outputs appear together as one action.',
    ],
    ...(unsupported
      ? [
          [
            `${unsupported} unsupported`,
            'Unrecognized source types. Their identities and counts appear in Source & provenance.',
          ],
        ]
      : []),
    ...(state.reviews
      ? [
          [
            `${document.threads.length - regular.length} review sessions`,
            'Automatic approval-review conversations.',
          ],
        ]
      : []),
  ];
  return (
    <div id="coverage-summary">
      {metrics.map(([label, tip]) => (
        <span key={label} className="help-target" tabIndex={0}>
          {label}
          <span role="tooltip" className="tooltip">
            {tip}
          </span>
        </span>
      ))}
    </div>
  );
}
export function App() {
  const { document: data, state, update, eventMap } = useReview();
  const [copied, setCopied] = useState('');
  const curation = data.curation;
  const episode =
    curation?.episodes.find((s) => s.id === state.episode) ??
    curation?.episodes[state.stage] ??
    curation?.episodes[0];
  const defaultSubject =
    episode?.subject ??
    episode?.captures[0]?.subject ??
    curation?.artifacts.find((a) => a.stageId === episode?.id)?.subject ??
    '';
  const [subject, setSubject] = useState(defaultSubject);
  useEffect(() => setSubject(defaultSubject), [defaultSubject, episode?.id]);
  const readInspection = useCallback((): Inspection | null => {
    if (!curation) return null;
    const query = new URLSearchParams(location.hash.slice(1));
    const event = eventMap.get(query.get('event') ?? '');
    const assessment = curation.episodes
      .flatMap((s) => s.assessments)
      .find((a) => a.id === query.get('assessment'));
    return assessment
      ? { kind: 'assessment', assessment }
      : event
        ? { kind: 'event', event }
        : null;
  }, [curation, eventMap]);
  const [inspection, setInspection] = useState(readInspection);
  useEffect(() => {
    document.title = curation ? data.title : data.threads[0]?.id.slice(0, 8) + ' · Session review';
  }, [curation, data]);
  useEffect(() => {
    // Browser traversal restores URL-owned evidence. In-page inspection also supports local artifacts.
    const restore = () => setInspection(readInspection());
    window.addEventListener('popstate', restore);
    window.addEventListener('hashchange', restore);
    return () => {
      window.removeEventListener('popstate', restore);
      window.removeEventListener('hashchange', restore);
    };
  }, [readInspection]);
  const tabs: Array<[View, string]> = [
    ['conversation', 'Conversation'],
    ...(curation
      ? ([
          ['process', 'Process map'],
          ['story', 'Creation story'],
          ['compare', 'Compare revisions'],
        ] as Array<[View, string]>)
      : []),
    ['events', 'Recorded actions'],
    ['sources', 'Source & provenance'],
  ];
  return (
    <>
      <header className="app-header">
        <div className="header-title">
          <span className="eyebrow">SESSION REVIEW</span>
          <h1 id="title" aria-label={curation ? undefined : data.threads[0]?.id.slice(0, 8)}>
            {curation ? (
              data.title
            ) : (
              <button
                className="copy-id"
                aria-label="Copy full session ID"
                title={data.threads[0]?.id}
                onClick={() => {
                  void navigator.clipboard
                    .writeText(data.threads[0]?.id ?? '')
                    .then(() => setCopied('Copied'))
                    .catch(() => setCopied('Copy unavailable'));
                }}
              >
                {data.threads[0]?.id.slice(0, 8)}
              </button>
            )}
          </h1>
          <span role="status" className="small">
            {copied}
          </span>
          {data.delivery && <a href="/">← Usage dashboard</a>}
        </div>
        <Coverage />
        <div className="display-controls">
          <label>
            <input
              role="switch"
              type="checkbox"
              checked={state.text === 'raw'}
              onChange={(e) => update({ text: e.target.checked ? 'raw' : 'rendered' })}
            />
            Raw text
          </label>
          <label>
            <input
              type="checkbox"
              checked={state.reviews}
              onChange={(e) => {
                setInspection(null);
                update({ reviews: e.target.checked });
              }}
            />
            Show auto-review
          </label>
        </div>
      </header>
      <nav className="tabs" aria-label="Review views">
        {tabs.map(([view, label]) => (
          <button
            key={view}
            data-tab={view}
            aria-pressed={state.view === view}
            onClick={() => {
              setInspection(null);
              update({ view });
              window.scrollTo({ top: 0 });
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <main>
        <div hidden={state.view !== 'conversation'}>
          <Conversation />
        </div>
        <div hidden={state.view !== 'events'}>
          <ActionView
            inspect={(event) => {
              update({ event: event.key });
              setInspection({ kind: 'event', event });
            }}
          />
        </div>
        {curation && episode && (
          <>
            <div hidden={state.view !== 'story'}>
              <Story
                episode={episode}
                subject={subject}
                setSubject={setSubject}
                inspect={setInspection}
              />
            </div>
            <div hidden={state.view !== 'process'}>
              <Process inspect={setInspection} />
            </div>
            <div hidden={state.view !== 'compare'}>
              <Compare episode={episode} subject={subject} inspect={setInspection} />
            </div>
          </>
        )}
        <div hidden={state.view !== 'sources'}>
          <Sources episode={episode} />
        </div>
      </main>
      {inspection && (
        <InspectionDrawer
          item={inspection}
          inspect={setInspection}
          episode={episode}
          subject={subject}
        />
      )}
      <footer>Local review · recorded evidence and authored interpretation stay distinct.</footer>
    </>
  );
}
