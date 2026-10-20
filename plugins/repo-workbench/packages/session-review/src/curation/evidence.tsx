import { useEffect, useState, type ReactNode } from 'react';
import type {
  Artifact,
  Episode,
  EvidenceRef,
  ResolvedRef,
  ReviewAssessment,
  TraceEvent,
} from '../model/contracts.ts';
import { useReview } from '../app/context.tsx';
import { RecordBody } from '../records/record-body.tsx';
import { RichText } from '../records/record-text.tsx';
import { Drawer } from '../app/ui.tsx';
export type Inspection =
  | { kind: 'event'; event: TraceEvent }
  | { kind: 'assessment'; assessment: ReviewAssessment }
  | { kind: 'artifact'; artifact: Artifact }
  | { kind: 'source'; episode: Episode }
  | { kind: 'refs'; title: string; refs: ResolvedRef[] };
export type Inspect = (item: Inspection | null) => void;
export function Evidence({
  reference,
  inspect,
}: {
  reference: EvidenceRef | ResolvedRef;
  inspect: Inspect;
}) {
  const { eventMap, state, update } = useReview();
  const key =
    'key' in reference
      ? reference.key
      : JSON.stringify([reference.thread, reference.turn, reference.event]);
  const e = eventMap.get(key);
  if (!e) return null;
  return (
    <button
      className="evidence-row"
      data-event-key={key}
      aria-pressed={state.event === key}
      onClick={() => {
        update({ event: key, assessment: '' });
        inspect({ kind: 'event', event: e });
      }}
    >
      <span className="kind">{(reference.roles ?? [reference.role]).join(' · ')}</span>
      <span className="small">
        {e.role} · {e.kind === 'command' ? 'Command & output' : e.title}
      </span>
      <span className="excerpt">{e.preview.slice(0, 190)}</span>
    </button>
  );
}
export function Figure({
  episode,
  subject,
  angle = 'hero',
  label,
  inspect,
}: {
  episode?: Episode;
  subject: string;
  angle?: string;
  label: string;
  inspect: Inspect;
}) {
  const { document } = useReview();
  const [failed, setFailed] = useState(false);
  const capture = episode?.captures.find((c) => c.subject === subject && c.angle === angle);
  useEffect(() => setFailed(false), [capture?.url]);
  const artifact = document.curation?.artifacts.find(
    (a) => a.stageId === episode?.id && a.subject === subject,
  );
  return (
    <figure>
      <div className="image-box">
        {capture && !failed ? (
          <img
            src={capture.url}
            alt={`${subject}, ${angle}, ${episode?.title ?? 'Unknown revision'}`}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <p>
            {failed
              ? 'Capture unavailable at this path.'
              : `No retained ${angle} capture of ${subject} for this revision.`}
          </p>
        )}
      </div>
      <figcaption>
        <span className="small">{label}</span>
        <strong>{episode?.title ?? 'No earlier capture'}</strong>
        {artifact && (
          <button onClick={() => inspect({ kind: 'artifact', artifact })}>Artifact identity</button>
        )}
        {capture && (
          <a href={capture.url} target="_blank" rel="noreferrer">
            Open full capture ↗
          </a>
        )}
      </figcaption>
    </figure>
  );
}
export function AssessmentButton({
  assessment: a,
  inspect,
  compact = false,
}: {
  assessment: ReviewAssessment;
  inspect: Inspect;
  compact?: boolean;
}) {
  const { update, document } = useReview();
  return (
    <button
      data-assessment={a.id}
      onClick={() => {
        const episode = document.curation?.episodes.find((s) =>
          s.assessments.some((x) => x.id === a.id),
        );
        update({
          assessment: a.id,
          event: '',
          ...(episode ? { episode: episode.id, stage: episode.index } : {}),
        });
        inspect({ kind: 'assessment', assessment: a });
      }}
    >
      {compact
        ? `${a.assessment.replaceAll('_', ' ')} · ${a.basis.replaceAll('_', ' ')}`
        : `${a.subject} / ${a.criterion}: ${a.assessment.replaceAll('_', ' ')}`}
    </button>
  );
}
export function InspectionDrawer({
  item,
  inspect,
  episode,
  subject,
}: {
  item: Inspection;
  inspect: Inspect;
  episode?: Episode;
  subject: string;
}) {
  const { document, state, update } = useReview();
  const artifacts = document.curation?.artifacts ?? [];
  const artifact =
    item.kind === 'artifact'
      ? item.artifact
      : item.kind === 'assessment'
        ? artifacts.find((a) => a.id === item.assessment.artifactId)
        : artifacts.find((a) => a.stageId === episode?.id && a.subject === subject);
  const capture = artifact?.captures.find((c) => c.angle === 'hero') ?? artifact?.captures[0];
  const title =
    item.kind === 'event'
      ? `${item.event.kind} · ${item.event.role}`
      : item.kind === 'assessment'
        ? `${item.assessment.criterion} · ${item.assessment.assessment.replaceAll('_', ' ')}`
        : item.kind === 'artifact'
          ? 'Artifact · ' + item.artifact.subject
          : item.kind === 'source'
            ? 'Retained source · ' + item.episode.title
            : item.title;
  let content: ReactNode;
  if (item.kind === 'event')
    content = (
      <>
        <RecordBody event={item.event} />
        <button
          onClick={() => {
            const e = item.event;
            inspect(null);
            update({
              view: 'events',
              event: e.key,
              session: 'all',
              actionTurn: 'all',
              scope: 'all',
              evidenceRole: 'all',
              kind: 'all',
              search: '',
              page: 0,
              reviews: state.reviews || e.kind === 'auto-review',
            });
          }}
        >
          Open exact recorded action
        </button>
        {episode && episode.sources.length > 0 && (
          <button onClick={() => inspect({ kind: 'source', episode })}>
            Retained source / diff
          </button>
        )}
      </>
    );
  else if (item.kind === 'assessment') {
    const a = item.assessment;
    content = (
      <>
        <p>
          {a.subject} · {a.actor} · {a.basis.replaceAll('_', ' ')} assessment
        </p>
        <p>{a.note}</p>
        <p className="provenance">Artifact revision: {a.artifactId}</p>
        {artifact && (
          <button onClick={() => inspect({ kind: 'artifact', artifact })}>
            Inspect artifact identity
          </button>
        )}
        <h3>Supporting evidence</h3>
        {a.evidence.length ? (
          a.evidence.map((r) => <Evidence key={r.key} reference={r} inspect={inspect} />)
        ) : (
          <p className="warning">
            No supporting event recorded. This cell describes an explicit record limit, not an
            inferred result.
          </p>
        )}
      </>
    );
  } else if (item.kind === 'refs')
    content = item.refs.map((r) => <Evidence key={r.key} reference={r} inspect={inspect} />);
  else if (item.kind === 'source')
    content = (
      <>
        <p className="small">
          Same-episode retained snapshots; exact source-to-render pairing is unknown.
        </p>
        {item.episode.sources.map((f) => (
          <details key={f.sourceKey}>
            <summary>{f.sourceKey}</summary>
            <p className="provenance">
              {f.path} · SHA-256 {f.sha256}
            </p>
            <h3>Changes from previous retained snapshot</h3>
            <RichText
              text={f.diff?.text ?? 'No earlier snapshot for this source key.'}
              kind="edit"
            />
            <details>
              <summary>Full retained source</summary>
              <RichText text={f.text} kind="command" />
            </details>
          </details>
        ))}
      </>
    );
  else {
    const a = item.artifact;
    content = (
      <>
        <p className="provenance">{a.id}</p>
        <p className="warning">{a.limits.join(' ')}</p>
        <p>
          Source pairing: {a.provenance.sourcePairing}; camera{' '}
          {a.provenance.cameraKnown ? 'documented' : 'unknown'}; lighting{' '}
          {a.provenance.lightingKnown ? 'documented' : 'unknown'}.
        </p>
        {a.captures.map((c) => (
          <p key={c.path}>
            <a href={c.url}>
              {c.angle} · {c.path}
            </a>
            <span className="provenance"> SHA-256 {c.sha256}</span>
          </p>
        ))}
        {a.sources.map((f) => (
          <p key={f.path} className="provenance">
            {f.path} · Key {f.sourceKey} · SHA-256 {f.sha256}
          </p>
        ))}
        {(['producedBy', 'inspectedBy'] as const).map((key) => (
          <section key={key}>
            <h3>
              {key === 'producedBy' ? 'Associated production records' : 'Associated inspections'}
            </h3>
            {a[key].map((r) => (
              <Evidence key={r.key} reference={r} inspect={inspect} />
            ))}
            {!a[key].length && <p>No exact event attached.</p>}
          </section>
        ))}
      </>
    );
  }
  return (
    <Drawer
      title={title}
      close={() => {
        inspect(null);
        update({ event: '', assessment: '' });
      }}
      artifact={
        artifact && (
          <>
            {capture && (
              <img
                src={capture.url}
                alt={`${artifact.subject}, ${document.curation?.episodes[artifact.stageIndex]?.title}`}
              />
            )}
            <p className="small">{document.curation?.episodes[artifact.stageIndex]?.title}</p>
          </>
        )
      }
    >
      {content}
    </Drawer>
  );
}
