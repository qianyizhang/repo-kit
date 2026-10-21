import { useState } from 'react';
import {
  annotationKinds,
  severities,
  sameTarget,
  type Annotation,
  type Architecture,
  type Target,
} from '../model/document';
export function Notes({
  document,
  target,
  edit,
  comment,
}: {
  document: Architecture;
  target: Target;
  edit: (d: Architecture) => void;
  comment: (t: Target) => void;
}) {
  const [basis, setBasis] = useState<string | undefined>(),
    [error, setError] = useState('');
  const [draft, setDraft] = useState<Annotation | null>(null);
  const notes = document.annotations.filter((a) => sameTarget(a.target, target));
  return (
    <section className="notes">
      {error && <p role="alert">{error}</p>}
      <div className="note-list">
        {notes
          .filter((note) => note.id !== draft?.id)
          .map((note) => (
            <article
              key={note.id}
              className={`note-card ${note.severity ?? 'info'}`}
              onContextMenu={(e) => {
                e.preventDefault();
                comment({ kind: 'annotation', id: note.id });
              }}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.shiftKey && e.key === 'F10') {
                  e.preventDefault();
                  comment({ kind: 'annotation', id: note.id });
                }
              }}
            >
              <header>
                <b>
                  {note.severity ?? 'info'}
                  {note.kind && note.kind !== 'note' ? ` · ${note.kind}` : ''}
                </b>
                <small>{note.author === 'human' ? 'YOU' : 'AGENT'}</small>
              </header>
              <p>{note.text}</p>
              <footer>
                <button
                  onClick={() => {
                    setBasis(JSON.stringify(note));
                    setError('');
                    setDraft({ ...note });
                  }}
                >
                  Edit note
                </button>
                <button
                  onClick={() =>
                    edit({
                      ...document,
                      annotations: document.annotations.filter((a) => a.id !== note.id),
                    })
                  }
                >
                  Remove note
                </button>
                <button
                  aria-label="Comment on note"
                  onClick={() => comment({ kind: 'annotation', id: note.id })}
                >
                  ⋯
                </button>
              </footer>
            </article>
          ))}
      </div>
      {!notes.length && !draft && <p className="muted">No notes on this object.</p>}
      {draft ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (JSON.stringify(document.annotations.find((n) => n.id === draft.id)) !== basis) {
              setError('This note changed while you were editing. Copy your edits and reopen it.');
              return;
            }
            edit({
              ...document,
              annotations: document.annotations.some((a) => a.id === draft.id)
                ? document.annotations.map((a) => (a.id === draft.id ? draft : a))
                : [...document.annotations, draft],
            });
            setDraft(null);
          }}
        >
          <label>
            Severity
            <select
              aria-label="Note severity"
              value={draft.severity ?? 'info'}
              onChange={(e) =>
                setDraft({ ...draft, severity: e.target.value as Annotation['severity'] })
              }
            >
              {severities.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Intent
            <select
              aria-label="Note intent"
              value={draft.kind ?? 'note'}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as Annotation['kind'] })}
            >
              {annotationKinds.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Note
            <textarea
              aria-label="Note text"
              rows={4}
              maxLength={12000}
              required
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            />
          </label>
          <button type="button" onClick={() => setDraft(null)}>
            Cancel
          </button>
          <button type="submit" disabled={!draft.text.trim()}>
            Apply note
          </button>
        </form>
      ) : (
        <button
          onClick={() => {
            setBasis(undefined);
            setError('');
            setDraft({
              id: crypto.randomUUID(),
              target,
              text: '',
              author: 'human',
              kind: 'note',
              severity: 'info',
            });
          }}
        >
          Add note
        </button>
      )}
    </section>
  );
}
