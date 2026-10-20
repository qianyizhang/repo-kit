import { renderReview } from '../session-review/build.ts';
import type { ReviewDocument } from '../session-review/src/model/contracts.ts';
import { readSessionBody, normalizeSessionFile, sessionTrace } from '../trace/jsonl.ts';
import { asset } from '../runtime/assets.ts';
import { mkdtemp, mkdir, writeFile, realpath, stat } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { basename, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';

import { createServer, type Server } from 'node:http';
import { gzipSync } from 'node:zlib';
import { scan, defaultRoots, loadIndex, saveIndex, type ScanCache } from './scan.ts';
import type { Snapshot } from './model.ts';

export function runtime(): Promise<string> {
  return asset('usage.js');
}
export async function render(snapshot: Snapshot, javascript: string): Promise<string> {
  const template = await asset('usage.html');
  const css = await asset('usage.css');
  return template
    .replace('<!--USAGE_STYLE-->', () => `<style>${css}</style>`)
    .replace(
      '<!--USAGE_DATA-->',
      () =>
        `<script id="usage-data" type="application/octet-stream">${gzipSync(JSON.stringify(snapshot)).toString('base64')}</script>`,
    )
    .replace(
      '<!--USAGE_RUNTIME-->',
      () => `<script>${javascript.replaceAll('</script', '<\\/script')}</script>`,
    );
}
export async function buildDashboard(
  options: {
    roots?: string[];
    output?: string;
    cache?: ScanCache;
    index?: string;
    cwd?: string;
  } = {},
) {
  const cwd = resolve(options.cwd ?? process.cwd());
  const roots = (options.roots ?? defaultRoots()).map((root) => resolve(cwd, root));
  const canonicalRoots = await Promise.all(
    roots.map(async (path) => {
      try {
        return await realpath(path);
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
          return path;
        throw error;
      }
    }),
  );
  const parent =
    options.output === undefined
      ? await mkdtemp(resolve(tmpdir(), 'repo-workbench-usage-'))
      : await realpath(resolve(cwd, options.output, '..'));
  const output = resolve(
    parent,
    options.output === undefined ? 'report' : basename(resolve(cwd, options.output)),
  );
  if (
    canonicalRoots.some((r) => {
      const source = resolve(r);
      return (
        output === source || output.startsWith(source + sep) || source.startsWith(output + sep)
      );
    })
  )
    throw new Error('Output overlaps input');
  await mkdir(output); // Exclusive; never overwrite another report.
  const prior = new Map(options.cache);
  const snapshot = await scan(roots, options.cache);
  if (options.index && options.cache) await saveIndex(options.index, options.cache, prior);
  const javascript = await runtime();
  const html = await render(snapshot, javascript);
  await writeFile(resolve(output, 'index.html'), html, { flag: 'wx' });
  await writeFile(resolve(output, 'usage.json'), JSON.stringify(snapshot), { flag: 'wx' });
  return { snapshot, javascript, output, html, file: resolve(output, 'index.html') };
}
export function startServer(
  initial: Awaited<ReturnType<typeof buildDashboard>>,
  roots: string[],
  cache: ScanCache,
  port: number,
  index?: string,
): Promise<{ server: Server; url: string }> {
  let html = initial.html;
  let currentSnapshot = initial.snapshot;
  let traceCache:
    { key: string; promise: Promise<{ data: ReviewDocument; html: string }> } | undefined;
  async function fullTrace(session: string) {
    const canonical = new Map<string, Snapshot['sources'][number]>();
    for (const source of currentSnapshot.sources) {
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
      return { data, html: await renderReview(data) };
    })();
    traceCache = { key, promise };
    try {
      return await promise;
    } catch (error) {
      if (traceCache?.promise === promise) traceCache = undefined;
      throw error;
    }
  }
  let refreshing = false;
  const server = createServer((request, response) => {
    void (async () => {
      const address = server.address();
      const activePort = address && typeof address === 'object' ? address.port : port;
      const origin = `http://127.0.0.1:${activePort}`;
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      );
      if (request.headers.host !== `127.0.0.1:${activePort}`) {
        response.writeHead(403).end('Invalid host');
        return;
      }
      const target = new URL(request.url ?? '/', origin);
      if (request.method === 'GET' && ['/trace-record', '/trace-image'].includes(target.pathname)) {
        const trace = await fullTrace(target.searchParams.get('session') ?? '');
        const key = target.searchParams.get('event');
        const thread = trace?.data.threads.find((t) =>
          t.turns.some((turn) => turn.events.some((e) => e.key === key)),
        );
        const event = thread?.turns.flatMap((turn) => turn.events).find((e) => e.key === key);
        if (!thread || !event?.body) {
          response.writeHead(404).end('Record not found');
          return;
        }
        if (
          target.searchParams.get('revision') !==
          event.body.sources.map((source) => source.sha256).join('.')
        ) {
          response.writeHead(409).end('Source record changed. Reopen the trace to refresh it.');
          return;
        }
        if (target.pathname === '/trace-record') {
          const field = target.searchParams.get('field');
          const offset = Number(target.searchParams.get('offset') ?? 0);
          if (
            !['text', 'output'].includes(field ?? '') ||
            !Number.isSafeInteger(offset) ||
            offset < 0
          ) {
            response.writeHead(400).end('Invalid record range');
            return;
          }
          const body = await readSessionBody(thread, event);
          const value = field === 'output' ? (body.output ?? '') : body.text;
          if (offset > value.length) {
            response.writeHead(400).end('Invalid record range');
            return;
          }
          let end = Math.min(value.length, offset + 64 * 1024);
          // Do not split a UTF-16 surrogate pair between blocks.
          if (
            end < value.length &&
            value.charCodeAt(end - 1) >= 0xd800 &&
            value.charCodeAt(end - 1) <= 0xdbff
          )
            end++;
          response.setHeader('Content-Type', 'application/json');
          response.end(
            JSON.stringify({
              text: value.slice(offset, end),
              offset,
              nextOffset: end,
              total: value.length,
            }),
          );
        } else {
          const index = Number(target.searchParams.get('image'));
          if (!target.searchParams.has('image') || !Number.isSafeInteger(index) || index < 0) {
            response.writeHead(400).end('Invalid image index');
            return;
          }
          const body = await readSessionBody(thread, event);
          const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(
            body.imageUrls[index] ?? '',
          );
          if (!match) {
            response.writeHead(404).end('Image unavailable');
            return;
          }
          response.setHeader('Content-Type', match[1]);
          response.end(Buffer.from(match[2], 'base64'));
        }
        return;
      }
      if (request.method === 'GET' && ['/trace', '/trace-manifest'].includes(target.pathname)) {
        const trace = await fullTrace(target.searchParams.get('session') ?? '');
        if (!trace) {
          response
            .writeHead(404)
            .end('Session is not in the scanned sources. Refresh the dashboard first.');
          return;
        }
        if (target.pathname === '/trace') {
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end(trace.html);
        } else {
          response.setHeader('Content-Type', 'application/json');
          response.end(
            JSON.stringify({
              session: trace.data.threads[0].id,
              collectedAt: trace.data.collectedAt,
              sources: trace.data.threads.map(({ id, parent, source, coverage }) => ({
                id,
                parent,
                source,
                coverage,
              })),
            }),
          );
        }
        return;
      }
      if (request.method === 'GET' && request.url === '/') {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(html);
        return;
      }
      if (request.method === 'POST' && request.url === '/refresh') {
        if (
          request.headers['x-usage-refresh'] !== '1' ||
          (request.headers.origin && request.headers.origin !== origin)
        ) {
          response.writeHead(403).end('Same-origin refresh required');
          return;
        }
        if (refreshing) {
          response.writeHead(409).end('Scan already running');
          return;
        }
        refreshing = true;
        try {
          const prior = new Map(cache);
          const snapshot = await scan(roots, cache);
          if (index) await saveIndex(index, cache, prior);
          currentSnapshot = snapshot;
          html = await render(snapshot, initial.javascript);
          await writeFile(initial.file, html);
          await writeFile(resolve(initial.output, 'usage.json'), JSON.stringify(snapshot));
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(snapshot));
        } finally {
          refreshing = false;
        }
        return;
      }
      response.writeHead(404).end('Not found');
    })().catch((e: unknown) => {
      response.writeHead(500).end(e instanceof Error ? e.message : String(e));
    });
  });
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('No server address'));
        return;
      }
      resolvePromise({ server, url: `http://127.0.0.1:${address.port}/` });
    });
  });
}
export async function runCli(args: string[]) {
  const cwd = process.cwd();
  const roots: string[] = [];
  let indexDirectory: string | undefined;
  let output: string | undefined;
  let port = 4381;
  let serve = false;
  if (args.includes('--help')) {
    console.log(
      'Offline Codex usage: repo-workbench usage [--root DIR_OR_JSONL ...] [--out NEW_DIR] [--cache DIR] [--serve] [--port 4381]\nDefault sources: CODEX_HOME/sessions and archived_sessions. No network or credentials are used.',
    );
    return;
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--serve') {
      serve = true;
      continue;
    }
    if (
      !['--root', '--out', '--port', '--cache'].includes(arg) ||
      !args[i + 1] ||
      args[i + 1].startsWith('--')
    )
      throw new Error(`Unknown or incomplete option: ${arg}`);
    const value = args[++i];
    if (arg === '--root') roots.push(resolve(cwd, value));
    if (arg === '--out') output = value;
    if (arg === '--cache') indexDirectory = resolve(cwd, value);
    if (arg === '--port') {
      port = Number(value);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
    }
  }
  const selected = roots.length ? roots : defaultRoots();
  const key = createHash('sha256')
    .update(JSON.stringify([...selected].sort()))
    .digest('hex')
    .slice(0, 20);
  const index = resolve(
    indexDirectory ??
      resolve(process.env.XDG_CACHE_HOME ?? resolve(homedir(), '.cache'), 'repo-workbench/usage'),
    key,
  );
  const cache = await loadIndex(index);
  console.error(`Index: ${cache.size} sources restored. Scanning local logs…`);
  const result = await buildDashboard({ roots: selected, output, cache, index });
  const info = {
    file: result.file,
    files: result.snapshot.sources.length,
    events: result.snapshot.records.length,
    gaps: result.snapshot.gaps.length,
    cached: result.snapshot.cachedFiles,
    appended: result.snapshot.appendedFiles,
    reindexed: result.snapshot.reindexedFiles,
    scannedBytes: result.snapshot.scannedBytes,
  };
  if (serve) {
    const { server, url } = await startServer(result, selected, cache, port, index);
    const shutdown = () => server.close();
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    server.once('close', () => {
      process.removeListener('SIGINT', shutdown);
      process.removeListener('SIGTERM', shutdown);
    });
    console.log(JSON.stringify({ ...info, url }));
  } else console.log(JSON.stringify(info));
}
