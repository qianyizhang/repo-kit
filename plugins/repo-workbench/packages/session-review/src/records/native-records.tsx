import type { TraceAction } from '../model/actions.ts';
import type { TraceEvent } from '../model/contracts.ts';
export function QuestionExchange({ action }: { action: TraceAction }) {
  const questions = action.records.find((r) => r.questions?.length)?.questions ?? [];
  const result = action.results.find((r) => r.questionResult)?.questionResult;
  const answers = result?.answers ?? {};
  return (
    <section className="question-exchange" aria-label="Question and user reply">
      {questions.map((q, index) => (
        <div key={index}>
          <h3>{q.title}</h3>
          {q.options.length > 0 && (
            <ul className="question-options">
              {q.options.map((o, i) => (
                <li key={i}>
                  {o.label}
                  {o.description && <p className="small">{o.description}</p>}
                </li>
              ))}
            </ul>
          )}
          {answers[q.id] && (
            <div className="user-answer">
              <strong>User reply</strong>
              <p>{answers[q.id].join(' · ')}</p>
            </div>
          )}
        </div>
      ))}
      {Object.entries(answers)
        .filter(([id]) => !questions.some((q) => q.id === id))
        .map(([id, values]) => (
          <div className="user-answer" key={id}>
            <strong>User reply · {id}</strong>
            <p>{values.join(' · ')}</p>
          </div>
        ))}
      {!Object.keys(answers).length && (
        <p className="reply-status">
          <strong>No linked user reply recorded</strong>
          <br />
          {result?.delivered === true
            ? 'Question delivered. The acknowledgement confirms delivery, not a user selection.'
            : result?.delivered === false
              ? 'Question delivery was not accepted.'
              : 'No answer is attached to this question in the available trace.'}
        </p>
      )}
    </section>
  );
}
export function WebResult({ event }: { event: TraceEvent }) {
  const web = event.web!;
  return (
    <section className="web-results" aria-label="Web operation">
      <p>{web.query || event.title}</p>
      {web.results.map((r, i) => (
        <div key={i}>
          {/^https?:\/\//.test(r.url) ? (
            <a href={r.url} target="_blank" rel="noreferrer">
              {r.title || r.url} ↗
            </a>
          ) : (
            <strong>{r.title}</strong>
          )}
          {r.snippet && <p className="small">{r.snippet}</p>}
        </div>
      ))}
    </section>
  );
}
