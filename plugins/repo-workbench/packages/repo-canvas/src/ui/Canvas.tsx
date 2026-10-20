import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  ancestors,
  visibleConnections,
  type Architecture,
  type Module,
  type Connection,
} from '../model/document';
import { RelationshipDialog } from './RelationshipDialog';
interface Props {
  document: Architecture;
  scope: string;
  selection: string | null;
  select: (id: string | null) => void;
  enter: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  edit: (document: Architecture) => void;
}
export function Canvas({ document, scope, selection, select, enter, move, edit }: Props) {
  const modules = document.modules.filter((m) => m.parent === scope);
  const modulesRef = useRef(modules);
  modulesRef.current = modules;
  const [view, setView] = useState({ x: 0, y: 0, zoom: 0.8 });
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
  function start(event: PointerEvent, node?: Module) {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (node) select(node.id);
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
    const minX = Math.min(...modules.map((m) => m.x)) - 45,
      minY = Math.min(...modules.map((m) => m.y)) - 65;
    const w = Math.max(...modules.map((m) => m.x)) + 285 - minX,
      h = Math.max(...modules.map((m) => m.y)) + 250 - minY;
    const zoom = Math.min(
      1.15,
      viewport.current.clientWidth / w,
      viewport.current.clientHeight / h,
    );
    setView({ x: -minX * zoom, y: -minY * zoom, zoom });
  }, []);
  useEffect(() => {
    const observer = new ResizeObserver(fit);
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [fit]);
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
      onPointerDown={(e) => start(e)}
      onPointerMove={onMove}
      onPointerUp={end}
      onPointerCancel={() => {
        cancelLink();
        drag.current = null;
        setPosition(null);
      }}
      onWheel={(event) => {
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
        <svg className="connections" aria-label="Module relationships">
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
          {visibleConnections(document, scope).map((c) => {
            const a = coords(modules.find((m) => m.id === c.from)!),
              b = coords(modules.find((m) => m.id === c.to)!);
            const x1 = a.x + 240,
              y1 = a.y + 66,
              x2 = b.x,
              y2 = b.y + 66;
            return (
              <g key={c.id} className={selection === c.from || selection === c.to ? 'related' : ''}>
                <path
                  className="edge-line"
                  d={`M${x1},${y1} C${x1 + 65},${y1} ${x2 - 65},${y2} ${x2},${y2}`}
                  markerEnd="url(#arrow)"
                >
                  <title>{c.label} · Click to explain</title>
                </path>
                <path
                  className="edge-hit"
                  role="button"
                  tabIndex={0}
                  aria-label={`Explain relationship: ${c.label}`}
                  d={`M${x1},${y1} C${x1 + 65},${y1} ${x2 - 65},${y2} ${x2},${y2}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    const projected = (id: string) =>
                      ancestors(document, id).find((m) => m.parent === scope)?.id;
                    setRelationships(
                      document.connections.filter(
                        (edge) => projected(edge.from) === c.from && projected(edge.to) === c.to,
                      ),
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      const projected = (id: string) =>
                        ancestors(document, id).find((m) => m.parent === scope)?.id;
                      setRelationships(
                        document.connections.filter(
                          (edge) => projected(edge.from) === c.from && projected(edge.to) === c.to,
                        ),
                      );
                    }
                  }}
                />
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 9}
                  textAnchor="middle"
                  className="edge-label"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    const projected = (id: string) =>
                      ancestors(document, id).find((m) => m.parent === scope)?.id;
                    setRelationships(
                      document.connections.filter(
                        (edge) => projected(edge.from) === c.from && projected(edge.to) === c.to,
                      ),
                    );
                  }}
                >
                  {c.label}
                </text>
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
            notes = document.annotations.filter((a) => a.target === m.id).length;
          const p = coords(m);
          return (
            <div
              key={m.id}
              className={`module-wrap ${selection === m.id ? 'selected' : ''}`}
              style={{ left: p.x, top: p.y }}
            >
              <button
                className={`module-card kind-${m.kind}`}
                onPointerDown={(event) => start(event, m)}
                onDoubleClick={() => enter(m.id)}
                onClick={() => select(m.id)}
                onMouseEnter={() => setHover(m.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(m.id)}
                onBlur={() => setHover(null)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    enter(m.id);
                  }
                  if (e.key === 'Escape') setHover(null);
                }}
                aria-label={`Inspect ${m.name}`}
                aria-describedby={hover === m.id ? `tip-${index}` : undefined}
              >
                <span className="module-type">{m.kind}</span>
                <strong>{m.name}</strong>
                <span className="module-summary">{m.summary}</span>
                <span className="module-footer">
                  <span>
                    {children
                      ? `${children} internal modules`
                      : `${m.sources.length} source references`}
                  </span>
                  <span>{notes ? `${notes} notes` : children ? '↳' : '·'}</span>
                </span>
              </button>
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
              {hover === m.id && !drag.current && (
                <div id={`tip-${index}`} className="hover-card" role="tooltip">
                  <b>{m.name}</b>
                  <p>{m.summary}</p>
                  <code>{m.sources[0] ?? 'No source attached'}</code>
                  <span>Click to inspect · Double-click to enter</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
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
        <button
          onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.3, v.zoom - 0.1) }))}
          aria-label="Zoom out"
        >
          −
        </button>
        <span>{Math.round(view.zoom * 100)}%</span>
        <button
          onClick={() => setView((v) => ({ ...v, zoom: Math.min(1.6, v.zoom + 0.1) }))}
          aria-label="Zoom in"
        >
          +
        </button>
        <i />
        <button onClick={fit}>Fit view</button>
      </div>
      <div className="canvas-hint">Drag to arrange · Scroll to pan · ⌘ scroll to zoom</div>
    </div>
  );
}
