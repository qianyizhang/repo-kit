import { useState } from 'react';
import type { TraceEvent, ThreadRead } from '../model/contracts.ts';
import { useReview } from '../app/context.tsx';
import { RecordText, RichText } from './record-text.tsx';
import { WebResult } from './native-records.tsx';
export function RecordBody({ event: e, images = true }: { event: TraceEvent; images?: boolean }) {
  const { source, state } = useReview();
  const [imagesOpen, setImagesOpen] = useState(false);
  return (
    <>
      {e.sourceTruncated && (
        <p className="warning">Source truncated upstream. Expanding cannot recover omitted text.</p>
      )}
      {e.paths.length > 0 && <p className="provenance">{e.paths.join(' · ')}</p>}
      {e.web && state.text !== 'raw' ? (
        <>
          <WebResult event={e} />
          <details className="tool-wrapper">
            <summary>Complete web input and result</summary>
            <RecordText event={e} />
            <RecordText event={e} field="output" />
          </details>
        </>
      ) : e.threadRead && state.text !== 'raw' ? (
        <>
          <ThreadReadOverview value={e.threadRead} />
          <details className="tool-wrapper">
            <summary>Complete tool input and result</summary>
            <RecordText event={e} />
            <RecordText event={e} field="output" />
          </details>
        </>
      ) : (
        <>
          {e.text !== 'Recorded tool result' && <RecordText event={e} />}
          {e.output !== undefined && <RecordText event={e} field="output" />}
        </>
      )}
      {images &&
        e.imageUrls
          ?.filter((url) => /^data:image\/(png|jpeg|webp|gif);base64,/.test(url))
          .map((url, i) => (
            <img key={i} src={url} alt="Image retained in this trace record" loading="lazy" />
          ))}
      {images && e.body && e.body.imageCount > 0 && (
        <details onToggle={(ev) => setImagesOpen(ev.currentTarget.open)}>
          <summary>Recorded images ({e.body.imageCount})</summary>
          {imagesOpen &&
            Array.from({ length: e.body.imageCount }, (_, i) => (
              <img
                key={i}
                src={source.image(e, i)}
                alt="Image retained in this trace record"
                loading="lazy"
                onError={(ev) => {
                  ev.currentTarget.alt =
                    'Image unavailable; reopen the trace if the source changed.';
                }}
              />
            ))}
        </details>
      )}
      {e.relatedThreads
        .filter((id) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))
        .map((id) => (
          <a key={id} href={'codex://threads/' + encodeURIComponent(id)}>
            Open related chat · {id.slice(0, 8)} ↗
          </a>
        ))}
    </>
  );
}
export function RecordedImages({ event, captions }: { event: TraceEvent; captions: string[] }) {
  const { source } = useReview();
  const urls = event.body
    ? Array.from({ length: event.body.imageCount }, (_, i) => source.image(event, i))
    : (event.imageUrls ?? []).filter((url) => /^data:image\/(png|jpeg|webp|gif);base64,/.test(url));
  return (
    <>
      {urls.map((url, index) => (
        <figure key={index}>
          <a href={url} target="_blank" rel="noreferrer" title="Open retained image">
            <img
              src={url}
              alt={
                urls.length === 1 && captions.length === 1
                  ? captions[0].split('/').at(-1)
                  : `Retained image ${index + 1}`
              }
              loading="lazy"
              onError={(ev) => {
                ev.currentTarget.alt =
                  'Retained image unavailable; reopen the trace if its source changed.';
              }}
            />
          </a>
          <figcaption>
            {urls.length === 1 && captions.length === 1
              ? captions[0].split('/').slice(-2).join('/')
              : `Retained image ${index + 1}`}
          </figcaption>
        </figure>
      ))}
      {captions.length > 1 && (
        <p
          className="gallery-paths provenance"
          title="Inspection paths in source order; the tool can emit images in a different order."
        >
          Inspected paths: {captions.map((path) => path.split('/').slice(-2).join('/')).join(' · ')}
        </p>
      )}
    </>
  );
}

function ThreadReadOverview({ value }: { value: ThreadRead }) {
  return (
    <section className="thread-read">
      <div className="section-heading">
        <h3>{value.title}</h3>
        <span className="small">
          {value.status} · {value.turns.length} returned{' '}
          {value.turns.length === 1 ? 'turn' : 'turns'}
        </span>
      </div>
      {/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value.id) && (
        <a href={'codex://threads/' + value.id}>Open source chat ↗</a>
      )}
      {(value.hasMore || value.limited) && (
        <p className="small">
          Partial overview. More content is available in the complete tool result or source chat.
        </p>
      )}
      {value.turns.map((turn, index) => (
        <section key={turn.id || index} className="read-turn">
          <p className="small">
            Returned turn {index + 1} · {turn.status} · {turn.activities} recorded activities
          </p>
          <div className="conversation-pair">
            <section>
              <h3>User input</h3>
              {turn.request ? (
                <RichText text={turn.request} />
              ) : (
                <p className="small">Input not included in this result.</p>
              )}
            </section>
            <section>
              <h3>{turn.final ? 'Assistant response' : 'Last recorded response'}</h3>
              {turn.response ? (
                <RichText text={turn.response} />
              ) : (
                <p className="small">Response not included in this result.</p>
              )}
            </section>
          </div>
        </section>
      ))}
    </section>
  );
}
