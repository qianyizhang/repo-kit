import { useEffect, useState } from 'react';
import type { Episode } from '../model/contracts.ts';
import { useReview } from '../app/context.tsx';
import { Figure, AssessmentButton, type Inspect } from './evidence.tsx';
export function Compare({
  episode,
  subject: initialSubject,
  inspect,
}: {
  episode: Episode;
  subject: string;
  inspect: Inspect;
}) {
  const { document, state } = useReview();
  const { episodes, artifacts } = document.curation!;
  const [subject, setSubject] = useState(initialSubject);
  const [angle, setAngle] = useState('hero');
  const available = episodes.filter((s) =>
    artifacts.some((a) => a.stageId === s.id && a.subject === subject),
  );
  const [before, setBefore] = useState(available[0]?.index ?? 0);
  const [after, setAfter] = useState(episode.index);
  useEffect(() => {
    if (state.assessment) {
      const a = episodes.flatMap((s) => s.assessments).find((a) => a.id === state.assessment);
      if (a) setSubject(a.subject);
      setAfter(episode.index);
    }
  }, [state.assessment, episode.index, episodes]);
  const chooseSubject = (subject: string) => {
    setSubject(subject);
    const list = episodes.filter((s) =>
      artifacts.some((a) => a.stageId === s.id && a.subject === subject),
    );
    setBefore(list[0]?.index ?? 0);
    setAfter(list.at(-1)?.index ?? 0);
  };
  const criteria = [
    ...new Set(
      available.flatMap((s) =>
        s.assessments.filter((a) => a.subject === subject).map((a) => a.criterion),
      ),
    ),
  ];
  return (
    <section id="compare">
      <div className="controls">
        <label>
          Subject
          <select id="subject" value={subject} onChange={(e) => chooseSubject(e.target.value)}>
            {[...new Set(artifacts.map((a) => a.subject))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {(['Before', 'After'] as const).map((label) => (
          <label key={label}>
            {label}
            <select
              id={label.toLowerCase()}
              value={label === 'Before' ? before : after}
              onChange={(e) => (label === 'Before' ? setBefore : setAfter)(Number(e.target.value))}
            >
              {available.map((s) => (
                <option key={s.id} value={s.index}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          View
          <select value={angle} onChange={(e) => setAngle(e.target.value)}>
            {[
              ...new Set([
                'hero',
                'front',
                'back',
                'side',
                'close',
                ...episodes.flatMap((s) => s.captures.map((c) => c.angle)),
              ]),
            ].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>
      <div id="compare-images" className="image-pair">
        <Figure
          episode={episodes[before]}
          subject={subject}
          angle={angle}
          label="Before"
          inspect={inspect}
        />
        <Figure
          episode={episodes[after]}
          subject={subject}
          angle={angle}
          label="After"
          inspect={inspect}
        />
      </div>
      <div id="criterion-matrix" className="table-scroll">
        <table>
          <caption>{subject}: recorded assessments across revisions</caption>
          <thead>
            <tr>
              <th>Criterion</th>
              {available.map((s) => (
                <th key={s.id}>{s.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {criteria.map((criterion) => (
              <tr key={criterion}>
                <th scope="row">{criterion}</th>
                {available.map((s) => (
                  <td key={s.id}>
                    {s.assessments
                      .filter((a) => a.subject === subject && a.criterion === criterion)
                      .map((a) => (
                        <AssessmentButton key={a.id} assessment={a} inspect={inspect} compact />
                      ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
