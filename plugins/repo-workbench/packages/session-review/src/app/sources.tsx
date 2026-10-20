import { useEffect, useState } from 'react';
import { useReview } from './context.tsx';
import type { Episode } from '../model/contracts.ts';
import { RichText } from '../records/record-text.tsx';
export function Sources({ episode }: { episode?: Episode }) {
  const { document, source } = useReview();
  const episodes = document.curation?.episodes ?? [];
  const [stage, setStage] = useState(episode?.index ?? 0);
  const [file, setFile] = useState(0);
  const [mode, setMode] = useState('diff');
  useEffect(() => {
    setStage(episode?.index ?? 0);
    setFile(0);
  }, [episode?.index]);
  const s = episodes[stage],
    f = s?.sources[file];
  return (
    <section id="sources">
      {episodes.length > 0 && (
        <>
          <div className="controls">
            <label>
              Stage
              <select
                value={stage}
                onChange={(e) => {
                  setStage(Number(e.target.value));
                  setFile(0);
                }}
              >
                {episodes.map((s) => (
                  <option key={s.id} value={s.index}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Source file
              <select
                value={file}
                disabled={!s?.sources.length}
                onChange={(e) => setFile(Number(e.target.value))}
              >
                {s?.sources.map((f, i) => (
                  <option key={f.path} value={i}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Display
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="diff">Changes from previous snapshot</option>
                <option value="full">Full retained source</option>
              </select>
            </label>
          </div>
          <p id="source-meta" className="provenance">
            {f
              ? `${f.path}\nSource key: ${f.sourceKey}\nSHA-256 ${f.sha256}${f.diff ? '\nCompared with: ' + episodes[f.diff.fromStage].title : ''}`
              : 'No source snapshot is attached to this stage.'}
          </p>
          <div id="source-code">
            <RichText
              text={
                f
                  ? mode === 'full'
                    ? f.text
                    : (f.diff?.text ?? 'No earlier retained snapshot of this file is attached.')
                  : 'No retained source snapshot.'
              }
              kind="edit"
            />
          </div>
        </>
      )}
      <h2>Sources & coverage</h2>
      <p className="small">
        Observable records only. Private reasoning is excluded. Recorded clocks do not establish
        exact concurrent interleaving.
      </p>
      <a id="trace-manifest" href={source.manifest}>
        Open evidence manifest
      </a>
      <p id="collection" className="small">
        Collected {document.collectedAt}. Later appended records require reopening this trace.
      </p>
      <div id="threads">
        {document.threads.map((t) => (
          <details key={t.id}>
            <summary>
              {t.role} · {t.id}
            </summary>
            <a href={'codex://threads/' + t.id}>{t.title}</a>
            {t.parent && <p>Parent session: {t.parent}</p>}
            <p className="provenance">
              {t.source.path}
              <br />
              SHA-256 {t.source.sha256}
            </p>
          </details>
        ))}
      </div>
      <div id="coverage-details">
        {document.threads.map((t) => (
          <details key={t.id}>
            <summary>
              {t.role} · {t.source.name} · schema {t.source.rawSchemaVersion}
            </summary>
            <p>
              {t.coverage.normalizedItems}/{t.coverage.totalItems} items normalized;{' '}
              {t.coverage.truncatedItems} source-truncated; {t.coverage.displayTruncatedItems}{' '}
              shortened previews.
            </p>
            {(['unsupportedItems', 'excludedItems'] as const).flatMap((key) =>
              t.coverage[key].map((g) => (
                <details key={key + g.type}>
                  <summary>
                    {key === 'unsupportedItems' ? 'Unsupported' : 'Intentionally excluded'}:{' '}
                    {g.type} ×{g.count}
                  </summary>
                  <pre>
                    {g.refs
                      .map((r) => `${r.thread} / ${r.turn} / ${r.event} · ordinal ${r.ordinal}`)
                      .join('\n')}
                  </pre>
                </details>
              )),
            )}
          </details>
        ))}
      </div>
      <div id="documents">
        {document.documents.map((d) => (
          <details key={d.path}>
            <summary>{d.path} · collected document</summary>
            <p className="small">
              {d.revision
                ? `Document pinned to Git commit ${d.revision}; this is not necessarily the version at each historical stage.`
                : 'Document as collected now.'}
            </p>
            <RichText text={d.text} />
            <p className="provenance">SHA-256 {d.sha256}</p>
          </details>
        ))}
      </div>
      {document.outcome && <p id="outcome">{document.outcome}</p>}
    </section>
  );
}
