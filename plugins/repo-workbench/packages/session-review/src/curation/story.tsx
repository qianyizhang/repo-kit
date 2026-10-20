import type { Episode } from '../model/contracts.ts';
import { useReview } from '../app/context.tsx';
import { Figure, Evidence, AssessmentButton, type Inspect } from './evidence.tsx';
export function Story({
  episode: s,
  subject,
  setSubject,
  inspect,
}: {
  episode: Episode;
  subject: string;
  setSubject: (subject: string) => void;
  inspect: Inspect;
}) {
  const { document, state, update } = useReview();
  const episodes = document.curation!.episodes;
  const subjects = [
    ...new Set([
      ...s.captures.map((c) => c.subject),
      ...document.curation!.artifacts.filter((a) => a.stageId === s.id).map((a) => a.subject),
    ]),
  ];
  const previous = episodes
    .slice(0, s.index)
    .findLast((x) => x.captures.some((c) => c.subject === subject && c.angle === 'hero'));
  const choose = (s: Episode) => {
    update({ episode: s.id, stage: s.index, event: '', assessment: '' });
    inspect(null);
  };
  return (
    <section id="story" className="story-layout">
      <aside className="episode-rail">
        <h2>Episodes</h2>
        <div id="steps">
          {episodes.map((e) => (
            <button
              key={e.id}
              className="step"
              aria-current={e.id === s.id ? 'step' : undefined}
              onClick={() => choose(e)}
            >
              <span className="small">{e.index + 1}</span> {e.title}
            </button>
          ))}
        </div>
      </aside>
      <div className="story-content">
        <div className="section-heading">
          <span id="stage-status" className="small">
            {s.status}
          </span>
          <span className="small">
            {s.index + 1} / {episodes.length}
          </span>
        </div>
        <h2 id="stage-title">{s.title}</h2>
        <p id="question">{s.question}</p>
        <label>
          Stage subject
          <select id="story-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {subjects.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <div id="story-images" className="image-pair">
          {s.comparison === 'roundtrip' ? (
            <>
              <Figure
                episode={s}
                subject={subject}
                angle="roundtrip-live"
                label="Live model · neutral lighting"
                inspect={inspect}
              />
              <Figure
                episode={s}
                subject={subject}
                angle="roundtrip-exported"
                label="Reloaded GLB · same lighting"
                inspect={inspect}
              />
            </>
          ) : (
            <>
              <Figure
                episode={previous}
                subject={subject}
                label="Earlier retained revision"
                inspect={inspect}
              />
              <Figure episode={s} subject={subject} label="This revision" inspect={inspect} />
            </>
          )}
        </div>
        <div className="explanation">
          <section>
            <h3>Change</h3>
            <p id="change">{s.change}</p>
          </section>
          <section>
            <h3>Finding</h3>
            <p id="finding">{s.finding}</p>
          </section>
        </div>
        {s.lesson && (
          <p id="lesson" className="lesson">
            {s.lesson}
          </p>
        )}
        <div id="story-assessments" className="actions">
          {s.assessments.map((a) => (
            <AssessmentButton key={a.id} assessment={a} inspect={inspect} />
          ))}
        </div>
        <details id="ownership">
          <summary>Ownership / handoff</summary>
          {s.actors.map((a, i) => (
            <p key={i}>
              {a.role.replaceAll('_', ' ')} ·{' '}
              {document.threads.find((t) => t.id === a.threadId)?.role}: {a.contribution}
            </p>
          ))}
          {new Set(s.evidence.map((r) => r.thread)).size > 1 && (
            <p className="small">Concurrent / exact interleaving unavailable.</p>
          )}
        </details>
        <p className="small">{s.limits?.join(' ')}</p>
        <div id="signals">
          {s.signals.map((signal, i) => (
            <details key={i}>
              <summary>Thing to inspect: {signal.note}</summary>
              {signal.evidence.map((r) => (
                <Evidence key={r.key} reference={r} inspect={inspect} />
              ))}
            </details>
          ))}
        </div>
        <h3>Episode evidence</h3>
        <div id="episode-evidence">
          {s.evidence.slice(0, 6).map((r) => (
            <Evidence key={r.key} reference={r} inspect={inspect} />
          ))}
          {s.evidence.length > 6 && (
            <details>
              <summary>Show {s.evidence.length - 6} more episode records</summary>
              {s.evidence.slice(6).map((r) => (
                <Evidence key={r.key} reference={r} inspect={inspect} />
              ))}
            </details>
          )}
        </div>
        <details id="recorded-quote" key={s.id}>
          <summary>Read the recorded statement behind this stage</summary>
          <blockquote id="quote">{s.quote}</blockquote>
        </details>
        <div className="actions">
          <button
            onClick={() =>
              update({
                view: 'events',
                scope: s.id,
                event: JSON.stringify([s.anchorRef.thread, s.anchorRef.turn, s.anchorRef.event]),
                session: 'all',
                actionTurn: 'all',
                kind: 'all',
                search: '',
                evidenceRole: 'all',
              })
            }
          >
            Inspect this episode’s actions
          </button>
          <button onClick={() => update({ view: 'sources' })}>
            Inspect retained source changes
          </button>
          <a href={'codex://threads/' + s.threadId}>Open source chat ↗</a>
        </div>
        <div className="pager">
          <button disabled={!s.index} onClick={() => choose(episodes[s.index - 1])}>
            ← Previous episode
          </button>
          <button
            disabled={s.index >= episodes.length - 1}
            onClick={() => choose(episodes[s.index + 1])}
          >
            Next episode →
          </button>
        </div>
        <span hidden>{state.episode}</span>
      </div>
    </section>
  );
}
