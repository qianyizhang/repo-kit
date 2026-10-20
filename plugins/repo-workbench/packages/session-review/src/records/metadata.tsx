import type { RecordedTurn } from '../model/contracts.ts';
export function duration(ms: number) {
  if (ms < 1) return '<1 ms';
  if (ms < 1000) return Math.round(ms) + ' ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + ' s';
  return Math.floor(ms / 60000) + 'm ' + Math.floor((ms % 60000) / 1000) + 's';
}
const tokens = (n: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
export function TurnMetadata({ turn }: { turn: RecordedTurn }) {
  if (!turn.usage && turn.elapsedMs === undefined) return null;
  return (
    <div className="turn-metadata" aria-label="Recorded turn metrics">
      {turn.elapsedMs !== undefined && (
        <span title="Elapsed turn time, including tools and waits">
          {duration(turn.elapsedMs)} elapsed
        </span>
      )}
      {turn.usage && (
        <>
          <span
            title={`${turn.usage.inputTokens.toLocaleString()} recorded input tokens; includes cached input`}
          >
            {tokens(turn.usage.inputTokens)} input tokens
          </span>
          <span title={`${turn.usage.cachedInputTokens.toLocaleString()} cached input tokens`}>
            {tokens(turn.usage.cachedInputTokens)} cached
          </span>
          <span
            title={`${turn.usage.outputTokens.toLocaleString()} recorded output tokens across ${turn.usage.responses} model responses`}
          >
            {tokens(turn.usage.outputTokens)} output tokens
          </span>
        </>
      )}
    </div>
  );
}
