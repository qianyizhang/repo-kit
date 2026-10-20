import { open, readdir, stat, mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { AppendHash, type HashState } from './sha256.ts';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import {
  emptyTokens,
  type Tokens,
  type UsageRecord,
  type Source,
  type Gap,
  type Snapshot,
} from './model.ts';
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {};
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const stamp = (v: unknown): string => {
  const s = str(v);
  return s && Number.isFinite(Date.parse(s)) ? new Date(s).toISOString() : '';
};
type Event = {
  record: UsageRecord;
  signature: string;
  total: Tokens | null;
  last: Tokens | null;
  lane: string;
};
type Parsed = { source: Source; events: Event[]; responses: UsageRecord[]; gaps: Gap[] };
type Context = { model: string; effort: string; project: string };
type Cursor = {
  offset: number;
  source: Source;
  context: Context;
  contexts: [string, Context][];
  events: number;
  responses: number;
  gaps: Gap[];
  hash: HashState;
};
type Entry = {
  size: number;
  mtime: number;
  ctime: number;
  ino: number;
  dev: number;
  boundary: string;
  parsed: Parsed;
  cursor: Cursor;
};
export type ScanCache = Map<string, Entry>;
const indexVersion = 3;
export async function loadIndex(directory: string): Promise<ScanCache> {
  try {
    const index = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8')) as {
      version: number;
      entries: [string, string][];
    };
    if (index.version !== indexVersion) return new Map();
    const cache: ScanCache = new Map();
    for (const [path, name] of index.entries) {
      if (!/^[a-f0-9]{64}\.json\.gz$/.test(name)) continue;
      try {
        const entry = JSON.parse(
          gunzipSync(await readFile(resolve(directory, name))).toString(),
        ) as Entry;
        if (entry.parsed.source.path === path && entry.cursor.hash.words.length === 8)
          cache.set(path, entry);
      } catch {
        /* Missing or damaged entry: rebuild just this source. */
      }
    }
    return cache;
  } catch {
    return new Map();
  }
}
async function atomicWrite(path: string, data: string | Buffer) {
  const temporary = path + '.' + randomUUID() + '.tmp';
  await writeFile(temporary, data, { mode: 0o600, flag: 'wx' });
  await rename(temporary, path);
}
export async function saveIndex(directory: string, cache: ScanCache, prior: ScanCache) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const entries: [string, string][] = [];
  for (const [path, entry] of cache) {
    const name = createHash('sha256').update(path).digest('hex') + '.json.gz';
    entries.push([path, name]);
    if (prior.get(path) !== entry)
      await atomicWrite(resolve(directory, name), gzipSync(JSON.stringify(entry)));
  }
  await atomicWrite(
    resolve(directory, 'manifest.json'),
    JSON.stringify({ version: indexVersion, entries }),
  );
}
async function boundary(handle: Awaited<ReturnType<typeof open>>, size: number) {
  const bytes = Buffer.alloc(Math.min(4096, size));
  await handle.read(bytes, 0, bytes.length, size - bytes.length);
  return createHash('sha256').update(bytes).digest('hex');
}
export function defaultRoots(): string[] {
  const home = process.env.CODEX_HOME || resolve(homedir(), '.codex');
  return [resolve(home, 'sessions'), resolve(home, 'archived_sessions')];
}
function counters(v: unknown): Tokens | null {
  const r = obj(v);
  if (r.input_tokens === undefined || r.output_tokens === undefined) return null;
  const count = (key: string, alternative?: string) => {
    const n = r[key] ?? (alternative ? r[alternative] : undefined) ?? 0;
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0)
      throw new Error(`Invalid ${key}`);
    return n;
  };
  const t = {
    input: count('input_tokens'),
    cached: count('cached_input_tokens', 'cache_read_input_tokens'),
    write: count('cache_write_input_tokens', 'cache_creation_input_tokens'),
    output: count('output_tokens'),
    reasoning: count('reasoning_output_tokens'),
  };
  if (t.cached + t.write > t.input || t.reasoning > t.output)
    throw new Error('Token subsets exceed totals');
  if (r.total_tokens !== undefined && count('total_tokens') !== t.input + t.output)
    throw new Error(
      `Inconsistent token counters: input ${t.input} + output ${t.output} ≠ total ${count('total_tokens')}; snapshot excluded`,
    );
  return t;
}
function addGap(gaps: Gap[], source: string, reason: string, line?: number) {
  const example = reason.startsWith('Inconsistent token counters:')
    ? reason.slice('Inconsistent token counters: '.length)
    : undefined;
  if (example) reason = 'Inconsistent token counters; snapshot excluded';
  const prior = gaps.find((g) => g.source === source && g.reason === reason);
  if (prior) prior.count++;
  else gaps.push({ source, reason, line, count: 1, ...(example ? { example } : {}) });
}
async function parseFile(
  path: string,
  previous?: Entry,
): Promise<{ entry: Entry; readBytes: number; appended: boolean }> {
  const handle = await open(path, 'r');
  const before = await handle.stat();
  const append =
    previous &&
    before.size > previous.size &&
    before.ino === previous.ino &&
    before.dev === previous.dev &&
    (await boundary(handle, previous.size)) === previous.boundary;
  const prior = append ? previous : undefined;
  const source: Source = prior
    ? { ...prior.cursor.source, bytes: before.size }
    : {
        path,
        session: '',
        parent: '',
        createdAt: '',
        bytes: before.size,
        sha256: '',
        lines: 0,
        records: 0,
      };
  const events = prior ? prior.parsed.events.slice(0, prior.cursor.events) : [];
  const responses = prior ? prior.parsed.responses.slice(0, prior.cursor.responses) : [];
  const gaps: Gap[] = prior ? structuredClone(prior.cursor.gaps) : [];
  let model = prior?.cursor.context.model ?? 'Unknown';
  let effort = prior?.cursor.context.effort ?? 'Unknown';
  let project = prior?.cursor.context.project ?? 'Unknown';
  const contexts = new Map<string, Context>(prior?.cursor.contexts);
  const digest = new AppendHash(prior?.cursor.hash);
  const offset = prior?.cursor.offset ?? 0;
  const start = Math.min(offset, prior?.cursor.hash.bytes ?? 0);
  let position = start;
  let committed = offset;
  let pending: Buffer = Buffer.alloc(0);
  const stream =
    before.size > start
      ? handle.createReadStream({ start, end: before.size - 1, autoClose: false })
      : null;
  function parseLine(line: string) {
    source.lines++;
    if (!line.trim()) return;
    let data: Obj;
    try {
      data = obj(JSON.parse(line));
    } catch {
      addGap(gaps, path, 'Malformed JSON (possibly an incomplete live tail)', source.lines);
      return;
    }
    const p = obj(data.payload);
    if (data.type === 'session_meta' && !source.session) {
      source.session = str(p.id) || str(p.thread_id);
      const spawn = obj(obj(obj(p.source).subagent).thread_spawn);
      source.parent = str(p.parent_thread_id) || str(spawn.parent_thread_id);
      source.forkedFrom = str(p.forked_from_id);
      source.historyBase = str(obj(p.history_base).thread_id);
      source.createdAt = stamp(p.timestamp ?? data.timestamp);
      project = str(p.cwd) || 'Unknown';
    }
    if (data.type === 'turn_context') {
      model = str(p.model) || 'Unknown';
      effort = str(p.effort) || str(p.reasoning_effort) || 'Unknown';
      project = str(p.cwd) || project;
      if (str(p.turn_id)) contexts.set(str(p.turn_id), { model, effort, project });
    }
    const isResponse = data.type === 'token_usage_record';
    if (!isResponse && !(data.type === 'event_msg' && p.type === 'token_count')) return;
    if (!isResponse && !p.info) return; // quota-only notices have no usage.
    try {
      const at = stamp(data.timestamp);
      if (!at) throw new Error('Usage has no valid timestamp');
      const context = isResponse
        ? (contexts.get(str(p.turn_id)) ?? { model, effort, project })
        : { model, effort, project };
      const info = obj(p.info);
      const record: UsageRecord = {
        id: '',
        session: isResponse ? str(p.thread_id) : source.session,
        parent: source.parent,
        at,
        ...context,
        model: str(info.model) || str(p.model) || context.model,
        tokens: emptyTokens(),
        source: path,
        line: source.lines,
        method: 'response',
      };
      if (isResponse) {
        const tokens = counters(p.usage);
        if (!tokens || !str(p.response_id) || !record.session)
          throw new Error('Incomplete per-response usage');
        record.reasoningReported = obj(p.usage).reasoning_output_tokens !== undefined;
        record.tokens = tokens;
        record.id = `${record.session}:${str(p.response_id)}`;
        responses.push(record);
      } else {
        const total = counters(info.total_token_usage);
        const last = counters(info.last_token_usage);
        if (!total && !last) throw new Error('Incomplete token snapshot');
        record.reasoningReported =
          obj(last ? info.last_token_usage : info.total_token_usage).reasoning_output_tokens !==
          undefined;
        record.method = last ? 'snapshot' : 'delta';
        events.push({
          record,
          total,
          last,
          lane: str(obj(p.rate_limits).limit_id),
          signature: JSON.stringify([at, total, last]),
        });
      }
    } catch (e) {
      addGap(gaps, path, e instanceof Error ? e.message : String(e), source.lines);
    }
  }
  try {
    if (stream)
      for await (const raw of stream) {
        const chunk = raw as Buffer;
        digest.update(chunk.subarray(Math.max(0, (prior?.cursor.hash.bytes ?? 0) - position)));
        const parseBytes = chunk.subarray(Math.max(0, offset - position));
        position += chunk.length;
        pending = pending.length ? Buffer.concat([pending, parseBytes]) : parseBytes;
        let last = 0;
        let newline: number;
        while ((newline = pending.indexOf(10, last)) !== -1) {
          parseLine(pending.subarray(last, newline).toString('utf8'));
          committed += newline + 1 - last;
          last = newline + 1;
        }
        pending = Buffer.from(pending.subarray(last));
      }
    const cursor: Cursor = {
      offset: committed,
      source: { ...source },
      context: { model, effort, project },
      contexts: [...contexts],
      events: events.length,
      responses: responses.length,
      gaps: structuredClone(gaps),
      hash: digest.state(),
    };
    // A valid unterminated line is provisional; retry it from its beginning on append.
    if (pending.length) parseLine(pending.toString('utf8'));
    source.sha256 = digest.hex();
    const after = await handle.stat();
    if (
      after.size < before.size ||
      (after.size === before.size && after.mtimeMs !== before.mtimeMs)
    )
      addGap(gaps, path, 'Source changed during scan; refresh to retry');
    if (!source.session) addGap(gaps, path, 'Missing session metadata; usage excluded');
    return {
      entry: {
        size: before.size,
        mtime: before.mtimeMs,
        ctime: before.ctimeMs,
        ino: before.ino,
        dev: before.dev,
        boundary: await boundary(handle, before.size),
        parsed: { source, events, responses, gaps },
        cursor,
      },
      readBytes: before.size - start,
      appended: !!prior,
    };
  } finally {
    stream?.destroy();
    await handle.close();
  }
}
async function discover(root: string, gaps: Gap[]): Promise<string[]> {
  try {
    const info = await stat(root);
    if (info.isFile()) return root.endsWith('.jsonl') ? [root] : [];
    const files: string[] = [];
    for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = resolve(root, entry.name);
      if (entry.isDirectory()) files.push(...(await discover(path, gaps)));
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(path);
    }
    return files;
  } catch (e) {
    addGap(gaps, root, `Cannot scan source: ${str(obj(e).code) || String(e)}`);
    return [];
  }
}
export async function scan(
  roots: string[] = defaultRoots(),
  cache: ScanCache = new Map(),
): Promise<Snapshot> {
  const snapshot: Snapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    roots: roots.map((r) => resolve(r)),
    sources: [],
    records: [],
    gaps: [],
    duplicates: 0,
    inherited: 0,
    cachedFiles: 0,
    appendedFiles: 0,
    reindexedFiles: 0,
    scannedBytes: 0,
  };
  const files = [
    ...new Set((await Promise.all(snapshot.roots.map((r) => discover(r, snapshot.gaps)))).flat()),
  ].sort();
  const parsed: Parsed[] = [];
  for (const path of files) {
    try {
      const s = await stat(path);
      const prior = cache.get(path);
      if (
        prior &&
        prior.size === s.size &&
        prior.mtime === s.mtimeMs &&
        prior.ctime === s.ctimeMs &&
        prior.ino === s.ino &&
        prior.dev === s.dev
      ) {
        parsed.push(prior.parsed);
        snapshot.cachedFiles++;
      } else {
        const result = await parseFile(path, prior);
        parsed.push(result.entry.parsed);
        cache.set(path, result.entry);
        snapshot.scannedBytes += result.readBytes;
        if (result.appended) snapshot.appendedFiles++;
        else snapshot.reindexedFiles++;
      }
    } catch (e) {
      addGap(snapshot.gaps, path, `Cannot read file: ${str(obj(e).code) || String(e)}`);
    }
  }
  for (const key of cache.keys()) if (!files.includes(key)) cache.delete(key);
  const bySession = new Map<string, Parsed[]>();
  const responseSessions = new Set<string>();
  const firstResponseAt = new Map<string, string>();
  for (const p of parsed) {
    snapshot.gaps.push(...p.gaps);
    if (!p.source.session) continue;
    bySession.set(p.source.session, [...(bySession.get(p.source.session) ?? []), p]);
    for (const r of p.responses)
      if (r.session === p.source.session) {
        responseSessions.add(r.session);
        const first = firstResponseAt.get(r.session);
        if (!first || r.at < first) firstResponseAt.set(r.session, r.at);
      }
  }
  const seen = new Map<string, UsageRecord>();
  function emit(r: UsageRecord) {
    const prior = seen.get(r.id);
    if (prior) {
      snapshot.duplicates++;
      if (JSON.stringify(prior.tokens) !== JSON.stringify(r.tokens) || prior.model !== r.model)
        addGap(
          snapshot.gaps,
          r.source,
          'Conflicting duplicate usage; first record retained',
          r.line,
        );
      return;
    }
    if (r.tokens.input + r.tokens.output === 0) return;
    seen.set(r.id, r);
    snapshot.records.push(r);
  }
  for (const p of parsed) {
    const source = { ...p.source };
    snapshot.sources.push(source);
    if (!source.session) continue;
    if (responseSessions.has(source.session)) {
      const first = firstResponseAt.get(source.session);
      for (const e of p.events)
        if (first && e.record.at < first)
          addGap(
            snapshot.gaps,
            source.path,
            'Legacy snapshots predate available response records; older usage excluded by response precedence',
            e.record.line,
          );
      for (const r of p.responses) {
        if (r.session !== source.session) {
          snapshot.inherited++;
          continue;
        }
        emit(r);
      }
      // Never combine overlapping response and cumulative accounting in one session.
      if (p.events.length && !p.responses.some((r) => r.session === source.session))
        addGap(
          snapshot.gaps,
          source.path,
          'Legacy snapshots excluded because response records exist in another copy of this session',
        );
    } else {
      const parentSignatures = new Set<string>();
      const historyParent = source.historyBase || source.forkedFrom;
      let parent = historyParent;
      const visited = new Set<string>([source.session]);
      let missingParent = false;
      while (parent && !visited.has(parent)) {
        visited.add(parent);
        const ancestors = bySession.get(parent);
        if (!ancestors) {
          missingParent = true;
          break;
        }
        for (const a of ancestors)
          for (const e of a.events)
            if (source.createdAt && e.record.at <= source.createdAt)
              parentSignatures.add(e.signature);
        parent = ancestors[0].source.historyBase || ancestors[0].source.forkedFrom;
      }
      if (!missingParent && parent && visited.has(parent)) {
        addGap(snapshot.gaps, source.path, 'Cyclic parent lineage; snapshot usage excluded');
        continue;
      }
      if (missingParent || (historyParent && !source.createdAt)) {
        addGap(
          snapshot.gaps,
          source.path,
          'Parent lineage unavailable; snapshot usage excluded to avoid counting replay',
        );
        continue;
      }
      const previous = new Map<string, Tokens>();
      const signatures = new Map<string, string>();
      let prefix = true;
      for (const e of p.events) {
        const raw = e.total ?? e.last;
        if (!raw) continue;
        const signature = JSON.stringify([e.total, e.last]);
        const duplicate = !!e.total && signatures.get(e.lane) === signature;
        if (e.total) signatures.set(e.lane, signature);
        const prior = previous.get(e.lane) ?? emptyTokens();
        if (e.total) previous.set(e.lane, e.total);
        if (prefix && parentSignatures.has(e.signature)) {
          snapshot.inherited++;
          continue;
        }
        prefix = false;
        if (duplicate) {
          snapshot.duplicates++;
          continue;
        }
        let tokens = e.last;
        if (!tokens && e.total) {
          // A paginated history may omit its copied prefix. Keep the first
          // cumulative observation as a baseline rather than billing it again.
          if (source.historyBase && !Object.values(prior).some(Boolean)) {
            addGap(
              snapshot.gaps,
              source.path,
              'Inherited history baseline unavailable; initial cumulative usage excluded',
              e.record.line,
            );
            continue;
          }
          if (
            (Object.keys(prior) as (keyof Tokens)[]).some((k) => e.total && e.total[k] < prior[k])
          ) {
            addGap(
              snapshot.gaps,
              source.path,
              'Cumulative counters decreased without per-response usage; interval excluded',
              e.record.line,
            );
            continue;
          }
          tokens = {
            input: raw.input - prior.input,
            cached: raw.cached - prior.cached,
            write: raw.write - prior.write,
            output: raw.output - prior.output,
            reasoning: raw.reasoning - prior.reasoning,
          };
          if (tokens.cached + tokens.write > tokens.input || tokens.reasoning > tokens.output) {
            addGap(
              snapshot.gaps,
              source.path,
              'Cumulative token delta does not reconcile; interval excluded',
              e.record.line,
            );
            continue;
          }
        }
        if (!tokens) continue;
        emit({
          ...e.record,
          tokens,
          id: `${source.session}:snapshot:${e.signature}`,
          session: source.session,
        });
      }
    }
    if (!p.responses.length && !p.events.length)
      addGap(snapshot.gaps, source.path, 'No metered usage in this file');
  }
  const recordCounts = new Map<string, number>();
  for (const r of snapshot.records)
    recordCounts.set(r.source, (recordCounts.get(r.source) ?? 0) + 1);
  for (const source of snapshot.sources) source.records = recordCounts.get(source.path) ?? 0;
  snapshot.records.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  snapshot.generatedAt = new Date().toISOString();
  return snapshot;
}
