import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import type { TraceAction } from '../model/actions.ts';
import { actionDescription, actionKind } from '../model/actions.ts';
/** Tracks actual card geometry, including native details expansion and lazy body resizing. */
function useViewport(list: RefObject<HTMLDivElement | null>, actions: TraceAction[]) {
  const [position, setPosition] = useState({ current: '', visible: new Set<string>() });
  useEffect(() => {
    const root = list.current;
    if (!root) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const rows = [...root.querySelectorAll<HTMLElement>(':scope > [data-event-key]')];
      const visible = new Set<string>();
      const anchor = Math.min(160, innerHeight * 0.25);
      let best = '',
        distance = Infinity;
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (rect.bottom > 80 && rect.top < innerHeight) visible.add(row.dataset.eventKey!);
        const delta =
          rect.top <= anchor && rect.bottom > anchor
            ? 0
            : Math.min(Math.abs(rect.top - anchor), Math.abs(rect.bottom - anchor));
        if (delta < distance) {
          distance = delta;
          best = row.dataset.eventKey!;
        }
      }
      setPosition((prior) =>
        prior.current === best && [...visible].join() === [...prior.visible].join()
          ? prior
          : { current: best, visible },
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    // Request bodies and folded context above the list can move every card without resizing it.
    const surface = root.closest('main');
    if (surface) observer.observe(surface);
    root.querySelectorAll(':scope > article').forEach((row) => observer.observe(row));
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [list, actions]);
  return position;
}
export function Minimap({
  id = 'action-context',
  children,
  actions,
  scope,
  list,
  kind,
  filter,
  jump,
}: {
  id?: string;
  children?: ReactNode;
  actions: TraceAction[];
  scope: TraceAction[];
  list: RefObject<HTMLDivElement | null>;
  kind: string;
  filter: (kind: string) => void;
  jump: (action: TraceAction) => void;
}) {
  const viewport = useViewport(list, actions);
  const stride = Math.max(1, Math.ceil(actions.length / 180));
  const buckets = Array.from({ length: Math.ceil(actions.length / stride) }, (_, i) =>
    actions.slice(i * stride, (i + 1) * stride),
  );
  const counts = new Map<string, number>();
  scope.forEach((a) => counts.set(actionKind(a), (counts.get(actionKind(a)) ?? 0) + 1));
  return (
    <aside id={id} className="minimap-panel">
      {children}
      <div className="section-heading">
        <h3>Action map</h3>
        <span className="small">{actions.length} actions</span>
      </div>
      <div className="action-minimap" aria-label="Action minimap">
        {buckets.map((bucket, i) => {
          const a = bucket[0],
            current = bucket.some((a) => a.key === viewport.current),
            visible = bucket.some((a) => viewport.visible.has(a.key));
          const kinds = bucket.map(actionKind);
          const mixed = new Set(kinds).size > 1;
          const background = mixed
            ? `linear-gradient(90deg, ${kinds.map((kind, index) => `var(--event-${kind}) ${(index / kinds.length) * 100}% ${((index + 1) / kinds.length) * 100}%`).join(', ')})`
            : undefined;
          return (
            <button
              key={a.key}
              className={'map-cell type-' + actionKind(a) + (visible ? ' map-visible' : '')}
              style={{ backgroundImage: background }}
              aria-current={current ? 'location' : undefined}
              aria-pressed={current}
              aria-label={`Jump to action ${i * stride + 1}: ${actionKind(a)}`}
              title={`${i * stride + 1}${bucket.length > 1 ? '–' + (i * stride + bucket.length) : ''} · ${actionDescription(a)}`}
              onClick={() => jump(a)}
            />
          );
        })}
      </div>
      <p className="map-hint">Outline follows reading position</p>
      <div className="map-legend">
        <button className="map-key" aria-pressed={kind === 'all'} onClick={() => filter('all')}>
          All types
        </button>
        {[...counts].map(([type, count]) => (
          <button
            key={type}
            className={'map-key type-' + type}
            aria-pressed={kind === type}
            aria-label={'Filter ' + type + ' actions'}
            onClick={() => filter(kind === type ? 'all' : type)}
          >
            {type} <span>{count}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
