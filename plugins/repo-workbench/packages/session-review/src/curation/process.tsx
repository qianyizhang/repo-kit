import type { Episode } from '../model/contracts.ts';
import { useReview } from '../app/context.tsx';
import type { Inspect } from './evidence.tsx';
const roleGroups = [
  { title: 'Request', roles: ['request', 'feedback', 'plan'] },
  { title: 'Action', roles: ['action', 'edit', 'artifact'] },
  { title: 'Inspection', roles: ['inspection', 'verification'] },
  { title: 'Assessment / handoff', roles: ['assessment', 'handoff'] },
];
export function Process({ inspect }: { inspect: Inspect }) {
  const { document, state, update } = useReview();
  const curation = document.curation!;
  const subjects = (s: Episode) =>
    curation.artifacts.filter((a) => a.stageId === s.id).map((a) => a.subject);
  const selected = curation.episodes.filter(
    (s) =>
      (state.subject === 'all' || subjects(s).includes(state.subject)) &&
      (!state.lessons || s.lesson?.trim()) &&
      [s.title, s.status, s.question, s.change, s.finding, s.lesson, ...subjects(s)]
        .join(' ')
        .toLowerCase()
        .includes(state.find.trim().toLowerCase()),
  );
  const download = () => {
    const lines = [
      `# ${document.title} — learning notes`,
      '',
      'Authored interpretations, not automatic root-cause findings or new verification. Keep these notes with the accompanying trace bundle.',
      '',
    ];
    for (const s of selected) {
      const link = (event?: string) =>
        './index.html#' +
        new URLSearchParams({
          episode: s.id,
          view: 'story',
          ...(event ? { event } : {}),
        }).toString();
      lines.push(
        `## ${s.title}`,
        '',
        `Status: ${s.status ?? 'Unrecorded'}`,
        '',
        `Request: ${s.question ?? 'Not authored.'}`,
        '',
        `Change: ${s.change ?? 'Not authored.'}`,
        '',
        `Finding: ${s.finding ?? 'Not authored.'}`,
        '',
        `Lesson: ${s.lesson ?? 'Not authored.'}`,
        '',
        `Limits: ${s.limits?.join(' ') ?? 'Consult source coverage.'}`,
        '',
        `[Open episode](${link()})`,
        '',
        ...s.evidence.map(
          (r) => `- [${r.roles.join(', ')}](${link(r.key)}) — ${r.thread} / ${r.turn} / ${r.event}`,
        ),
        '',
      );
    }
    const url = URL.createObjectURL(
      new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }),
    );
    const a = window.document.createElement('a');
    a.href = url;
    a.download = 'learning-notes.md';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section id="process">
      <div className="controls">
        <label className="search-label">
          Find an episode or lesson
          <input value={state.find} onChange={(e) => update({ find: e.target.value })} />
        </label>
        <label>
          Subject
          <select value={state.subject} onChange={(e) => update({ subject: e.target.value })}>
            <option value="all">All subjects</option>
            {[...new Set(curation.artifacts.map((a) => a.subject))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Show episodes
          <select
            value={state.lessons ? 'lessons' : 'all'}
            onChange={(e) => update({ lessons: e.target.value === 'lessons' })}
          >
            <option value="all">All episodes</option>
            <option value="lessons">With lessons</option>
          </select>
        </label>
        <button disabled={!selected.length} onClick={download}>
          Download learning notes
        </button>
      </div>
      <p id="process-count" className="small">
        {selected.length} of {curation.episodes.length} curated episodes · authored order
      </p>
      <div id="process-list">
        {selected.map((s) => (
          <article key={s.id} className="process-card">
            <p className="small">
              Episode {s.index + 1} · {subjects(s).join(', ')} · {s.status}
            </p>
            <h2>{s.title}</h2>
            <p>{s.question}</p>
            <div className="process-roles">
              {roleGroups.map((group) => {
                const refs = s.evidence.filter((r) =>
                  r.roles.some((role) => group.roles.includes(role)),
                );
                return (
                  <button
                    key={group.title}
                    disabled={!refs.length}
                    onClick={() => {
                      update({ episode: s.id, stage: s.index, event: '' });
                      inspect({ kind: 'refs', title: s.title + ' · ' + group.title, refs });
                    }}
                  >
                    {group.title}
                    <small>{refs.length} linked records</small>
                  </button>
                );
              })}
            </div>
            <div className="explanation">
              <section>
                <h3>Change</h3>
                <p>{s.change}</p>
              </section>
              <section>
                <h3>Finding</h3>
                <p>{s.finding}</p>
              </section>
            </div>
            {s.lesson && <p className="lesson">{s.lesson}</p>}
            <button
              onClick={() => {
                inspect(null);
                update({ view: 'story', episode: s.id, stage: s.index, event: '' });
              }}
            >
              Open episode
            </button>
          </article>
        ))}
        {!selected.length && (
          <p>No curated episodes match. Clear the search or choose another subject.</p>
        )}
      </div>
    </section>
  );
}
