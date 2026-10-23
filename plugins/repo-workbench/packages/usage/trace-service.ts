import { RuntimeError } from '../../../mcp-app-runtime/src/definition.ts';
import { stat } from 'node:fs/promises';
import { normalizeSessionFile, sessionTrace, readSessionBody } from '../trace/jsonl.ts';
import type { ReviewDocument } from '../session-review/src/model/contracts.ts';
import type { Snapshot } from './model.ts';
/** Shared lazy reader for HTTP and MCP; only indexed sessions are addressable. */
export function createTraceReader(snapshot: () => Snapshot) {
  let traceCache: { key: string; promise: Promise<{ data: ReviewDocument }> } | undefined;
  return async function fullTrace(session: string) {
    const canonical = new Map<string, Snapshot['sources'][number]>();
    for (const source of snapshot().sources) {
      if (!source.session) continue;
      const prior = canonical.get(source.session);
      if (!prior || source.bytes > prior.bytes) canonical.set(source.session, source);
    }
    if (!canonical.has(session)) return null;
    const selected = new Set([session]);
    let count: number;
    do {
      count = selected.size;
      for (const source of canonical.values())
        if (selected.has(source.parent)) selected.add(source.session);
    } while (selected.size !== count);
    const sources = [
      canonical.get(session)!,
      ...[...canonical.values()].filter(
        (source) => source.session !== session && selected.has(source.session),
      ),
    ];
    const stamps = await Promise.all(
      sources.map(async (source) => {
        const s = await stat(source.path);
        return [source.path, s.size, s.mtimeMs, s.ctimeMs, s.ino, s.dev];
      }),
    );
    const key = JSON.stringify([session, stamps]);
    if (traceCache?.key === key) return traceCache.promise;
    const promise = (async () => {
      const threads = [];
      for (const source of sources)
        threads.push(
          await normalizeSessionFile(
            source.path,
            source.session,
            source.session === session ? 'Selected session' : 'Child session',
            { lazyBodies: true },
          ),
        );
      const data = sessionTrace(threads, session);
      return { data };
    })();
    traceCache = { key, promise };
    try {
      return await promise;
    } catch (error) {
      if (traceCache?.promise === promise) traceCache = undefined;
      throw error;
    }
  };
}
export async function readRecord(data: ReviewDocument, key: string, revision: string) {
  const thread = data.threads.find((t) =>
    t.turns.some((turn) => turn.events.some((e) => e.key === key)),
  );
  const event = thread?.turns.flatMap((turn) => turn.events).find((e) => e.key === key);
  if (!thread || !event?.body) throw new RuntimeError('not_found', 'Record not found');
  if (revision !== event.body.sources.map((s) => s.sha256).join('.'))
    throw new RuntimeError('stale', 'Source record changed. Reopen the trace.');
  return readSessionBody(thread, event);
}
export function textBlock(value: string, offset: number) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > value.length)
    throw new Error('Invalid record range');
  let end = Math.min(value.length, offset + 64 * 1024);
  if (
    end < value.length &&
    value.charCodeAt(end - 1) >= 0xd800 &&
    value.charCodeAt(end - 1) <= 0xdbff
  )
    end++;
  return { text: value.slice(offset, end), offset, nextOffset: end, total: value.length };
}
