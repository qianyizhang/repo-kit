import { useState } from 'react';
import { moduleKinds, annotationKinds, type Architecture, type Module } from '../model/document';
import { request } from './api';
interface Props {
  document: Architecture;
  module: Module;
  token: string;
  edit: (document: Architecture) => void;
  enter: (id: string) => void;
  close: () => void;
}
export function Inspector({ document, module, token, edit, enter, close }: Props) {
  const [note, setNote] = useState(''),
    [target, setTarget] = useState(''),
    [label, setLabel] = useState('depends on');
  const [noteKind, setNoteKind] = useState<(typeof annotationKinds)[number]>('note');
  const [preview, setPreview] = useState<{
    path: string;
    content: string;
    truncated: boolean;
  } | null>(null);
  const [error, setError] = useState('');
  const children = document.modules.filter((m) => m.parent === module.id);
  function update(patch: Partial<Module>) {
    edit({
      ...document,
      modules: document.modules.map((m) => (m.id === module.id ? { ...m, ...patch } : m)),
    });
  }
  return (
    <aside className="inspector">
      <div className="panel-heading">
        <h2>{module.name}</h2>
        <button aria-label="Close inspector" onClick={close}>
          ×
        </button>
      </div>
      <label>
        Node type
        <select
          aria-label="Node type"
          value={module.kind}
          onChange={(e) => update({ kind: e.target.value as Module['kind'] })}
        >
          {moduleKinds.map((kind) => (
            <option key={kind}>{kind}</option>
          ))}
        </select>
      </label>
      <label>
        Name
        <input
          aria-label="Module name"
          maxLength={200}
          value={module.name}
          onChange={(e) => update({ name: e.target.value })}
        />
      </label>
      <label>
        Responsibility
        <textarea
          aria-label="Module responsibility"
          maxLength={12000}
          rows={4}
          value={module.summary}
          onChange={(e) => update({ summary: e.target.value })}
        />
      </label>
      <button className="wide enter" onClick={() => enter(module.id)}>
        Enter module <span>{children.length} internals →</span>
      </button>
      <section>
        <h3>
          Source references <span>{module.sources.length}</span>
        </h3>
        <details className="source-path-editor">
          <summary>Edit source paths</summary>
          <label className="sr-only" htmlFor="source-paths">
            Source paths, one per line
          </label>
          <textarea
            id="source-paths"
            className="source-editor"
            rows={2}
            value={module.sources.join('\n')}
            onChange={(e) => update({ sources: e.target.value.split('\n').filter(Boolean) })}
            placeholder="src/path.ts"
          />
        </details>
        {module.sources.map((path) => (
          <button
            className="source-link"
            key={path}
            title={path}
            onClick={() => {
              setError('');
              void request('source', token, {
                path,
              })
                .then(setPreview)
                .catch((e: unknown) => setError(String(e)));
            }}
          >
            ↗ {path}
          </button>
        ))}
        {error && <p role="alert">{error}</p>}
      </section>
      <section>
        <h3>Relationships</h3>
        {document.connections
          .filter((c) => c.from === module.id || c.to === module.id)
          .map((c) => (
            <div className="relation" key={c.id}>
              <span>
                {document.modules.find((m) => m.id === c.from)?.name} →{' '}
                {document.modules.find((m) => m.id === c.to)?.name}
                <small>{c.label}</small>
              </span>
              <button
                aria-label={`Remove relationship ${c.label}`}
                onClick={() =>
                  edit({
                    ...document,
                    connections: document.connections.filter((n) => n.id !== c.id),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!target || !label.trim()) return;
            edit({
              ...document,
              connections: [
                ...document.connections,
                { id: crypto.randomUUID(), from: module.id, to: target, label },
              ],
            });
            setTarget('');
          }}
        >
          <select
            aria-label="Connect to module"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">Connect to…</option>
            {document.modules
              .filter((m) => m.id !== module.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.id}
                </option>
              ))}
          </select>
          <div className="input-row">
            <input
              aria-label="Relationship label"
              maxLength={200}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <button disabled={!target} type="submit">
              Link
            </button>
          </div>
        </form>
      </section>
      <section>
        <h3>
          Annotations{' '}
          <span>{document.annotations.filter((a) => a.target === module.id).length}</span>
        </h3>
        {document.annotations
          .filter((a) => a.target === module.id)
          .map((a) => (
            <article className="annotation" key={a.id}>
              <span>
                {a.kind ?? 'note'} · {a.author === 'human' ? 'YOU' : 'CODEX'}
                <button
                  aria-label="Remove annotation"
                  onClick={() =>
                    edit({
                      ...document,
                      annotations: document.annotations.filter((n) => n.id !== a.id),
                    })
                  }
                >
                  ×
                </button>
              </span>
              <p>{a.text}</p>
            </article>
          ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!note.trim()) return;
            edit({
              ...document,
              annotations: [
                ...document.annotations,
                {
                  id: crypto.randomUUID(),
                  target: module.id,
                  text: note.trim(),
                  author: 'human',
                  kind: noteKind,
                },
              ],
            });
            setNote('');
          }}
        >
          <select
            aria-label="Annotation type"
            value={noteKind}
            onChange={(e) => setNoteKind(e.target.value as typeof noteKind)}
          >
            {annotationKinds.map((kind) => (
              <option key={kind}>{kind}</option>
            ))}
          </select>
          <textarea
            aria-label="Annotation"
            maxLength={12000}
            placeholder="Capture a decision or question…"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="wide" type="submit" disabled={!note.trim()}>
            + Add annotation
          </button>
        </form>
      </section>
      {preview && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Source preview"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setPreview(null);
          }}
        >
          <div className="source-modal">
            <header>
              <strong>{preview.path}</strong>
              <button autoFocus onClick={() => setPreview(null)}>
                Close
              </button>
            </header>
            <pre>{preview.content}</pre>
            {preview.truncated && <p>Preview truncated at 40,000 characters.</p>}
          </div>
        </div>
      )}
    </aside>
  );
}
