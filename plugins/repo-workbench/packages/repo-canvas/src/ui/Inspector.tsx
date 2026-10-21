import { useState } from 'react';
import {
  moduleKinds,
  kindDescriptions,
  parseDocument,
  sameTarget,
  type Architecture,
  type Module,
  type Target,
} from '../model/document';
import { SourceBlock } from './SourceBlock';
import { Notes } from './Notes';
interface Props {
  document: Architecture;
  module: Module;
  token: string;
  edit: (document: Architecture) => void;
  enter: (id: string) => void;
  close: () => void;
  initialTab?: 'details' | 'notes' | 'sources';
  comment: (target: Target) => void;
}
export function Inspector({
  document,
  module,
  token,
  edit,
  enter,
  close,
  initialTab = 'details',
  comment,
}: Props) {
  const [basis, setBasis] = useState('');
  const [tab, setTab] = useState(initialTab),
    [draft, setDraft] = useState<Module | null>(null),
    [error, setError] = useState(''),
    [source, setSource] = useState<string | null>(null);
  const children = document.modules.filter((m) => m.parent === module.id),
    type = document.nodeTypes?.find((t) => t.id === module.typeId);
  const noteCount = document.annotations.filter((a) =>
    sameTarget(a.target, { kind: 'node', id: module.id }),
  ).length;
  const sourceFields =
    type?.fields
      .filter((f) => f.kind === 'source' && typeof module.fields?.[f.id] === 'string')
      .map((f) => String(module.fields![f.id])) ?? [];
  const sources = [...new Set([...module.sources, ...sourceFields])];
  function setField(id: string, value: string | number | boolean | undefined) {
    if (!draft) return;
    const fields = { ...draft.fields };
    if (value === undefined) delete fields[id];
    else fields[id] = value;
    setDraft({ ...draft, fields });
  }
  function update(next: Module) {
    try {
      if (draft && JSON.stringify(module) !== basis)
        throw new Error(
          'This node changed while you were editing. Copy your edits, cancel, and reopen Edit.',
        );
      edit(
        parseDocument({
          ...document,
          modules: document.modules.map((m) => (m.id === next.id ? next : m)),
        }),
      );
      setDraft(null);
      setError('');
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <aside className="inspector">
      <div className="panel-heading">
        <h2>Pinned object</h2>
        <button
          onClick={() => {
            setBasis(JSON.stringify(module));
            setDraft(draft ? null : structuredClone(module));
            setError('');
          }}
        >
          {draft ? 'Cancel' : 'Edit'}
        </button>
        <button
          aria-label="Comment on node"
          onClick={() => comment({ kind: 'node', id: module.id })}
        >
          ⋯
        </button>
        <button aria-label="Close inspector" onClick={close}>
          ×
        </button>
      </div>
      {draft ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update(draft);
          }}
        >
          <label>
            Node type
            <select
              aria-label="Node type"
              value={draft.typeId ?? draft.kind}
              onChange={(e) => {
                const custom = document.nodeTypes?.find((t) => t.id === e.target.value);
                setDraft({
                  ...draft,
                  typeId: custom?.id,
                  kind: custom?.baseKind ?? (e.target.value as Module['kind']),
                });
              }}
            >
              {moduleKinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
              {document.nodeTypes?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Name
            <input
              aria-label="Module name"
              required
              maxLength={200}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            Responsibility
            <textarea
              aria-label="Module responsibility"
              rows={5}
              maxLength={12000}
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
            />
          </label>
          {(document.nodeTypes?.find((t) => t.id === draft.typeId)?.fields ?? []).map((f) => (
            <label key={f.id}>
              {f.label}
              {f.kind === 'boolean' ? (
                <select
                  value={String(draft.fields?.[f.id] ?? '')}
                  onChange={(e) =>
                    setField(f.id, e.target.value === '' ? undefined : e.target.value === 'true')
                  }
                >
                  <option value="">Unset</option>
                  <option>true</option>
                  <option>false</option>
                </select>
              ) : f.kind === 'enum' ? (
                <select
                  value={String(draft.fields?.[f.id] ?? '')}
                  onChange={(e) => setField(f.id, e.target.value || undefined)}
                >
                  <option value="">Unset</option>
                  {f.options?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={String(draft.fields?.[f.id] ?? '')}
                  type={f.kind === 'number' ? 'number' : 'text'}
                  onChange={(e) => {
                    const fields = { ...draft.fields };
                    if (!e.target.value) delete fields[f.id];
                    else
                      fields[f.id] = f.kind === 'number' ? Number(e.target.value) : e.target.value;
                    setDraft({ ...draft, fields });
                  }}
                />
              )}
            </label>
          ))}
          <label>
            Source references · one per line
            <textarea
              aria-label="Source references"
              className="source-editor"
              rows={4}
              placeholder="src/example.ts#L10-L25"
              value={draft.sources.join('\n')}
              onChange={(e) =>
                setDraft({ ...draft, sources: e.target.value.split('\n').filter(Boolean) })
              }
            />
          </label>
          <button className="primary" type="submit">
            Apply edits
          </button>
        </form>
      ) : (
        <>
          <div className="detail-tabs">
            {(['details', 'notes', 'sources'] as const).map((key) => (
              <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>
                {key === 'notes'
                  ? `Notes · ${noteCount}`
                  : key === 'sources'
                    ? `Sources · ${sources.length}`
                    : 'Details'}
              </button>
            ))}
          </div>
          {tab === 'details' && (
            <section>
              <p className="eyebrow" title={type?.description ?? kindDescriptions[module.kind]}>
                {type?.description ?? kindDescriptions[module.kind]}
              </p>
              <p className="responsibility">{module.summary || 'No responsibility recorded.'}</p>
              {type?.fields
                .filter((f) => f.surface !== 'card' && f.kind !== 'source')
                .map(
                  (f) =>
                    module.fields?.[f.id] !== undefined && (
                      <p key={f.id}>
                        <b>{f.label}</b>
                        <br />
                        {String(module.fields[f.id])}
                      </p>
                    ),
                )}
              {module.typeId && !type && (
                <p role="status">Unknown type {module.typeId}. Values are preserved.</p>
              )}
              {Object.entries(module.fields ?? {})
                .filter(([key]) => !type?.fields.some((f) => f.id === key))
                .map(([key, value]) => (
                  <p key={key}>
                    <b>{key}</b>
                    <br />
                    {String(value)}
                  </p>
                ))}
              {children.length > 0 && (
                <button className="wide enter" onClick={() => enter(module.id)}>
                  Enter module <span>{children.length} inside →</span>
                </button>
              )}
            </section>
          )}
          {tab === 'notes' && (
            <Notes
              document={document}
              target={{ kind: 'node', id: module.id }}
              edit={edit}
              comment={comment}
            />
          )}
          {tab === 'sources' && (
            <section>
              {!source &&
                sources.map((path) => (
                  <button
                    key={path}
                    className="source-link"
                    title={path}
                    onClick={() => setSource(path)}
                  >
                    {path}
                  </button>
                ))}
              {!sources.length && (
                <p className="muted">No source references. Add a path or line block in Edit.</p>
              )}
              {source && <button onClick={() => setSource(null)}>← All references</button>}
              {source && (
                <SourceBlock
                  key={source}
                  reference={source}
                  token={token}
                  document={document}
                  onReferenceChange={(next) => {
                    update({
                      ...module,
                      sources: module.sources.map((p) => (p === source ? next : p)),
                      fields: Object.fromEntries(
                        Object.entries(module.fields ?? {}).map(([k, v]) => [
                          k,
                          sourceFields.includes(String(v)) && v === source ? next : v,
                        ]),
                      ),
                    });
                    setSource(next);
                  }}
                />
              )}
            </section>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
