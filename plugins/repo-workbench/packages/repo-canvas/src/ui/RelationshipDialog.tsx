import { useEffect, useRef } from 'react';
import type { Architecture, Connection } from '../model/document';
interface Props {
  document: Architecture;
  connections: Connection[];
  edit: (document: Architecture) => void;
  close: () => void;
}
/** Exact relationships remain inspectable even when an edge represents nested modules. */
export function RelationshipDialog({ document, connections, edit, close }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="relationship-dialog"
      aria-label="Relationship"
      onCancel={close}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      <header>
        <div>
          <span className="eyebrow">MODULE CONNECTION</span>
          <h2>Explain the relationship</h2>
        </div>
        <button onClick={close} aria-label="Close relationship">
          ×
        </button>
      </header>
      {connections.map((c) => (
        <form
          key={c.id}
          onSubmit={(e) => {
            e.preventDefault();
            const fields = new FormData(e.currentTarget);
            const label = fields.get('label'),
              description = fields.get('description');
            if (typeof label !== 'string' || typeof description !== 'string') return;
            const next = {
              ...c,
              label: label.trim(),
              description: description.trim(),
            };
            if (!next.label) return;
            edit({
              ...document,
              connections: [...document.connections.filter((edge) => edge.id !== c.id), next],
            });
            close();
          }}
        >
          <p className="relationship-endpoints">
            {document.modules.find((m) => m.id === c.from)?.name} <span>→</span>{' '}
            {document.modules.find((m) => m.id === c.to)?.name}
          </p>
          <label>
            Relationship label
            <input
              name="label"
              aria-label="Relationship label"
              required
              maxLength={200}
              defaultValue={c.label}
              autoFocus
            />
          </label>
          <label>
            Explanation
            <textarea
              name="description"
              aria-label="Explanation"
              maxLength={12000}
              rows={4}
              defaultValue={c.description ?? ''}
              placeholder="What crosses this connection, and why does the dependency exist?"
            />
          </label>
          <p className="muted">
            Use a precise verb such as calls, reads, publishes, or shares geometry. Connections stay
            attached as modules move.
          </p>
          <footer>
            {document.connections.some((edge) => edge.id === c.id) && (
              <button
                type="button"
                onClick={() => {
                  edit({
                    ...document,
                    connections: document.connections.filter((edge) => edge.id !== c.id),
                  });
                  close();
                }}
              >
                Remove connection
              </button>
            )}
            <button className="primary" type="submit">
              Save relationship
            </button>
          </footer>
        </form>
      ))}
    </dialog>
  );
}
