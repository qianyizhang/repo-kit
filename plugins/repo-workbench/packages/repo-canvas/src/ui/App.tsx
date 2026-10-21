import { useCallback, useEffect, useRef, useState } from 'react';
import { ancestors, parseDocument, rootOf, type Module } from '../model/document';
import { download } from './api';
import { useCanvasDocument } from './useCanvasDocument';
import { RepositoryPicker } from './RepositoryPicker';
import { useCanvasAgent } from './useCanvasAgent';
import type { Viewport } from '../model/layout';
import { Canvas } from './Canvas';
import { Inspector } from './Inspector';
import { SideChat, type ChatActions } from './SideChat';
import { hosted } from './host';
import { ConnectionInfo } from './ConnectionInfo';

export function App() {
  const {
    session,
    document,
    scope,
    setScope,
    selection,
    setSelection,
    selections,
    setSelections,
    needsRepository,
    lookupReason,
    retryingConnection,
    connectionCheckedAt,
    retryConnection,
    dirty,
    conflict,
    saving,
    history,
    setHistory,
    error,
    setError,
    notice,
    setNotice,
    load,
    edit,
    replaceDraft,
    save,
  } = useCanvasDocument();
  const chatActions = useRef<ChatActions>(null);
  const inspectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (inspectTimer.current) clearTimeout(inspectTimer.current);
    },
    [],
  );
  const [query, setQuery] = useState('');
  const [multiSelect, setMultiSelect] = useState(false);
  const [navigation, setNavigation] = useState<boolean | null>(null);
  const [compact, setCompact] = useState(() => window.innerWidth < 1100);
  const navigationOpen = navigation ?? !compact;
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1, width: 0, height: 0 });
  const [viewAction, setViewAction] = useState<{
    id: string;
    action: 'fit' | 'read' | 'selection';
  } | null>(null);
  const reportView = useCallback((view: Viewport) => setViewport(view), []);
  useEffect(() => {
    const media = matchMedia('(max-width: 1099px)');
    const change = () => setCompact(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const [panel, setPanel] = useState<'inspect' | 'chat' | null>(hosted ? 'chat' : null);
  const [adding, setAdding] = useState(false),
    [newName, setNewName] = useState('');
  function enter(id: string) {
    if (inspectTimer.current) clearTimeout(inspectTimer.current);
    setScope(id);
    setSelection(null);
    setSelections([]);
    setMultiSelect(false);
    if (compact) setNavigation(false);
    setQuery('');
  }
  const activeSelections = selections.filter((id) =>
    document?.modules.some((m) => m.id === id && m.parent === scope),
  );
  function select(id: string | null, additive = false) {
    const next =
      id === null
        ? []
        : additive
          ? activeSelections.includes(id)
            ? activeSelections.filter((key) => key !== id)
            : [...activeSelections, id]
          : [id];
    setSelections(next);
    setSelection(next.at(-1) ?? null);
    if (inspectTimer.current) clearTimeout(inspectTimer.current);
    // Keep the second click on the same card before the inspector changes pane width.
    if (id && !additive && panel !== 'chat')
      inspectTimer.current = setTimeout(
        () => setPanel((current) => (current === 'chat' ? current : 'inspect')),
        250,
      );
  }
  const agent = useCanvasAgent(
    document && session
      ? {
          document,
          baseRevision: session.revision,
          scope,
          selections: activeSelections,
          panel,
          navigation: navigationOpen,
          viewport,
          dirty,
          conflict,
        }
      : null,
    session?.token,
    (command, id) => {
      switch (command.action) {
        case 'focus':
          enter(command.target);
          break;
        case 'select':
          setSelections(command.targets);
          setSelection(command.targets.at(-1) ?? null);
          break;
        case 'panel':
          setPanel(command.panel);
          break;
        case 'navigation':
          setNavigation(command.open);
          break;
        default:
          setViewAction({
            id,
            action: command.action === 'fit_selection' ? 'selection' : command.action,
          });
      }
    },
  );
  let staleProposal = false;
  if (agent.proposal) {
    try {
      staleProposal =
        JSON.stringify(parseDocument(document)) !== JSON.stringify(agent.proposal.baseDocument);
    } catch {
      staleProposal = true;
    }
  }
  const file = useRef<HTMLInputElement>(null);
  if (!session || !document)
    return (
      <RepositoryPicker
        needsRepository={needsRepository}
        lookupReason={lookupReason}
        retryingConnection={retryingConnection}
        connectionCheckedAt={connectionCheckedAt}
        retryConnection={retryConnection}
        load={load}
        error={error}
        setError={setError}
      />
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
    <div
      className={`workbench ${panel ? 'with-panel' : ''} ${navigationOpen ? 'nav-open' : 'nav-closed'}`}
    >
      <header className="app-header">
        <div className="brand">
          <strong>Repo Canvas</strong>
          <ConnectionInfo />
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
      <nav
        className="hierarchy"
        aria-label="Architecture navigation"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setNavigation(false);
            window.document
              .querySelector<HTMLButtonElement>('[aria-label="Toggle navigation"]')
              ?.focus();
          }
        }}
      >
        <div className="panel-eyebrow">
          Architecture{' '}
          <button aria-label="Hide navigation" onClick={() => setNavigation(false)}>
            ×
          </button>
        </div>
        <label className="search">
          <span>⌕</span>
          <input
            aria-label="Find module"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a node or source…"
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
                    setSelections([m.id]);
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
          <button
            aria-label="Toggle navigation"
            aria-expanded={navigationOpen}
            onClick={() => setNavigation(!navigationOpen)}
          >
            Browse
          </button>
          <div className="breadcrumbs">
            {ancestors(document, scope).map((m, i) => (
              <span key={m.id}>
                {i > 0 && <i>/</i>}
                <button onClick={() => enter(m.id)}>{m.name}</button>
              </span>
            ))}
          </div>
          <div className="toolbar-actions">
            <button aria-pressed={multiSelect} onClick={() => setMultiSelect(!multiSelect)}>
              Select several
            </button>
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
        {!session.saved && (
          <section className="initialize-map" aria-label="Initialize architecture">
            <div>
              <strong>No architecture model yet</strong>
              <p>
                This directory scaffold is only a starting point. Build a concise view of the core
                concepts, use cases and data flow from code, docs, recent commits and relevant
                discussions.
              </p>
            </div>
            <button
              className="primary"
              disabled={!hosted}
              onClick={() => {
                setPanel('chat');
                chatActions.current?.initialize();
              }}
            >
              Initialize architecture
            </button>
            {!hosted && (
              <small>
                Open this repository in the Codex Repo Canvas app to initialize with this chat.
              </small>
            )}
          </section>
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
        {agent.error && (
          <div className="status-banner warning" role="status">
            Agent state sync unavailable: {agent.error}
          </div>
        )}
        {agent.proposal && (
          <section className="agent-proposal" aria-label="Agent map proposal">
            <details>
              <summary>
                Review proposed map · {agent.proposal.document.modules.length} concepts
              </summary>
              <p>{agent.proposal.explanation}</p>
              <details>
                <summary>Review proposed document</summary>
                <pre>{JSON.stringify(agent.proposal.document, null, 2)}</pre>
              </details>
              <button
                className="primary"
                disabled={staleProposal}
                onClick={() => {
                  edit(agent.proposal!.document);
                  void agent.dismiss();
                }}
              >
                Apply to draft
              </button>
              <button onClick={() => void agent.dismiss()}>Dismiss proposal</button>
              {staleProposal && <p>The draft changed. Ask for a fresh proposal.</p>}
            </details>
          </section>
        )}
        <Canvas
          edit={edit}
          selections={activeSelections}
          multiSelect={multiSelect}
          reportView={reportView}
          viewAction={viewAction}
          key={scope}
          document={document}
          scope={scope}
          selection={selection}
          select={select}
          enter={enter}
          move={(id, x, y) =>
            edit({
              ...document,
              modules: document.modules.map((m) => (m.id === id ? { ...m, x, y } : m)),
            })
          }
        />
        <footer className="app-footer">
          {activeSelections.length > 0 ? (
            <div className="selection-bar">
              <span>{activeSelections.length} selected</span>
              <button onClick={() => setPanel('chat')}>Discuss selection</button>
              <button onClick={() => select(null)}>Clear selection</button>
            </div>
          ) : (
            <span>
              {document.modules.length} nodes <i>·</i> {document.connections.length} relationships{' '}
              <i>·</i> {document.annotations.length} notes
            </span>
          )}
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
          actions={chatActions}
          document={document}
          scope={scope}
          selection={selection}
          selections={activeSelections}
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
              setSelections([id]);
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
