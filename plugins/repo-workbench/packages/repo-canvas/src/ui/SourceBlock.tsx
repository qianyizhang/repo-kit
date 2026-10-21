import { useEffect, useState } from 'react';
import hljs from 'highlight.js/lib/common';
import type { Architecture } from '../model/document';
import type { Output } from '../model/contracts';
import { request } from './api';
function Code({ content, path, start = 1 }: { content: string; path: string; start?: number }) {
  const extension = path.split('.').at(-1) ?? '';
  const language =
    (
      {
        tsx: 'typescript',
        ts: 'typescript',
        jsx: 'javascript',
        js: 'javascript',
        mjs: 'javascript',
        py: 'python',
        md: 'markdown',
        sh: 'bash',
      } as Record<string, string>
    )[extension] ?? extension;
  const escaped = (text: string) =>
    text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return (
    <pre className="source-code">
      <code>
        {content
          .replace(/\n$/, '')
          .split('\n')
          .map((line, i) => (
            <span className="code-line" key={i}>
              <span className="line-number">{start + i}</span>
              <span
                dangerouslySetInnerHTML={{
                  __html: hljs.getLanguage(language)
                    ? hljs.highlight(line, { language, ignoreIllegals: true }).value
                    : escaped(line),
                }}
              />
            </span>
          ))}
      </code>
    </pre>
  );
}
export function SourceBlock({
  reference,
  token,
  document,
  onReferenceChange,
}: {
  reference: string;
  token: string;
  document: Architecture;
  onReferenceChange: (next: string) => void;
}) {
  const [source, setSource] = useState<Output<'source'> | null>(null),
    [error, setError] = useState(''),
    [draft, setDraft] = useState<string | null>(null),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  async function load() {
    setError('');
    try {
      const next = await request('source', token, { path: reference });
      setSource(next);
      setDraft(null);
      setReview(false);
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    let active = true;
    void request('source', token, { path: reference })
      .then((next) => {
        if (active) {
          setSource(next);
          setDraft(null);
          setReview(false);
        }
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [reference, token]);
  async function save() {
    if (!source || draft === null) return;
    setBusy(true);
    setError('');
    try {
      const saved = await request('source_save', token, {
        reference,
        revision: source.revision,
        content: draft,
        document,
      });
      if (saved.reference !== reference) onReferenceChange(saved.reference);
      setNotice('Source file saved. Reference changes remain in the map draft.');
      setDraft(null);
      setReview(false);
      setSource(await request('source', token, { path: saved.reference }));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="source-block">
      <header>
        <code>{reference}</code>
        {draft === null ? (
          <button
            disabled={!source || source.truncated}
            onClick={() => {
              setDraft(source!.content);
              setNotice('');
            }}
          >
            Edit source
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={() => {
              setDraft(null);
              setReview(false);
            }}
          >
            Cancel edit
          </button>
        )}
      </header>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => void load()}>Reload source</button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {source &&
        (draft === null ? (
          <>
            <Code content={source.content} path={source.path} start={source.startLine} />
            {source.truncated && <p>Preview truncated. Reference a smaller line block to edit.</p>}
          </>
        ) : review ? (
          <>
            <p>
              Review replacement · lines {source.startLine}–{source.endLine}. Only this block is
              written.
            </p>
            <div className="source-diff">
              <section>
                <h4>Before −</h4>
                <Code content={source.content} path={source.path} start={source.startLine} />
              </section>
              <section>
                <h4>After +</h4>
                <Code content={draft} path={source.path} start={source.startLine} />
              </section>
            </div>
            <button disabled={busy} onClick={() => setReview(false)}>
              Back to editing
            </button>
            <button className="primary" disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save source file'}
            </button>
          </>
        ) : (
          <>
            <label>
              Referenced block
              <textarea
                className="source-editor"
                aria-label="Edit source block"
                rows={16}
                maxLength={40000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </label>
            <button disabled={draft === source.content} onClick={() => setReview(true)}>
              Review diff
            </button>
          </>
        ))}
    </section>
  );
}
