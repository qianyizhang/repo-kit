export type Tokens = {
  input: number;
  cached: number;
  write: number;
  output: number;
  reasoning: number;
};
export type UsageRecord = {
  id: string;
  session: string;
  parent: string;
  at: string;
  model: string;
  effort: string;
  project: string;
  tokens: Tokens;
  reasoningReported?: boolean;
  source: string;
  line: number;
  method: 'response' | 'snapshot' | 'delta';
};
export type Source = {
  path: string;
  session: string;
  parent: string;
  forkedFrom?: string;
  historyBase?: string;
  createdAt: string;
  bytes: number;
  sha256: string;
  lines: number;
  records: number;
};
export type Gap = {
  source: string;
  line?: number;
  reason: string;
  count: number;
  example?: string;
};
export type Snapshot = {
  schemaVersion: 1;
  generatedAt: string;
  roots: string[];
  sources: Source[];
  records: UsageRecord[];
  gaps: Gap[];
  duplicates: number;
  inherited: number;
  cachedFiles: number;
  appendedFiles: number;
  reindexedFiles: number;
  scannedBytes: number;
};
export type Price = {
  input: number;
  cached: number;
  write: number;
  output: number;
  longContext?: boolean;
  writeUnpublished?: boolean;
};
export type Prices = Record<string, Price>;
export type Filters = {
  from: string;
  to: string;
  model: string;
  project: string;
  effort: string;
  search: string;
  timezone: string;
  ignoreAutoReview?: boolean;
};
export const emptyTokens = (): Tokens => ({
  input: 0,
  cached: 0,
  write: 0,
  output: 0,
  reasoning: 0,
});
const formatters = new Map<string, Intl.DateTimeFormat>();
export function dateKey(at: string, timezone: string): string {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(new Date(at));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function selectRecords(records: UsageRecord[], filters: Filters): UsageRecord[] {
  const autoReview = new Set<string>();
  if (filters.ignoreAutoReview) {
    const ordinary = new Set<string>();
    for (const r of records)
      (r.model === 'codex-auto-review' ? autoReview : ordinary).add(r.session);
    for (const session of ordinary) autoReview.delete(session);
  }
  return records.filter((r) => {
    if (autoReview.has(r.session)) return false;
    const day = dateKey(r.at, filters.timezone);
    return (
      (!filters.from || day >= filters.from) &&
      (!filters.to || day <= filters.to) &&
      (!filters.model || r.model === filters.model) &&
      (!filters.project || r.project === filters.project) &&
      (!filters.effort || r.effort === filters.effort) &&
      (!filters.search ||
        `${r.session} ${r.model} ${r.project} ${r.effort}`
          .toLowerCase()
          .includes(filters.search.toLowerCase()))
    );
  });
}
export function estimate(r: UsageRecord, prices: Prices): number | null {
  const p = Object.hasOwn(prices, r.model) ? prices[r.model] : undefined;
  if (!p || (p.writeUnpublished && r.tokens.write > 0)) return null;
  const long = p.longContext && r.tokens.input > 272_000;
  return (
    (((r.tokens.input - r.tokens.cached - r.tokens.write) * p.input +
      r.tokens.cached * p.cached +
      r.tokens.write * p.write) *
      (long ? 2 : 1) +
      r.tokens.output * p.output * (long ? 1.5 : 1)) /
    1_000_000
  );
}
export function summarize(records: UsageRecord[], prices: Prices) {
  const tokens = emptyTokens();
  let knownCost = 0;
  let priced = 0;
  for (const r of records) {
    for (const key of Object.keys(tokens) as (keyof Tokens)[]) tokens[key] += r.tokens[key];
    const cost = estimate(r, prices);
    if (cost !== null) {
      knownCost += cost;
      priced++;
    }
  }
  return {
    tokens,
    total: tokens.input + tokens.output,
    sessions: new Set(records.map((r) => r.session)).size,
    events: records.length,
    knownCost,
    reasoningShare: tokens.output ? tokens.reasoning / tokens.output : null,
    missingReasoning: records.filter((r) => r.reasoningReported === false && r.tokens.output > 0)
      .length,
    priced,
  };
}
export function parsePrices(value: unknown): Prices {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected model prices object');
  const result: Prices = {};
  for (const [model, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new Error(`Invalid price for ${model}`);
    const r = raw as Record<string, unknown>;
    const number = (key: string) => {
      const n = r[key];
      if (typeof n !== 'number' || !Number.isFinite(n) || n < 0)
        throw new Error(`Invalid ${key} price for ${model}`);
      return n;
    };
    // Null-prototype keys are not required: defineProperty safely preserves model names such as __proto__.
    Object.defineProperty(result, model, {
      value: {
        input: number('input'),
        cached: number('cached'),
        write: number('write'),
        output: number('output'),
        ...(r.longContext === true ? { longContext: true } : {}),
        ...(r.writeUnpublished === true ? { writeUnpublished: true } : {}),
      },
      enumerable: true,
    });
  }
  return result;
}
export function csv(records: UsageRecord[], prices: Prices): string {
  const cell = (value: string | number | null) => {
    let s = String(value ?? '');
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const rows: (string | number | null)[][] = [
    [
      'timestamp',
      'session',
      'model',
      'effort',
      'project',
      'input_including_cache',
      'cache_read',
      'cache_write',
      'output_including_reasoning',
      'reasoning',
      'estimated_usd',
      'method',
      'source',
      'line',
    ],
  ];
  for (const r of records)
    rows.push([
      r.at,
      r.session,
      r.model,
      r.effort,
      r.project,
      r.tokens.input,
      r.tokens.cached,
      r.tokens.write,
      r.tokens.output,
      r.tokens.reasoning,
      estimate(r, prices),
      r.method,
      r.source,
      r.line,
    ]);
  return rows.map((row) => row.map(cell).join(',')).join('\r\n');
}
