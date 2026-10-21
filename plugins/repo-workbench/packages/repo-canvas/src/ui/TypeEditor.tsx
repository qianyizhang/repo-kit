import { useState } from 'react';
import {
  moduleKinds,
  fieldKinds,
  surfaces,
  parseDocument,
  parseNodeTypes,
  type Architecture,
  type NodeType,
} from '../model/document';
import { migrateTypes, typeChanges } from '../model/type-changes';
export function TypeEditor({
  document,
  edit,
  close,
}: {
  document: Architecture;
  edit: (d: Architecture) => void;
  close: () => void;
}) {
  const [basis] = useState(() => JSON.stringify(document));
  const stale = JSON.stringify(document) !== basis;
  const [types, setTypes] = useState<NodeType[]>(structuredClone(document.nodeTypes ?? [])),
    [selected, setSelected] = useState(types[0]?.id ?? ''),
    [error, setError] = useState(''),
    [preview, setPreview] = useState<Architecture | null>(null),
    [accepted, setAccepted] = useState(false);
  const type = types.find((t) => t.id === selected);
  const impacts = preview ? typeChanges(document, preview) : [];
  function patch(p: Partial<NodeType>) {
    setTypes(types.map((t) => (t.id === selected ? { ...t, ...p } : t)));
    setPreview(null);
  }
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Node types">
      <section className="types-modal">
        <header>
          <h2>Node types</h2>
          <button onClick={close}>Close</button>
        </header>
        <p>
          Fields appear on one primary surface. Hover details move into the pinned reading panel.
          Renderers are declarative.
        </p>
        <div className="type-tabs">
          {types.map((t) => (
            <button
              key={t.id}
              aria-pressed={selected === t.id}
              onClick={() => {
                setSelected(t.id);
                setPreview(null);
              }}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={() => {
              const id = 'type-' + crypto.randomUUID();
              setTypes([
                ...types,
                { id, label: 'New type', description: '', baseKind: 'module', fields: [] },
              ]);
              setSelected(id);
              setPreview(null);
            }}
          >
            Add type
          </button>
        </div>
        {type && (
          <>
            <label>
              Name
              <input value={type.label} onChange={(e) => patch({ label: e.target.value })} />
            </label>
            <label>
              Meaning
              <textarea
                value={type.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </label>
            <label>
              Base kind
              <select
                value={type.baseKind}
                onChange={(e) => patch({ baseKind: e.target.value as NodeType['baseKind'] })}
              >
                {moduleKinds.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <h3>Fields & primary surfaces</h3>
            {type.fields.map((f, i) => (
              <div className="type-field" key={f.id}>
                <input
                  aria-label={`Field ${i + 1} label`}
                  value={f.label}
                  placeholder="Field label"
                  onChange={(e) =>
                    patch({
                      fields: type.fields.map((v) =>
                        v.id === f.id ? { ...v, label: e.target.value } : v,
                      ),
                    })
                  }
                />
                <select
                  aria-label={`Field ${i + 1} type`}
                  value={f.kind}
                  onChange={(e) =>
                    patch({
                      fields: type.fields.map((v) =>
                        v.id === f.id
                          ? {
                              ...v,
                              kind: e.target.value as typeof f.kind,
                              options: e.target.value === 'enum' ? ['option'] : undefined,
                            }
                          : v,
                      ),
                    })
                  }
                >
                  {fieldKinds.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
                <select
                  aria-label={`Field ${i + 1} surface`}
                  value={f.surface}
                  onChange={(e) =>
                    patch({
                      fields: type.fields.map((v) =>
                        v.id === f.id ? { ...v, surface: e.target.value as typeof f.surface } : v,
                      ),
                    })
                  }
                >
                  {surfaces.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
                {f.kind === 'enum' && (
                  <input
                    aria-label="Enum options"
                    value={f.options?.join(', ')}
                    onChange={(e) =>
                      patch({
                        fields: type.fields.map((v) =>
                          v.id === f.id
                            ? { ...v, options: e.target.value.split(',').map((s) => s.trim()) }
                            : v,
                        ),
                      })
                    }
                  />
                )}
                <button
                  aria-label={`Remove ${f.label}`}
                  onClick={() => patch({ fields: type.fields.filter((v) => v.id !== f.id) })}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                patch({
                  fields: [
                    ...type.fields,
                    {
                      id: 'field-' + crypto.randomUUID(),
                      label: 'New field',
                      kind: 'text',
                      surface: 'details',
                    },
                  ],
                })
              }
            >
              Add field
            </button>
            <button
              onClick={() => {
                setTypes(types.filter((t) => t.id !== selected));
                setSelected('');
                setPreview(null);
              }}
            >
              Remove type
            </button>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        {stale && (
          <p role="alert">
            The map changed while this editor was open. Close and reopen Types before applying
            changes.
          </p>
        )}
        {preview ? (
          <section className="proposal">
            <h3>Migration preview</h3>
            {impacts.length ? (
              <>
                <ul>
                  {impacts.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
                <label>
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />{' '}
                  Accept these value changes
                </label>
              </>
            ) : (
              <p>No stored values will be removed.</p>
            )}
            <button
              disabled={stale || (impacts.length > 0 && !accepted)}
              onClick={() => {
                edit(parseDocument(migrateTypes(document, preview)));
                close();
              }}
            >
              Apply types to draft
            </button>
          </section>
        ) : (
          <button
            className="primary"
            onClick={() => {
              try {
                const nodeTypes = parseNodeTypes(types);
                setPreview({ ...document, nodeTypes });
                setAccepted(false);
                setError('');
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            Review type changes
          </button>
        )}
      </section>
    </div>
  );
}
