import type { TraceThread } from './contracts.ts';
type Obj = Record<string, unknown>;
type Turn = TraceThread['turns'][number];
/** Small display-only totals from explicit response usage and turn lifecycle records. */
export class TurnTelemetry {
  private usage = new Map<string, NonNullable<Turn['usage']>>();
  private responses = new Set<string>();
  private times = new Map<string, { start?: number; end?: number }>();
  observe(type: string, payload: Obj, timestamp: string) {
    const turn = typeof payload.turn_id === 'string' ? payload.turn_id : '';
    if (!turn) return;
    if (type === 'token_usage_record' && typeof payload.response_id === 'string') {
      const key = JSON.stringify([turn, payload.response_id]);
      if (this.responses.has(key)) return;
      const value = payload.usage as Obj | undefined;
      if (
        !value ||
        typeof value.input_tokens !== 'number' ||
        typeof value.output_tokens !== 'number' ||
        !Number.isFinite(value.input_tokens) ||
        !Number.isFinite(value.output_tokens) ||
        value.input_tokens < 0 ||
        value.output_tokens < 0
      )
        return;
      this.responses.add(key);
      const sum = this.usage.get(turn) ?? {
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        responses: 0,
      };
      sum.inputTokens += value.input_tokens;
      sum.outputTokens += value.output_tokens;
      sum.cachedInputTokens +=
        typeof value.cached_input_tokens === 'number' && Number.isFinite(value.cached_input_tokens)
          ? Math.max(0, value.cached_input_tokens)
          : 0;
      sum.responses++;
      this.usage.set(turn, sum);
    }
    if (type !== 'event_msg' || !Number.isFinite(Date.parse(timestamp))) return;
    const time = this.times.get(turn) ?? {};
    if (payload.type === 'task_started') time.start ??= Date.parse(timestamp);
    if (payload.type === 'task_complete' || payload.type === 'task_completed')
      time.end = Date.parse(timestamp);
    this.times.set(turn, time);
  }
  apply(turns: Turn[]) {
    for (const turn of turns) {
      turn.usage = this.usage.get(turn.id);
      const time = this.times.get(turn.id);
      if (time?.start !== undefined) turn.startedAt = time.start / 1000;
      if (time?.end !== undefined) turn.completedAt = time.end / 1000;
      if (time?.start !== undefined && time.end !== undefined && time.end >= time.start)
        turn.elapsedMs = time.end - time.start;
    }
  }
}
