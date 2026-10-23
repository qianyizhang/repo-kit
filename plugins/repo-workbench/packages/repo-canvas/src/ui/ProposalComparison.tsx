import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ancestors, rootOf, type Architecture, type ContextComment } from '../model/document';
import {
  compareArchitecture,
  comparisonConnections,
  scopeForChange,
  type ArchitectureChange,
} from '../model/comparison';
import { cardSize, connectionPath, placeLabels } from '../model/layout';

export interface ProposalIntent {
  question: string;
  comments: ContextComment[];
}
type Mode = 'Before' | 'Changes' | 'After';
const format = (value: unknown) =>
  value === undefined
    ? 'Not present'
    : typeof value === 'string'
      ? value
      : JSON.stringify(value, null, 2);
const kindName = {
  module: 'Node',
  connection: 'Relationship',
  annotation: 'Note',
  group: 'Group',
  nodeType: 'Type',
  document: 'Document',
};

interface Props {
  before: Architecture;
  after: Architecture;
  stale: boolean;
  intent?: ProposalIntent;
  explanation?: string;
  close: () => void;
}
export function ProposalComparison({ before, after, stale, intent, explanation, close }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const changes = useMemo(() => compareArchitecture(before, after).changes, [before, after]);
  const [mode, setMode] = useState<Mode>('Changes');
  const [selected, setSelected] = useState(changes[0]?.key ?? '');
  const change = changes.find((entry) => entry.key === selected);
  const side =
    mode === 'Before' || (mode === 'Changes' && change?.status === 'removed') ? 'Before' : 'After';
  const document = side === 'Before' ? before : after;
  const [scopeOverride, setScopeOverride] = useState<string | null>(null);
  const targetScope = change ? scopeForChange(document, change) : rootOf(document).id;
  const scope = scopeOverride ?? targetScope;
  useEffect(() => {
    const opener = window.document.activeElement;
    const node = dialog.current;
    node?.showModal();
    return () => {
      node?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  function select(entry: ArchitectureChange) {
    setSelected(entry.key);
    setScopeOverride(null);
  }
  return (
    <dialog
      ref={dialog}
      className="proposal-comparison"
      aria-label="Review proposal changes"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header>
        <div>
          <h2>Review changes</h2>
          <p>
            {changes.length} {changes.length === 1 ? 'change' : 'changes'} · captured baseline →
            proposal
          </p>
        </div>
        <button autoFocus aria-label="Close comparison" onClick={close}>
          ×
        </button>
      </header>
      {stale && (
        <p className="comparison-warning" role="status">
          The draft has changed. This comparison keeps the captured baseline; Apply is disabled.
        </p>
      )}
      {(intent || explanation) && (
        <details className="comparison-intent">
          <summary>
            Request context
            {intent?.comments.length
              ? ` · ${intent.comments.length} ${intent.comments.length === 1 ? 'comment' : 'comments'}`
              : ''}
          </summary>
          {intent?.question && <p>{intent.question}</p>}
          {explanation && <p>{explanation}</p>}
          {intent?.comments.map((comment) => (
            <details key={comment.id}>
              <summary>
                {comment.label} · {comment.target.kind} {comment.target.id}
              </summary>
              <p>{comment.instruction}</p>
              <small>
                Captured revision {comment.documentRevision} · scope {comment.scope}
              </small>
              <pre>{comment.captured}</pre>
            </details>
          ))}
        </details>
      )}
      <div className="comparison-workspace">
        <nav className="comparison-changes" aria-label="Proposed changes">
          {!changes.length && <p>No authored changes.</p>}
          {changes.map((entry) => (
            <button
              key={entry.key}
              aria-pressed={selected === entry.key}
              onClick={() => select(entry)}
            >
              <span className={`change-status ${entry.status}`}>{entry.status}</span>
              <strong>{entry.label}</strong>
              <small>
                {kindName[entry.kind]} · {entry.id}
              </small>
            </button>
          ))}
        </nav>
        <section className="comparison-content" aria-label="Change details">
          <div className="comparison-toolbar">
            <div role="group" aria-label="Comparison view">
              {(['Before', 'Changes', 'After'] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={mode === value}
                  onClick={() => {
                    setMode(value);
                    setScopeOverride(null);
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
            {mode === 'Changes' && (
              <span>
                Highlighting {side.toLowerCase()}
                {change?.status === 'removed' ? ' · removed item' : ''}
              </span>
            )}
          </div>
          <nav className="comparison-scope" aria-label="Comparison scope">
            {scope && document.modules.some((node) => node.id === scope) ? (
              ancestors(document, scope).map((node) => (
                <button
                  key={node.id}
                  aria-current={scope === node.id ? 'location' : undefined}
                  onClick={() => setScopeOverride(node.id)}
                >
                  {node.name}
                </button>
              ))
            ) : (
              <button onClick={() => setScopeOverride(rootOf(document).id)}>
                Open {side.toLowerCase()} root
              </button>
            )}
          </nav>
          {scope && document.modules.some((node) => node.id === scope) ? (
            <ComparisonMap
              key={scope}
              document={document}
              scope={scope}
              frameNodes={[...before.modules, ...after.modules].filter(
                (node) => node.parent === scope,
              )}
              changes={mode === 'Changes' ? changes : []}
              selected={change}
              enter={setScopeOverride}
              select={select}
            />
          ) : (
            <p className="comparison-absent">
              This item is absent in {side.toLowerCase()}. Its exact changes remain below.
            </p>
          )}
          {change && (
            <section className="comparison-fields" aria-label={`Details for ${change.id}`}>
              <h3>
                {kindName[change.kind]} · {change.label}
              </h3>
              {change.fields.map((field) => (
                <div className="comparison-field" key={field.field}>
                  <h4>
                    {field.field} <small>{field.classification}</small>
                  </h4>
                  <div>
                    <section>
                      <b>Before</b>
                      <pre>{format(field.before)}</pre>
                    </section>
                    <section>
                      <b>After</b>
                      <pre>{format(field.after)}</pre>
                    </section>
                  </div>
                </div>
              ))}
            </section>
          )}
          <details className="comparison-json">
            <summary>Full documents</summary>
            <h3>Captured baseline</h3>
            <pre>{JSON.stringify(before, null, 2)}</pre>
            <h3>Proposal</h3>
            <pre>{JSON.stringify(after, null, 2)}</pre>
          </details>
        </section>
      </div>
      <footer>Read-only comparison. Close to apply or dismiss the proposal.</footer>
    </dialog>
  );
}

function ComparisonMap({
  document,
  scope,
  frameNodes,
  changes,
  selected,
  enter,
  select,
}: {
  document: Architecture;
  scope: string;
  frameNodes: { x: number; y: number }[];
  changes: ArchitectureChange[];
  selected?: ArchitectureChange;
  enter: (id: string) => void;
  select: (change: ArchitectureChange) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  const [read, setRead] = useState(false);
  const marker = useId().replaceAll(':', '');
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const nodes = document.modules.filter((node) => node.parent === scope);
  // Share camera bounds only; each scene still uses one valid authored document.
  const left = frameNodes.length ? Math.min(...frameNodes.map((node) => node.x)) : 0;
  const top = frameNodes.length ? Math.min(...frameNodes.map((node) => node.y)) : 0;
  const positioned = nodes.map((node) => ({
    ...node,
    x: node.x - left + 32,
    y: node.y - top + 32,
  }));
  const byId = new Map(positioned.map((node) => [node.id, node]));
  const w = Math.max(360, ...frameNodes.map((node) => node.x - left + cardSize.width + 64));
  const h = Math.max(220, ...frameNodes.map((node) => node.y - top + cardSize.height + 64));
  const zoom = read ? 1 : Math.min(1, Math.max(1, width - 4) / w, 340 / h);
  const connections = comparisonConnections(document, scope);
  const labels = placeLabels(
    connections.map((edge) => {
      const geometry = connectionPath(byId.get(edge.from)!, byId.get(edge.to)!, positioned);
      return { id: edge.id, text: edge.label, x: geometry.x, y: geometry.y };
    }),
    positioned,
  );
  const visibleEdgeIds = new Set(connections.map((edge) => edge.id));
  const nested = changes.filter((entry) => {
    const owner = scopeForChange(document, entry);
    return (
      owner !== null &&
      owner !== scope &&
      ancestors(document, owner).some((node) => node.id === scope)
    );
  });
  return (
    <>
      <div className="comparison-map-controls">
        <button aria-pressed={!read} onClick={() => setRead(false)}>
          Fit
        </button>
        <button aria-pressed={read} onClick={() => setRead(true)}>
          100%
        </button>
        <span>
          {Math.round(zoom * 100)}% · {positioned.length} nodes
          {nested.length
            ? ` · ${nested.length} ${nested.length === 1 ? 'change' : 'changes'} inside nested scopes`
            : ''}
        </span>
      </div>
      <div
        ref={viewport}
        className="comparison-map"
        aria-label="Read-only proposal map"
        tabIndex={0}
      >
        {!positioned.length ? (
          <p>No child nodes in this scope.</p>
        ) : (
          <div style={{ width: w * zoom, height: h * zoom }}>
            <div
              className="comparison-plane"
              style={{ width: w, height: h, transform: `scale(${zoom})` }}
            >
              <svg width={w} height={h} aria-label="Authored relationships">
                <defs>
                  <marker
                    id={marker}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto"
                  >
                    <path d="M0 0L10 5L0 10z" fill="currentColor" />
                  </marker>
                </defs>
                {connections.map((edge) => {
                  const changed = changes.find(
                    (entry) => entry.kind === 'connection' && entry.id === edge.id,
                  );
                  const label = labels.get(edge.id);
                  return (
                    <g
                      key={edge.id}
                      className={changed ? 'comparison-edge changed' : 'comparison-edge'}
                    >
                      <title>
                        {edge.id}: {edge.label}
                      </title>
                      <path
                        d={
                          connectionPath(byId.get(edge.from)!, byId.get(edge.to)!, positioned).path
                        }
                        markerEnd={`url(#${marker})`}
                      />
                      {label && (
                        <text x={label.x} y={label.y} textAnchor="middle">
                          {edge.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
              {positioned.map((node) => {
                const changed = changes.find(
                  (entry) => entry.kind === 'module' && entry.id === node.id,
                );
                const children = document.modules.filter(
                  (child) => child.parent === node.id,
                ).length;
                const type = document.nodeTypes?.find((type) => type.id === node.typeId);
                const active =
                  selected &&
                  scopeForChange(document, selected) === scope &&
                  (selected.id === node.id ||
                    (selected.kind === 'annotation' &&
                      document.annotations.find((note) => note.id === selected.id)?.target.id ===
                        node.id));
                return (
                  <article
                    key={node.id}
                    className={`comparison-node ${changed?.status ?? ''} ${active ? 'selected' : ''}`}
                    style={{
                      left: node.x,
                      top: node.y,
                      width: cardSize.width,
                      height: cardSize.height,
                    }}
                    aria-label={`Node ${node.name}`}
                  >
                    <small>
                      {type?.label ?? node.kind}
                      {changed ? ` · ${changed.status}` : ''}
                    </small>
                    <strong title={node.name}>{node.name}</strong>
                    {type?.fields
                      .filter(
                        (field) =>
                          field.surface === 'card' && node.fields?.[field.id] !== undefined,
                      )
                      .map((field) => (
                        <span key={field.id}>
                          {field.label}: {String(node.fields?.[field.id])}
                        </span>
                      ))}
                    <div>
                      {changed && <button onClick={() => select(changed)}>View change</button>}
                      {children > 0 && (
                        <button onClick={() => enter(node.id)}>{children} inside →</button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {connections.length > 0 && (
        <details
          className="comparison-relationships"
          open={selected?.kind === 'connection' && visibleEdgeIds.has(selected.id)}
        >
          <summary>Relationships in this scope · {connections.length}</summary>
          {connections.map((edge) => {
            const changed = changes.find(
              (entry) => entry.kind === 'connection' && entry.id === edge.id,
            );
            const original = document.connections.find((connection) => connection.id === edge.id)!;
            return (
              <p key={edge.id}>
                {original.from} → {original.to} · {edge.label} <code>{edge.id}</code>
                {changed && <button onClick={() => select(changed)}>View {changed.status}</button>}
              </p>
            );
          })}
        </details>
      )}
    </>
  );
}
