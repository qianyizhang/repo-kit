import type { TraceEvent } from './contracts.ts';
/** Exact runtime envelopes, not arbitrary mentions of goals or reviews in user text. */
export function requestKind(text: string): 'request' | 'goal' | 'auto-review' {
  if (/^\s*<codex_internal_context\b[^>]*\bsource\s*=\s*['"]goal['"][^>]*>/.test(text))
    return 'goal';
  if (
    /^\s*The following is the Codex agent history added since your last approval assessment\./.test(
      text,
    )
  )
    return 'auto-review';
  return 'request';
}
export function classifyRequest(event: TraceEvent): void {
  if (event.kind !== 'request') return;
  event.kind = requestKind(event.text);
  if (event.kind === 'goal') {
    event.title = 'Goal continuation';
    event.role = 'Codex runtime';
  }
  if (event.kind === 'auto-review') {
    event.title = 'Approval review context';
    event.role = 'Auto-review';
  }
}
