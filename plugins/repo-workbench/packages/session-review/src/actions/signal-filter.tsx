import type { TraceAction } from '../model/actions.ts';
import { signalLabels, type ReviewSignal } from '../model/signals.ts';
export function SignalFilter({
  actions,
  value,
  change,
}: {
  actions: TraceAction[];
  value: string;
  change: (value: string) => void;
}) {
  const counts = new Map<ReviewSignal, number>();
  for (const action of actions)
    for (const signal of action.signals) counts.set(signal, (counts.get(signal) ?? 0) + 1);
  if (!counts.size && value === 'all') return null;
  return (
    <nav className="signal-filter" aria-label="Review signals">
      <span
        className="small"
        title="Observed markers in this scope. A missing result can reflect incomplete capture, not a failed tool."
      >
        Review signals
      </span>
      <button aria-pressed={value === 'all'} onClick={() => change('all')}>
        All activity
      </button>
      {Object.entries(signalLabels)
        .filter(([key]) => counts.has(key as ReviewSignal) || value === key)
        .map(([key, label]) => (
          <button
            key={key}
            aria-pressed={value === key}
            onClick={() => change(value === key ? 'all' : key)}
          >
            {label} <span>{counts.get(key as ReviewSignal) ?? 0}</span>
          </button>
        ))}
    </nav>
  );
}
