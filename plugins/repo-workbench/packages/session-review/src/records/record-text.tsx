import { useEffect, useRef, useState } from 'react';
import type { TraceEvent } from '../model/contracts.ts';
import type { TextBlock } from '../model/data-source.ts';
import { presentedText } from './presentation.ts';
import { useReview } from '../app/context.tsx';
export function RichText({ text, kind = 'message' }: { text: string; kind?: string }) {
  const { state } = useReview();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.replaceChildren(
      presentedText(text, kind, state.text === 'raw' ? 'raw' : 'rendered'),
    );
  }, [text, kind, state.text]);
  return <div ref={ref} />;
}
export function RecordText({
  event,
  field = 'text',
}: {
  event: TraceEvent;
  field?: 'text' | 'output';
}) {
  const { source } = useReview();
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [offsets, setOffsets] = useState([0]);
  const [position, setPosition] = useState(0);
  const [block, setBlock] = useState<TextBlock>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const value = event[field] ?? '';
  const total = field === 'text' ? event.body?.textLength : event.body?.outputLength;
  const lazy = total !== undefined && total > value.length;
  useEffect(() => {
    if (!lazy) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, [lazy]);
  useEffect(() => {
    if (!lazy || !ready) return;
    const controller = new AbortController();
    setError('');
    setBlock(undefined);
    void source
      .text(event, field, offsets[position], controller.signal)
      .then(setBlock)
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      });
    return () => controller.abort();
  }, [event, field, lazy, ready, position, offsets, source, retry]);
  return (
    <div ref={ref} className="record-surface" aria-busy={lazy && ready && !block && !error}>
      <div className="record-scroll">
        <RichText text={block?.text ?? value} kind={field === 'output' ? 'command' : event.kind} />
      </div>
      {error ? (
        <div role="status">
          {error} <button onClick={() => setRetry(retry + 1)}>Retry loading</button>
        </div>
      ) : block && block.total > 65536 ? (
        <div className="body-pager">
          <button disabled={!position} onClick={() => setPosition(position - 1)}>
            ← Previous text block
          </button>
          <span role="status">
            {block.offset + 1}–{block.nextOffset} / {block.total}
          </span>
          <button
            disabled={block.nextOffset >= block.total}
            onClick={() => {
              setOffsets([...offsets.slice(0, position + 1), block.nextOffset]);
              setPosition(position + 1);
            }}
          >
            Next text block →
          </button>
        </div>
      ) : null}
    </div>
  );
}
