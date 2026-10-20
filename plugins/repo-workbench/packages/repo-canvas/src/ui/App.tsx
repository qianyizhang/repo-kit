import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ancestors,
  parseDocument,
  rootOf,
  type Architecture,
  type Module,
  type Snapshot,
} from '../model/document';
import { download, request, type Session } from './api';
import { Canvas } from './Canvas';
import { Inspector } from './Inspector';
import { SideChat } from './SideChat';
import {
  hosted,
  openRepository,
  prepareHost,
  resolveRepositoryFromChat,
  repositoryChoices,
  rememberRepository,
} from './host';
import type { RegisteredRepository } from '../../../runtime/repositories';

export function App() {
  const [repoPath, setRepoPath] = useState('');
  const [needsRepository, setNeedsRepository] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [choices, setChoices] = useState<RegisteredRepository[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [repositoryFilter, setRepositoryFilter] = useState('');
  const [deliveryWarning, setDeliveryWarning] = useState('');
  const askedChat = useRef(false);
  const [session, setSession] = useState<Session | null>(null),
    [document, setDocument] = useState<Architecture | null>(null);
  const [scope, setScope] = useState('repo'),
    [selection, setSelection] = useState<string | null>(null),
    [query, setQuery] = useState('');
  const [panel, setPanel] = useState<'inspect' | 'chat' | null>(hosted ? 'chat' : null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false),
    [conflict, setConflict] = useState(false),
    [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false),
    [newName, setNewName] = useState('');
  const [history, setHistory] = useState<Architecture[]>([]);
  const documentRef = useRef(document);
  documentRef.current = document;
  const state = useRef({ dirty, revision: session?.revision });
  state.current = { dirty, revision: session?.revision };
  const load = useCallback(async (recover = false) => {
    try {
      if (hosted && !(await prepareHost())) {
        setNeedsRepository(true);
        setError('');
        return;
      }
      const data = await request<Session & { needsRepository?: boolean }>('state');
      if (data.needsRepository) {
        setNeedsRepository(true);
        setError('');
        return;
      }
      setNeedsRepository(false);
      data.document = parseDocument(data.document);
      if (hosted)
        void rememberRepository().catch(() => {
          setNotice('Opened this repository, but could not remember it on this device.');
        });
      if (recover) {
        try {
          const transferred = hosted ? await request<unknown>('draft_read', data.token) : null;
          const raw = transferred
            ? JSON.stringify(transferred)
            : sessionStorage.getItem(`repo-canvas:draft:${data.repo}`);
          if (raw) {
            const draft = JSON.parse(raw) as {
              document: unknown;
              revision: string;
              scope: string;
              selection: string | null;
            };
            const restored = parseDocument(draft.document);
            if (
              typeof draft.revision === 'string' &&
              JSON.stringify(restored) !== JSON.stringify(data.document)
            ) {
              setSession({ ...data, revision: draft.revision });
              setDocument(restored);
              setScope(
                restored.modules.some((m) => m.id === draft.scope)
                  ? draft.scope
                  : rootOf(restored).id,
              );
              setSelection(
                restored.modules.some((m) => m.id === draft.selection) ? draft.selection : null,
              );
              setDirty(true);
              setConflict(data.revision !== draft.revision);
              setNotice('Restored your unsaved draft in this tab.');
              return;
            }
          }
        } catch {
          /* A corrupt cache must not prevent loading the authoritative map. */
        }
      }
      setSession(data);
      setDocument(data.document);
      setScope(rootOf(data.document).id);
      setSelection(null);
      setDirty(false);
      setConflict(false);
      setHistory([]);
      setError('');
    } catch (error) {
      setError(String(error));
    }
  }, []);
  useEffect(() => {
    void load(true);
    const selected = () => {
      void load(true);
    };
    window.addEventListener('repo-canvas-target', selected);
    return () => window.removeEventListener('repo-canvas-target', selected);
  }, [load]);
  const connectChat = useCallback(async () => {
    setConnecting(true);
    setError('');
    setDeliveryWarning('');
    try {
      if (await resolveRepositoryFromChat(setDeliveryWarning)) await load(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setConnecting(false);
    }
  }, [load]);
  useEffect(() => {
    if (!needsRepository) return;
    let active = true;
    const refresh = async () => {
      try {
        const entries = hosted
          ? await repositoryChoices<RegisteredRepository[]>()
          : await fetch('/api/repositories').then((response) => {
              if (!response.ok) throw new Error('Cannot load registered repositories');
              return response.json() as Promise<RegisteredRepository[]>;
            });
        if (active) {
          setChoices(entries);
          setCatalogError('');
        }
      } catch (error) {
        if (active) setCatalogError(error instanceof Error ? error.message : String(error));
      } finally {
        if (active) setCatalogLoading(false);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    if (hosted && !askedChat.current) {
      askedChat.current = true;
      void connectChat();
    }
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [needsRepository, connectChat]);
  async function chooseRepository(path: string) {
    setError('');
    try {
      if (!hosted) {
        const response = await fetch('/api/repositories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path }),
        });
        const entry = (await response.json()) as RegisteredRepository & { error?: string };
        if (!response.ok) throw new Error(entry.error ?? 'Cannot add repository');
        location.assign(`/canvas/${entry.id}/`);
        return;
      }
      await openRepository(path);
      await load(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }
  useEffect(() => {
    if (!session || !document) return;
    try {
      const key = `repo-canvas:draft:${session.repo}`;
      if (dirty)
        sessionStorage.setItem(
          key,
          JSON.stringify({ document, revision: session.revision, scope, selection }),
        );
      else sessionStorage.removeItem(key);
    } catch {
      /* Persistence still works when browser storage is unavailable. */
    }
  }, [session, document, dirty, scope, selection]);
  useEffect(() => {
    if (!session || !document) return;
    const timer = setTimeout(
      () => {
        void request('draft_write', session.token, {
          draft: dirty ? { document, revision: session.revision, scope, selection } : null,
        }).catch(() => {
          /* Local draft remains intact if the bridge disconnects. */
        });
      },
      dirty ? 350 : 0,
    );
    return () => clearTimeout(timer);
  }, [session, document, dirty, scope, selection]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (state.current.dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      const revision = state.current.revision;
      if (!revision) return;
      void request<Session>('state')
        .then((data) => {
          setSession((previous) =>
            previous && previous.token !== data.token
              ? { ...previous, token: data.token, plugin: data.plugin }
              : previous,
          );
          if (revision !== state.current.revision) return;
          if (!state.current.revision || data.revision === state.current.revision) return;
          if (state.current.dirty) {
            setConflict(true);
            return;
          }
          data.document = parseDocument(data.document);
          setSession(data);
          setDocument(data.document);
          setHistory([]);
          setConflict(false);
          setScope((id) =>
            data.document.modules.some((m) => m.id === id) ? id : rootOf(data.document).id,
          );
          setSelection((id) => (data.document.modules.some((m) => m.id === id) ? id : null));
          setNotice('Updated from the shared repo document.');
        })
        .catch((error: unknown) => setError(String(error)));
    }, 3000);
    return () => clearInterval(timer);
  }, []);
  function replaceDraft(next: Architecture) {
    setDocument(next);
    setScope((id) => (next.modules.some((m) => m.id === id) ? id : rootOf(next).id));
    setSelection((id) => (next.modules.some((m) => m.id === id) ? id : null));
    setDirty(true);
  }
  function edit(next: Architecture) {
    if (!document) return;
    setHistory((h) => [...h.slice(-39), document]);
    replaceDraft(next);
    setNotice('');
  }
  async function save() {
    if (!session || !document) return;
    setSaving(true);
    setError('');
    try {
      const snapshot = await request<Snapshot>('save', session.token, {
        document: parseDocument(document),
        revision: session.revision,
      });
      state.current.revision = snapshot.revision;
      setSession({ ...session, ...snapshot });
      if (documentRef.current === document) {
        setDocument(snapshot.document);
        setDirty(false);
      }
      setConflict(false);
      setNotice('Saved to .repo-canvas/architecture.json');
    } catch (error) {
      setError(String(error));
    } finally {
      setSaving(false);
    }
  }
  function enter(id: string) {
    setScope(id);
    setSelection(null);
    setQuery('');
  }
  const file = useRef<HTMLInputElement>(null);
  if (!session || !document)
    return (
      <div className="loading">
        <div className="brand-mark">▧</div>
        <h1>Repo Canvas</h1>
        {needsRepository ? (
          <>
            <p className="connection-status" role="status">
              {connecting && <span className="connection-spinner" aria-hidden="true" />}
              {hosted
                ? connecting
                  ? 'Connecting to this chat’s repository…'
                  : 'Choose a repository for this canvas.'
                : 'Choose a registered repository.'}
            </p>
            {connecting && (
              <p className="connection-hint">
                {deliveryWarning ||
                  'Waiting for this chat to supply the path. You can also choose a repository below.'}
              </p>
            )}
            {error && <p role="alert">{error}</p>}
            {hosted && !connecting && (
              <button onClick={() => void connectChat()}>Use this chat’s repository</button>
            )}
            <h2 className="repository-heading">Saved repositories</h2>
            <p className="connection-hint">Repositories you open are remembered on this device.</p>
            {catalogLoading && <p role="status">Loading saved repositories…</p>}
            {!catalogLoading && !catalogError && choices.length === 0 && (
              <p>No saved repositories yet. Open a folder below to add the first one.</p>
            )}
            {choices.length > 0 && (
              <label>
                Find a repository
                <input
                  type="search"
                  value={repositoryFilter}
                  onChange={(event) => setRepositoryFilter(event.target.value)}
                  placeholder="Name or path"
                />
              </label>
            )}
            {choices.length > 0 && (
              <div className="repository-choices" aria-label="Registered repositories">
                {choices
                  .filter((entry) =>
                    `${entry.name} ${entry.path}`
                      .toLowerCase()
                      .includes(repositoryFilter.toLowerCase()),
                  )
                  .map((entry) => (
                    <button
                      key={entry.id}
                      disabled={!entry.available}
                      onClick={() =>
                        hosted
                          ? void chooseRepository(entry.path)
                          : location.assign(`/canvas/${entry.id}/`)
                      }
                    >
                      <strong>{entry.name}</strong>
                      <code>{entry.path}</code>
                      {!entry.available && <span>Unavailable</span>}
                    </button>
                  ))}
              </div>
            )}
            {choices.length > 0 &&
              !choices.some((entry) =>
                `${entry.name} ${entry.path}`
                  .toLowerCase()
                  .includes(repositoryFilter.toLowerCase()),
              ) && <p>No repositories match your search.</p>}
            {catalogError && <p role="alert">{catalogError}</p>}
            <details>
              <summary>Add another repository</summary>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void chooseRepository(repoPath.trim());
                }}
              >
                <label>
                  Repository path
                  <input
                    value={repoPath}
                    onChange={(event) => setRepoPath(event.target.value)}
                    placeholder="/absolute/path/to/repository"
                    required
                  />
                </label>
                <button type="submit">Open and remember</button>
              </form>
            </details>
            <p className="connection-hint">
              This list updates automatically. You can also manage it with{' '}
              <code>repo-workbench repos</code>.
            </p>
          </>
        ) : (
          <>
            <p role={error ? 'alert' : undefined}>{error || 'Opening the repository…'}</p>
            {error && <button onClick={() => void load()}>Retry loading map</button>}
          </>
        )}
      </div>
    );
  const current = document.modules.find((m) => m.id === scope) ?? rootOf(document);
  const inspected = document.modules.find((m) => m.id === selection) ?? current;
  const matches = query
    ? document.modules
        .filter((m) =>
          `${m.name} ${m.summary} ${m.sources.join(' ')}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .slice(0, 30)
    : [];
  function tree(m: Module, depth = 0): React.ReactNode {
    const activePath = ancestors(document!, scope).map((n) => n.id);
    const children = document!.modules.filter((n) => n.parent === m.id);
    return (
      <div key={m.id}>
        <button
          className={`tree-item ${m.id === scope ? 'active' : ''}`}
          style={{ paddingLeft: 12 + depth * 15 }}
          onClick={() => enter(m.id)}
          title={m.summary}
        >
          <span>{children.length ? (activePath.includes(m.id) ? '⌄' : '›') : '·'}</span>
          <span>{m.name}</span>
          <small>{children.length || ''}</small>
        </button>
        {activePath.includes(m.id) && children.map((child) => tree(child, depth + 1))}
      </div>
    );
  }
  return (
    <div className={`workbench ${panel ? 'with-panel' : ''}`}>
      <header className="app-header">
        <div className="brand">
          <strong>Repo Canvas</strong>
        </div>
        <div className="repo-name">
          <code className="checkout-path" title={session.repo}>
            {session.repo}
          </code>
          <span>{hosted ? 'MCP host session' : 'Standalone preview'}</span>
        </div>
        <div className="header-actions">
          <span className={`save-state ${dirty ? 'unsaved' : ''}`}>
            {dirty
              ? '● Draft changes'
              : session.saved
                ? '✓ Shared document'
                : 'Directory starting map'}
          </span>
          <button className="primary" disabled={saving || conflict} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save map'}
          </button>
        </div>
      </header>
      <nav className="hierarchy">
        <div className="panel-eyebrow">Modules</div>
        <label className="search">
          <span>⌕</span>
          <input
            aria-label="Find module"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a module…"
          />
        </label>
        <div className="tree">
          {query ? (
            matches.length ? (
              matches.map((m) => (
                <button
                  className="tree-item"
                  key={m.id}
                  onClick={() => {
                    enter(m.parent ?? m.id);
                    setSelection(m.id);
                  }}
                >
                  <span>◇</span>
                  <span>
                    {m.name}
                    <small>{m.parent ?? 'root'}</small>
                  </span>
                </button>
              ))
            ) : (
              <p className="muted">No matching modules.</p>
            )
          ) : (
            tree(rootOf(document))
          )}
        </div>
        <details className="hierarchy-bottom">
          <summary>About this map</summary>
          <p>
            Save writes to <code>.repo-canvas/architecture.json</code>. Source previews read this
            checkout, including uncommitted files.
          </p>
          <p>Side chat requires a connected MCP host session.</p>
        </details>
      </nav>
      <main className="main">
        <div className="canvas-toolbar">
          <div className="breadcrumbs">
            {ancestors(document, scope).map((m, i) => (
              <span key={m.id}>
                {i > 0 && <i>/</i>}
                <button onClick={() => enter(m.id)}>{m.name}</button>
              </span>
            ))}
          </div>
          <div className="toolbar-actions">
            <button
              aria-pressed={panel === 'inspect'}
              className={panel === 'inspect' ? 'active' : ''}
              onClick={() => setPanel(panel === 'inspect' ? null : 'inspect')}
            >
              Inspect
            </button>
            <button
              aria-pressed={panel === 'chat'}
              className={panel === 'chat' ? 'active' : ''}
              onClick={() => setPanel(panel === 'chat' ? null : 'chat')}
            >
              Side chat
            </button>
            <details
              className="map-actions"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.currentTarget.open = false;
                  event.currentTarget.querySelector('summary')?.focus();
                }
              }}
              onClick={(event) => {
                if ((event.target as Element).closest('button')) event.currentTarget.open = false;
              }}
            >
              <summary>Map actions</summary>
              <div className="map-actions-content">
                <button
                  title="Undo last draft edit"
                  disabled={!history.length}
                  onClick={() => {
                    replaceDraft(history.at(-1)!);
                    setHistory(history.slice(0, -1));
                  }}
                >
                  Undo
                </button>
                <button onClick={() => setAdding(true)}>+ Module</button>

                <button onClick={() => download(document)}>Export</button>
                <button onClick={() => file.current?.click()}>Import</button>
                <button
                  onClick={() => {
                    if (
                      !dirty ||
                      window.confirm(
                        'Discard your unsaved draft and reload the shared document? Export first to keep it.',
                      )
                    )
                      void load();
                  }}
                >
                  Reload
                </button>
              </div>
            </details>
          </div>
        </div>
        {(error || conflict || notice) && (
          <div
            className={`status-banner ${error || conflict ? 'warning' : ''}`}
            role={error || conflict ? 'alert' : 'status'}
          >
            <span>
              {conflict
                ? 'The repo document changed while you have draft edits. Export your draft before reloading.'
                : error || notice}
            </span>
            {conflict && <button onClick={() => download(document)}>Export draft</button>}
            <button
              onClick={() => {
                setError('');
                setNotice('');
              }}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        )}
        <div className="scope-heading">
          <div>
            <h1>
              {current.name}
              <span>{document.modules.filter((m) => m.parent === scope).length} modules</span>
            </h1>
          </div>
          <p>{current.summary}</p>
        </div>
        <Canvas
          edit={edit}
          key={scope}
          document={document}
          scope={scope}
          selection={selection}
          select={(id) => {
            setSelection(id);
            if (id && panel !== 'chat') setPanel('inspect');
          }}
          enter={enter}
          move={(id, x, y) =>
            edit({
              ...document,
              modules: document.modules.map((m) => (m.id === id ? { ...m, x, y } : m)),
            })
          }
        />
        <footer className="app-footer">
          <span>
            {document.modules.length} modules <i>·</i> {document.connections.length} relationships{' '}
            <i>·</i> {document.annotations.length} annotations
          </span>
        </footer>
      </main>
      {panel === 'inspect' && (
        <Inspector
          key={inspected.id}
          document={document}
          module={inspected}
          token={session.token}
          edit={edit}
          enter={enter}
          close={() => setPanel(null)}
        />
      )}
      <div className={panel === 'chat' ? 'chat-slot' : 'chat-slot hidden'}>
        <SideChat
          document={document}
          scope={scope}
          selection={selection}
          token={session.token}
          apply={edit}
          close={() => setPanel(null)}
        />
      </div>
      <input
        ref={file}
        className="hidden"
        type="file"
        accept="application/json,.json"
        aria-label="Import architecture"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected)
            void selected
              .text()
              .then((raw) => {
                const next = parseDocument(JSON.parse(raw) as unknown);
                edit(next);
                enter(rootOf(next).id);
              })
              .catch((error: unknown) => setError(String(error)));
          e.target.value = '';
        }}
      />
      {adding && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Add module">
          <form
            className="add-modal"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              const id = crypto.randomUUID(),
                count = document.modules.filter((m) => m.parent === scope).length;
              edit({
                ...document,
                modules: [
                  ...document.modules,
                  {
                    id,
                    parent: scope,
                    name: newName.trim(),
                    summary: 'Describe this module’s responsibility.',
                    kind: 'module',
                    sources: [],
                    x: 70 + (count % 3) * 300,
                    y: 85 + Math.floor(count / 3) * 190,
                  },
                ],
              });
              setSelection(id);
              setPanel('inspect');
              setAdding(false);
              setNewName('');
            }}
          >
            <span className="eyebrow">INSIDE {current.name}</span>
            <h2>Create a module</h2>
            <label>
              Module name
              <input
                autoFocus
                maxLength={200}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Replay engine"
              />
            </label>
            <footer>
              <button type="button" onClick={() => setAdding(false)}>
                Cancel
              </button>
              <button className="primary" type="submit" disabled={!newName.trim()}>
                Create module
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
