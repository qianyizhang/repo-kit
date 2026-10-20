import { useEffect, useState } from 'react';
import type { TraceEvent } from '../model/contracts.ts';
import { actionKind, actionDescription, type TraceAction } from '../model/actions.ts';
import { duration } from '../records/metadata.tsx';
import { signalLabels } from '../model/signals.ts';
import { useReview } from '../app/context.tsx';
import { RecordBody, RecordedImages } from '../records/record-body.tsx';
import { QuestionExchange } from '../records/native-records.tsx';
import { SourceSequence } from './source-sequence.tsx';
export function ActionCard({
  action,
  selected = false,
  prefix = 'record-',
  filter,
  inspect,
}: {
  action: TraceAction;
  selected?: boolean;
  prefix?: string;
  filter: (kind: string) => void;
  inspect?: (event: TraceEvent) => void;
}) {
  const { label, document, turnNumber } = useReview();
  const e = action.anchor,
    kind = actionKind(action);
  const imageResults = action.results.filter(
    (r) => (r.body?.imageCount ?? r.imageUrls?.length ?? 0) > 0,
  );
  const [open, setOpen] = useState(selected || (kind === 'image' && imageResults.length > 0));
  const shells = action.executions.filter((r) =>
    /\/CommandExecution$/.test(r.sourceType ?? ''),
  ).length;
  const mcp = action.executions.filter((r) => /\/McpToolCall$/.test(r.sourceType ?? '')).length;
  const end = action.results.at(-1)?.timestamp;
  const elapsed = action.executions.length === 1 ? action.executions[0].durationMs : undefined;
  const span =
    e.durationMs ??
    (e.timestamp && end ? Date.parse(end) - Date.parse(e.timestamp) : undefined) ??
    elapsed;
  useEffect(() => {
    if (selected) setOpen(true);
  }, [selected]);
  return (
    <article
      id={prefix + encodeURIComponent(action.key)}
      data-event-key={action.key}
      className={'event trace-action' + (selected ? ' selected-event' : '')}
    >
      <div className="event-meta">
        <span
          className={
            'session-badge ' +
            (e.threadId === document.threads[0]?.id ? 'session-main' : 'session-child')
          }
          title={e.threadId}
        >
          {label(e.threadId)}
        </span>
        <span>Turn {turnNumber(e.threadId, e.turnId)}</span>
        <span
          className="source-positions"
          title={action.records
            .map(
              (r) =>
                `${r.sourcePath ?? r.threadId}:${r.sourceLine ?? r.ordinal}${r.callId ? ' · ' + r.callId : ''}`,
            )
            .join('\n')}
        >
          #{action.records.map((r) => r.sourceLine ?? r.ordinal).join(', ')}
        </span>
        {action.signals.map((signal) => (
          <span className="action-signal" key={signal}>
            {signalLabels[signal]}
          </span>
        ))}
        {action.executions.length > 1 && (
          <span
            className="batch-count"
            title="Counts recorded native executions, not model round trips."
          >
            {action.anchor.parallelCalls === action.executions.length
              ? `${action.executions.length} parallel tool calls`
              : action.anchor.sequentialCalls === action.executions.length
                ? `${action.executions.length} sequential tool calls`
                : `${action.executions.length} tool executions`}
            {shells > 0 && mcp > 0 ? ` · ${shells} shell + ${mcp} MCP` : ''}
          </span>
        )}
        {kind === 'ask' && (
          <span className="question-reply-marker">
            {action.results.some(
              (r) => r.questionResult?.answers && Object.keys(r.questionResult.answers).length,
            )
              ? 'User replied'
              : 'No linked reply'}
          </span>
        )}
        <span className="action-metadata">
          {e.timestamp && (
            <time dateTime={e.timestamp} title={e.timestamp}>
              {new Date(e.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </time>
          )}
          {span !== undefined && span >= 0 && (
            <span title="Recorded action elapsed time">{duration(span)}</span>
          )}
          {action.executions.some((r) => r.exitCode != null && r.exitCode !== 0) && (
            <span className="warning">Nonzero exit</span>
          )}
        </span>
      </div>
      <details open={open} onToggle={(ev) => setOpen(ev.currentTarget.open)}>
        <summary className="action-summary">
          <button
            className={'type-badge type-' + kind}
            aria-label={'Filter ' + kind + ' records'}
            onClick={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              filter(kind);
            }}
          >
            {kind === 'ask' ? 'ask user' : kind === 'code-mode' ? 'code mode' : kind}
          </button>
          <span className="action-description">{actionDescription(action)}</span>
        </summary>
        {imageResults.length > 0 && action.executions.some((r) => r.kind === 'image') && (
          <div className="image-gallery">
            {imageResults.map((result) => (
              <RecordedImages
                key={result.key}
                event={result}
                captions={action.executions
                  .filter((r) => r.kind === 'image')
                  .flatMap((r) => r.paths)}
              />
            ))}
          </div>
        )}
        {kind === 'ask' ? (
          <>
            <QuestionExchange action={action} />
            <details className="tool-wrapper">
              <summary>Question source and tool acknowledgement</summary>
              {action.records.map((r) => (
                <RecordBody key={r.key} event={r} />
              ))}
            </details>
          </>
        ) : kind === 'compaction' ? (
          <RecordBody event={e} />
        ) : action.executions.length ? (
          <>
            {action.executions
              .filter((execution) => !(imageResults.length && execution.kind === 'image'))
              .map((execution) => (
                <section className="execution-pair" key={execution.key}>
                  {action.executions.length > 1 && (
                    <h3 className="execution-label">
                      {execution.threadRead ? 'Read chat' : execution.title}
                    </h3>
                  )}
                  {execution.exitCode != null && (
                    <p
                      className={
                        execution.exitCode ? 'warning execution-status' : 'small execution-status'
                      }
                    >
                      Exit {execution.exitCode}
                      {execution.durationMs !== undefined
                        ? ' · ' + duration(execution.durationMs)
                        : ''}
                    </p>
                  )}
                  <RecordBody event={execution} />
                </section>
              ))}
            {action.records.some((r) => !action.executions.includes(r)) && (
              <details className="tool-wrapper">
                <summary>Tool wrapper</summary>
                {action.records
                  .filter((r) => !action.executions.includes(r))
                  .map((r) => (
                    <RecordBody
                      key={r.key}
                      event={r}
                      images={
                        !imageResults.length || !action.executions.some((r) => r.kind === 'image')
                      }
                    />
                  ))}
              </details>
            )}
          </>
        ) : (
          <>
            <RecordBody event={e} />
            {action.results
              .filter((r) => r !== e)
              .map((r) => (
                <RecordBody
                  key={r.key}
                  event={r}
                  images={
                    !imageResults.length || !action.executions.some((r) => r.kind === 'image')
                  }
                />
              ))}
          </>
        )}
        <SourceSequence action={action} />
      </details>
      {inspect && <button onClick={() => inspect(e)}>Inspect evidence</button>}
    </article>
  );
}
