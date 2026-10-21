import { useState } from 'react';
import type { Architecture, Group } from '../model/document';
export function GroupEditor({
  document,
  scope,
  edit,
  close,
}: {
  document: Architecture;
  scope: string;
  edit: (d: Architecture) => void;
  close: () => void;
}) {
  const [basis] = useState(() => JSON.stringify(document));
  const stale = JSON.stringify(document) !== basis;
  const [draft, setDraft] = useState<Group>({
    id: crypto.randomUUID(),
    scope,
    name: '',
    description: '',
    members: [],
  });
  const existing = document.groups ?? [];
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Groups">
      <form
        className="add-modal"
        onSubmit={(e) => {
          e.preventDefault();
          if (stale) return;
          edit({
            ...document,
            groups: existing.some((g) => g.id === draft.id)
              ? existing.map((g) => (g.id === draft.id ? draft : g))
              : [...existing, draft],
          });
          close();
        }}
      >
        <header>
          <h2>Groups in this scope</h2>
          <button type="button" onClick={close}>
            Close
          </button>
        </header>
        {stale && (
          <p role="alert">The map changed. Close and reopen Groups before applying changes.</p>
        )}
        <p>
          Groups reference sibling nodes. Membership can overlap and never changes their parent or
          position.
        </p>
        <select
          aria-label="Edit group"
          value={existing.some((g) => g.id === draft.id) ? draft.id : ''}
          onChange={(e) =>
            setDraft(
              structuredClone(
                existing.find((g) => g.id === e.target.value) ?? {
                  id: crypto.randomUUID(),
                  scope,
                  name: '',
                  description: '',
                  members: [],
                },
              ),
            )
          }
        >
          <option value="">New group</option>
          {existing
            .filter((g) => g.scope === scope)
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </select>
        <label>
          Name
          <input
            required
            maxLength={200}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label>
          Short description
          <textarea
            rows={2}
            maxLength={1000}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </label>
        <div className="group-members">
          {document.modules
            .filter((m) => m.parent === scope)
            .map((m) => (
              <label key={m.id}>
                <input
                  type="checkbox"
                  checked={draft.members.includes(m.id)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      members: e.target.checked
                        ? [...draft.members, m.id]
                        : draft.members.filter((id) => id !== m.id),
                    })
                  }
                />
                {m.name}
              </label>
            ))}
        </div>
        <footer>
          {existing.some((g) => g.id === draft.id) && (
            <button
              type="button"
              disabled={stale}
              onClick={() => {
                if (stale) return;
                edit({ ...document, groups: existing.filter((g) => g.id !== draft.id) });
                close();
              }}
            >
              Remove group
            </button>
          )}
          <button
            className="primary"
            disabled={stale || !draft.members.length || !draft.name.trim()}
            type="submit"
          >
            Apply group
          </button>
        </footer>
      </form>
    </div>
  );
}
