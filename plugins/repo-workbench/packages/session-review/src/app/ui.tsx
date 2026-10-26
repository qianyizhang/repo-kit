import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useReview } from './context.tsx';
export function Help({
  label,
  trigger = '?',
  children,
}: {
  label?: string;
  trigger?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
    };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [open]);
  return (
    <span
      className="help-target"
      tabIndex={0}
      aria-label={label}
      aria-describedby={id}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.matches(':hover')) setOpen(false);
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.matches(':focus-within')) setOpen(false);
      }}
    >
      {trigger}
      <span id={id} role="tooltip" className="tooltip" hidden={!open}>
        <span className="tooltip-content">{children}</span>
      </span>
    </span>
  );
}
export function AgentOptions({ all = false }: { all?: boolean }) {
  const { document, state, label } = useReview();
  return (
    <>
      {all && <option value="all">All agents</option>}
      {document.threads
        .filter((t) => t.purpose !== 'auto-review')
        .map((t) => (
          <option key={t.id} value={t.id}>
            {label(t.id)}
          </option>
        ))}
      {state.reviews && document.threads.some((t) => t.purpose === 'auto-review') && (
        <option value="__reviews__">Auto-review</option>
      )}
    </>
  );
}
export function Drawer({
  title,
  children,
  artifact,
  close,
}: {
  title: string;
  children: ReactNode;
  artifact?: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const before = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (before instanceof HTMLElement && before.isConnected) before.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      id="evidence-drawer"
      aria-labelledby="drawer-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="drawer-inner">
        <div className="section-heading">
          <h2 id="drawer-title">{title}</h2>
          <button onClick={close}>Close evidence ×</button>
        </div>
        <div id="drawer-artifact">{artifact}</div>
        <div id="drawer-content">{children}</div>
      </div>
    </dialog>
  );
}
export function Pager({
  page,
  total,
  size,
  change,
  previous = '← Previous',
  next = 'Next →',
}: {
  page: number;
  total: number;
  size: number;
  change: (page: number) => void;
  previous?: string;
  next?: string;
}) {
  return (
    <div className="pager">
      <button disabled={page === 0} onClick={() => change(page - 1)}>
        {previous}
      </button>
      <span>
        Page {total ? page + 1 : 0} / {Math.ceil(total / size)}
      </span>
      <button disabled={(page + 1) * size >= total} onClick={() => change(page + 1)}>
        {next}
      </button>
    </div>
  );
}
