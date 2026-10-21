import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import {
  ancestors,
  visibleConnections,
  type Architecture,
  type Module,
  type Connection,
  type Target,
  sameTarget,
} from '../model/document';
import { fitView, arrangeNodes, connectionPath, placeLabels, type Viewport } from '../model/layout';
import { RelationshipDialog } from './RelationshipDialog';
interface Props {
  token: string;
  pinned: string | null;
  focusMembers: string[] | null;
  hideOthers: boolean;
  comment: (target: Target) => void;
  contextMenu: (event: React.MouseEvent, target?: Target) => void;
  notes: (id: string) => void;
  addChild: (id: string) => void;
  document: Architecture;
  scope: string;
  selection: string | null;
  selections: string[];
  multiSelect: boolean;
  select: (id: string | null, additive?: boolean) => void;
  reportView: (view: Viewport) => void;
  viewAction: { id: string; action: 'fit' | 'read' | 'selection' } | null;
  enter: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  edit: (document: Architecture) => void;
}
export function Canvas({
  token,
  pinned,
  focusMembers,
  hideOthers,
  comment,
  contextMenu,
  notes: openNotes,
  addChild,
  document,
  scope,
  selection,
  selections,
  multiSelect,
  select,
  enter,
  move,
  edit,
  reportView,
  viewAction,
}: Props) {
  const modules = document.modules.filter((m) => m.parent === scope);
  const modulesRef = useRef(modules);
  modulesRef.current = modules;
  const [view, setView] = useState({ x: 0, y: 0, zoom: 0.8 });
  const automaticFit = useRef(true);
  const clickMoved = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoverEdges, setHoverEdges] = useState<Connection[]>([]);
  function leaveHover() {
    hoverTimer.current = setTimeout(() => {
      setHover(null);
      setHoverEdges([]);
    }, 180);
  }
  function keepHover() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }
  const [hover, setHover] = useState<string | null>(null);
  const [position, setPosition] = useState<{ id: string; x: number; y: number } | null>(null);
  const [link, setLink] = useState<{
    from: string;
    x: number;
    y: number;
    target: string | null;
  } | null>(null);
  const linkRef = useRef(link);
  const [relationships, setRelationships] = useState<Connection[] | null>(null);
  const [hoverPoint, setHoverPoint] = useState({ x: 0, y: 0 });
  function connect(from: string, to: string) {
    const existing = document.connections.filter((c) => c.from === from && c.to === to);
    setRelationships(
      existing.length
        ? existing
        : [{ id: crypto.randomUUID(), from, to, label: 'depends on', description: '' }],
    );
  }
  function cancelLink() {
    linkRef.current = null;
    setLink(null);
  }
  function beginLink(event: PointerEvent, m: Module) {
    event.preventDefault();
    event.stopPropagation();
    setHover(null);
    const next = { from: m.id, x: m.x + 240, y: m.y + 66, target: null };
    linkRef.current = next;
    setLink(next);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  const drag = useRef<{
    id: string | null;
    clientX: number;
    clientY: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const coords = (m: Module) => (position?.id === m.id ? position : m);
  const projected = visibleConnections(document, scope);
  function exactEdges(connection: Connection) {
    const project = (id: string) => ancestors(document, id).find((m) => m.parent === scope)?.id;
    return document.connections.filter(
      (edge) => project(edge.from) === connection.from && project(edge.to) === connection.to,
    );
  }
  function explain(connection: Connection) {
    setHoverEdges([]);
    setHover(null);
    const project = (id: string) => ancestors(document, id).find((m) => m.parent === scope)?.id;
    setRelationships(
      document.connections.filter(
        (edge) => project(edge.from) === connection.from && project(edge.to) === connection.to,
      ),
    );
  }
  const labels = placeLabels(
    projected.map((c) => {
      const path = connectionPath(
        coords(modules.find((m) => m.id === c.from)!),
        coords(modules.find((m) => m.id === c.to)!),
        modules.map(coords),
      );
      return { id: c.id, text: c.label, x: path.x, y: path.y };
    }),
    modules.map(coords),
  );
  const hoverModule = document.modules.find((m) => m.id === hover);
  function showHover(id: string, target: Element) {
    keepHover();
    setHoverEdges([]);
    const parent = viewport.current?.getBoundingClientRect(),
      rect = target.getBoundingClientRect();
    if (!parent) return;
    const width = Math.min(300, parent.width - 24),
      maxY = Math.max(8, parent.height - 220);
    setHoverPoint({
      x: Math.max(12, Math.min(rect.left - parent.left, parent.width - width - 12)),
      y: Math.max(8, Math.min(rect.bottom - parent.top + 10, maxY)),
    });
    setHover(id);
  }
  function start(event: PointerEvent, node?: Module) {
    if (event.button !== 0) return;
    event.stopPropagation();
    clickMoved.current = false;
    drag.current = {
      id: node?.id ?? null,
      clientX: event.clientX,
      clientY: event.clientY,
      x: node?.x ?? view.x,
      y: node?.y ?? view.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onMove(event: PointerEvent) {
    if (linkRef.current && viewport.current) {
      const rect = viewport.current.getBoundingClientRect();
      const x = (event.clientX - rect.left - view.x) / view.zoom,
        y = (event.clientY - rect.top - view.y) / view.zoom;
      const target = modules
        .filter((m) => m.id !== linkRef.current!.from)
        .map((m) => ({ m, distance: Math.hypot(m.x - x, m.y + 66 - y) * view.zoom }))
        .sort((a, b) => a.distance - b.distance)
        .find((item) => item.distance < 28)?.m;
      const next = {
        from: linkRef.current.from,
        x: target?.x ?? x,
        y: target ? target.y + 66 : y,
        target: target?.id ?? null,
      };
      linkRef.current = next;
      setLink(next);
      return;
    }
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.clientX,
      dy = event.clientY - d.clientY;
    if (Math.abs(dx) + Math.abs(dy) < 4 && !d.moved) return;
    d.moved = true;
    clickMoved.current = true;
    automaticFit.current = false;
    setHover(null);
    if (d.id) setPosition({ id: d.id, x: d.x + dx / view.zoom, y: d.y + dy / view.zoom });
    else setView((v) => ({ ...v, x: d.x + dx, y: d.y + dy }));
  }
  function end() {
    if (linkRef.current) {
      const { from, target } = linkRef.current;
      cancelLink();
      if (target) connect(from, target);
      return;
    }
    if (drag.current?.id && position)
      move(position.id, Math.round(position.x), Math.round(position.y));
    drag.current = null;
    setPosition(null);
  }
  const fit = useCallback(() => {
    const modules = modulesRef.current;
    if (!modules.length || !viewport.current) return;
    automaticFit.current = true;
    setView(fitView(modules, viewport.current.clientWidth, viewport.current.clientHeight));
  }, []);
  const nodeSet = modules.map((m) => m.id).join('|');
  useLayoutEffect(() => {
    fit();
  }, [fit, nodeSet]);
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (!viewport.current) return;
      setSize({ width: viewport.current.clientWidth, height: viewport.current.clientHeight });
      if (automaticFit.current) fit();
    });
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [fit]);
  useEffect(() => {
    reportView({ ...view, ...size });
  }, [view, size, reportView]);
  const selectionRef = useRef(selections);
  selectionRef.current = selections;
  const lastViewAction = useRef(viewAction?.id);
  useEffect(() => {
    if (!viewAction || !viewport.current || viewAction.id === lastViewAction.current) return;
    lastViewAction.current = viewAction.id;
    const target =
      viewAction.action === 'selection'
        ? modulesRef.current.filter((m) => selectionRef.current.includes(m.id))
        : modulesRef.current;
    automaticFit.current = viewAction.action === 'fit';
    setView(
      fitView(
        target,
        viewport.current.clientWidth,
        viewport.current.clientHeight,
        viewAction.action === 'read' ? 1 : undefined,
      ),
    );
  }, [viewAction]);
  function zoomTo(zoom: number) {
    automaticFit.current = false;
    setView((v) => ({
      zoom,
      x: size.width / 2 - ((size.width / 2 - v.x) * zoom) / v.zoom,
      y: size.height / 2 - ((size.height / 2 - v.y) * zoom) / v.zoom,
    }));
  }
  function arrange() {
    const positioned = arrangeNodes(modules, size.width, size.height);
    edit({
      ...document,
      modules: document.modules.map((m) => positioned.find((p) => p.id === m.id) ?? m),
    });
    automaticFit.current = true;
    setView(fitView(positioned, size.width, size.height));
  }
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelLink();
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, []);
  return (
    <div
      className="canvas"
      ref={viewport}
      tabIndex={0}
      onContextMenu={(e) => {
        if (e.defaultPrevented) return;
        e.preventDefault();
        contextMenu(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setHover(null);
          setHoverEdges([]);
        }
        if (e.shiftKey && e.key === 'F10') {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          contextMenu({
            clientX: rect.left + 30,
            clientY: rect.top + 30,
            preventDefault: () => {},
            stopPropagation: () => {},
          } as React.MouseEvent);
        }
      }}
      onPointerDown={(e) => start(e)}
      onPointerMove={onMove}
      onPointerUp={end}
      onPointerCancel={() => {
        cancelLink();
        drag.current = null;
        setPosition(null);
      }}
      onWheel={(event) => {
        automaticFit.current = false;
        if (event.ctrlKey || event.metaKey) {
          const rect = event.currentTarget.getBoundingClientRect(),
            px = event.clientX - rect.left,
            py = event.clientY - rect.top;
          setView((v) => {
            const zoom = Math.max(0.3, Math.min(1.6, v.zoom * (event.deltaY > 0 ? 0.9 : 1.1)));
            return {
              zoom,
              x: px - ((px - v.x) * zoom) / v.zoom,
              y: py - ((py - v.y) * zoom) / v.zoom,
            };
          });
        } else setView((v) => ({ ...v, x: v.x - event.deltaX, y: v.y - event.deltaY }));
      }}
    >
      <div
        className="canvas-world"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        <svg
          className={`connections ${selections.length ? 'has-selection' : ''} ${projected.length > 5 ? 'dense-links' : ''}`}
          aria-label="Module relationships"
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          {projected.map((c) => {
            const a = coords(modules.find((m) => m.id === c.from)!),
              b = coords(modules.find((m) => m.id === c.to)!);
            const geometry = connectionPath(a, b, modules.map(coords));
            const label = labels.get(c.id);
            return (
              <g
                key={c.id}
                style={{
                  opacity:
                    focusMembers && (!focusMembers.includes(c.from) || !focusMembers.includes(c.to))
                      ? hideOthers
                        ? 0
                        : 0.12
                      : undefined,
                  pointerEvents:
                    focusMembers &&
                    hideOthers &&
                    (!focusMembers.includes(c.from) || !focusMembers.includes(c.to))
                      ? 'none'
                      : undefined,
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const exact = exactEdges(c);
                  if (exact.length === 1) contextMenu(e, { kind: 'connection', id: exact[0].id });
                  else explain(c);
                }}
                className={`${selections.includes(c.from) || selections.includes(c.to) ? 'related' : ''} edge-kind-${c.kind ?? 'dependency'}`}
              >
                <path className="edge-line" d={geometry.path} markerEnd="url(#arrow)">
                  <title>{c.label}</title>
                </path>
                <path
                  className="edge-hit"
                  role="button"
                  tabIndex={0}
                  aria-label={`Explain relationship: ${c.label}`}
                  d={geometry.path}
                  onMouseEnter={(e) => {
                    showHover('', e.currentTarget);
                    setHoverEdges(exactEdges(c));
                  }}
                  onMouseLeave={leaveHover}
                  onFocus={(e) => {
                    showHover('', e.currentTarget);
                    setHoverEdges(exactEdges(c));
                  }}
                  onBlur={leaveHover}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    explain(c);
                  }}
                  onKeyDown={(e) => {
                    if (e.shiftKey && e.key === 'F10') {
                      e.preventDefault();
                      e.stopPropagation();
                      const exact = exactEdges(c);
                      if (exact.length === 1) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        contextMenu(
                          { clientX: rect.x + 30, clientY: rect.y + 30 } as React.MouseEvent,
                          { kind: 'connection', id: exact[0].id },
                        );
                      } else explain(c);
                    }
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      explain(c);
                    }
                  }}
                />
                {label && (
                  <g className="connection-label">
                    <rect
                      x={label.x - label.width / 2}
                      y={label.y - 18}
                      width={label.width}
                      height={28}
                      rx={4}
                    />
                    <foreignObject
                      x={label.x - label.width / 2}
                      y={label.y - 18}
                      width={label.width}
                      height={28}
                    >
                      <div
                        className="edge-label"
                        onMouseEnter={(e) => {
                          showHover('', e.currentTarget);
                          setHoverEdges(exactEdges(c));
                        }}
                        onMouseLeave={leaveHover}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => explain(c)}
                      >
                        {label.text}
                      </div>
                    </foreignObject>
                  </g>
                )}
              </g>
            );
          })}
          {link &&
            (() => {
              const from = modules.find((m) => m.id === link.from)!;
              return (
                <path
                  className={`link-preview ${link.target ? 'snapped' : ''}`}
                  d={`M${from.x + 240},${from.y + 66} C${from.x + 305},${from.y + 66} ${link.x - 65},${link.y} ${link.x},${link.y}`}
                  markerEnd="url(#arrow)"
                />
              );
            })()}
        </svg>
        {modules.map((m, index) => {
          const children = document.modules.filter((n) => n.parent === m.id).length,
            notes = document.annotations.filter((a) =>
              sameTarget(a.target, { kind: 'node', id: m.id }),
            ).length;
          const type = document.nodeTypes?.find((t) => t.id === m.typeId);
          const severity = document.annotations
            .filter((a) => sameTarget(a.target, { kind: 'node', id: m.id }))
            .some((a) => a.severity === 'risk')
            ? 'risk'
            : document.annotations.some(
                  (a) =>
                    sameTarget(a.target, { kind: 'node', id: m.id }) && a.severity === 'warning',
                )
              ? 'warning'
              : 'info';
          const p = coords(m);
          return (
            <div
              key={m.id}
              className={`module-wrap ${selections.includes(m.id) || selection === m.id ? 'selected' : ''}`}
              style={{
                left: p.x,
                top: p.y,
                opacity: focusMembers && !focusMembers.includes(m.id) ? 0.15 : undefined,
                display:
                  focusMembers && hideOthers && !focusMembers.includes(m.id) ? 'none' : undefined,
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setHover(null);
                contextMenu(e, { kind: 'node', id: m.id });
              }}
            >
              <button
                className={`module-card kind-${m.kind}`}
                onPointerDown={(event) => start(event, m)}
                onDoubleClick={() => enter(m.id)}
                onClick={(e) => {
                  setHover(null);
                  if (!clickMoved.current)
                    select(m.id, multiSelect || e.shiftKey || e.metaKey || e.ctrlKey);
                }}
                aria-pressed={selections.includes(m.id)}
                onMouseEnter={(e) => showHover(m.id, e.currentTarget)}
                onMouseLeave={leaveHover}
                onFocus={(e) => showHover(m.id, e.currentTarget)}
                onBlur={leaveHover}
                onKeyDown={(e) => {
                  if (e.shiftKey && e.key === 'F10') {
                    e.preventDefault();
                    e.stopPropagation();
                    setHover(null);
                    const rect = e.currentTarget.getBoundingClientRect();
                    contextMenu(
                      { clientX: rect.x + 30, clientY: rect.y + 30 } as React.MouseEvent,
                      { kind: 'node', id: m.id },
                    );
                  }
                  if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    enter(m.id);
                  }
                  if (e.key === 'Escape') setHover(null);
                }}
                aria-label={`Inspect ${m.name}`}
                aria-describedby={hover === m.id ? `tip-${index}` : undefined}
              >
                <span className="module-type">{type?.label ?? m.kind}</span>
                <strong>{m.name}</strong>
                {type?.fields
                  .filter((f) => f.surface === 'card')
                  .map(
                    (f) =>
                      m.fields?.[f.id] !== undefined && (
                        <span className="card-field" key={f.id}>
                          <small>{f.label}</small> {String(m.fields[f.id])}
                        </span>
                      ),
                  )}
              </button>
              <div className="node-actions" onPointerDown={(e) => e.stopPropagation()}>
                {notes > 0 && (
                  <button
                    className={`note-badge ${severity}`}
                    onClick={() => {
                      setHover(null);
                      openNotes(m.id);
                    }}
                  >
                    {notes} {severity === 'info' ? 'note' + (notes > 1 ? 's' : '') : severity}
                  </button>
                )}
                <button
                  className="node-enter"
                  aria-label={children ? `Enter ${m.name}` : `Add child to ${m.name}`}
                  onClick={() => (children ? enter(m.id) : addChild(m.id))}
                >
                  {children ? `${children} inside →` : '+'}
                </button>
                <button
                  className="node-overflow"
                  aria-label={`Actions for ${m.name}`}
                  onClick={(e) => {
                    setHover(null);
                    contextMenu(e, { kind: 'node', id: m.id });
                  }}
                >
                  ⋯
                </button>
              </div>

              <button
                className={`port in ${link?.target === m.id ? 'snap-target' : ''}`}
                aria-label={`Connect to ${m.name}`}
                title="Input port · drop a connection here"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (link && link.from !== m.id) {
                    connect(link.from, m.id);
                    cancelLink();
                  }
                }}
              />
              <button
                className="port out"
                aria-label={`Connect from ${m.name}`}
                title="Drag to another module’s input port"
                onPointerDown={(e) => beginLink(e, m)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const next = { from: m.id, x: m.x + 240, y: m.y + 66, target: null };
                    setLink(next);
                    linkRef.current = next;
                  }
                }}
              />
            </div>
          );
        })}
      </div>
      {hoverModule && pinned !== hoverModule.id && !relationships && !drag.current && (
        <div
          id={`tip-${modules.findIndex((m) => m.id === hover)}`}
          className="canvas-tooltip"
          role="tooltip"
          onMouseEnter={keepHover}
          onMouseLeave={leaveHover}
          onPointerDown={(e) => e.stopPropagation()}
          style={{ left: hoverPoint.x, top: hoverPoint.y }}
        >
          <p>{hoverModule.summary}</p>
          {document.nodeTypes
            ?.find((t) => t.id === hoverModule.typeId)
            ?.fields.filter((f) => f.surface === 'peek')
            .map(
              (f) =>
                hoverModule.fields?.[f.id] !== undefined && (
                  <p key={f.id}>
                    <b>{f.label}</b> {String(hoverModule.fields[f.id])}
                  </p>
                ),
            )}
        </div>
      )}
      {hoverEdges.length > 0 && !relationships && !drag.current && (
        <div
          className="canvas-tooltip"
          role="tooltip"
          style={{ left: hoverPoint.x, top: hoverPoint.y }}
          onMouseEnter={keepHover}
          onMouseLeave={leaveHover}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {hoverEdges.map((c) => (
            <section key={c.id}>
              <strong>{c.label}</strong>
              <p>{c.description || 'No explanation recorded.'}</p>
            </section>
          ))}
        </div>
      )}
      {link && (
        <div className="link-instruction" role="status">
          {link.target
            ? 'Release to connect and describe the relationship'
            : 'Drag to an input port · Escape to cancel'}
        </div>
      )}
      {relationships && (
        <div onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
          <RelationshipDialog
            token={token}
            comment={(target) => {
              setRelationships(null);
              comment(target);
            }}
            document={document}
            connections={relationships}
            edit={edit}
            close={() => setRelationships(null)}
          />
        </div>
      )}
      {!modules.length && (
        <div className="canvas-empty">
          <span>◇</span>
          <h2>Inside this module</h2>
          <p>Add its internal modules, or ask Codex to describe its responsibilities.</p>
        </div>
      )}
      <div className="canvas-controls" onPointerDown={(e) => e.stopPropagation()}>
        <button onClick={() => zoomTo(Math.max(0.1, view.zoom - 0.1))} aria-label="Zoom out">
          −
        </button>
        <button aria-label="Read at 100 percent" title="Read at 100%" onClick={() => zoomTo(1)}>
          {Math.round(view.zoom * 100)}%
        </button>
        <button onClick={() => zoomTo(Math.min(1.6, view.zoom + 0.1))} aria-label="Zoom in">
          +
        </button>
        <i />
        <button onClick={fit}>Fit view</button>
        {selections.length > 0 && (
          <button
            onClick={() => {
              automaticFit.current = false;
              setView(
                fitView(
                  modules.filter((m) => selections.includes(m.id)),
                  size.width,
                  size.height,
                ),
              );
            }}
          >
            Fit selection
          </button>
        )}
        <button onClick={arrange} title="Arrange this scope for the pane; Undo restores positions">
          Arrange
        </button>
      </div>
      {view.zoom < 0.7 && (
        <div className="readability-hint" role="status">
          Overview scale · Arrange for this pane, or click the percentage to read at 100%.
        </div>
      )}
      <div className="canvas-hint">Drag to arrange · Scroll to pan · ⌘ scroll to zoom</div>
    </div>
  );
}
