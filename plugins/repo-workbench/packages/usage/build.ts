import { RuntimeError } from '../../../mcp-app-runtime/src/definition.ts';
import { renderReview } from '../session-review/build.ts';
import { ReportSession } from '../reports/session.ts';
import { ReportSelections } from '../reports/selections.ts';
import { textSchema } from '../reports/contracts.ts';
import { z } from 'zod';
import { asset } from '../runtime/assets.ts';
import { mkdtemp, mkdir, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, resolve, sep } from 'node:path';

import { createServer, type Server } from 'node:http';
import { gzipSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import { reportsMcp } from '../reports/server.ts';
import {
  scan,
  defaultRoots,
  loadIndex,
  saveIndex,
  usageIndexPath,
  type ScanCache,
} from './scan.ts';
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
  const selections = new ReportSelections();
  const report = new ReportSession({ roots, kind: 'usage', index }, selections, {
    snapshot: initial.snapshot,
    cache,
  });
  const fullTrace = (id: string) =>
    report.trace(id).catch((error) => {
      if (error instanceof RuntimeError && error.code === 'not_found') return null;
      throw error;
    });
  const diagnostics = reportsMcp(),
    diagnosticNonce = randomUUID();
  const withDiagnostics = (value: string) =>
    value.replace(
      '<head>',
      `<head><meta name="workbench-diagnostics" content="${diagnosticNonce}">`,
    );
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
      if (request.method === 'POST' && target.pathname.startsWith('/diagnostics/')) {
        if (
          request.headers['x-workbench-diagnostics'] !== diagnosticNonce ||
          request.headers.origin !== origin ||
          request.headers['sec-fetch-site'] === 'cross-site'
        ) {
          response.writeHead(403).end('Same-origin diagnostics required');
          return;
        }
        let body = '';
        for await (const chunk of request) {
          body += String(chunk);
          if (Buffer.byteLength(body) > 192 * 1024)
            throw new Error('Diagnostic input exceeds limit');
        }
        const value = diagnostics.callDiagnostics(
          target.pathname.slice('/diagnostics/'.length),
          JSON.parse(body),
        );
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(value));
        return;
      }
      const completed = diagnostics.httpStatus(
        `${request.method ?? 'GET'} ${target.pathname}`.slice(0, 120),
        { path: target.pathname, query: target.search },
      );
      response.once('finish', () => completed(response.statusCode));
      if (request.method === 'GET' && ['/trace-record', '/trace-image'].includes(target.pathname)) {
        const session = target.searchParams.get('session') ?? '';
        const trace = await fullTrace(session);
        if (!trace) {
          response.writeHead(404).end('Record not found');
          return;
        }
        const event = target.searchParams.get('event') ?? '';
        const revision = target.searchParams.get('revision') ?? '';
        const base = { session, event, revision };
        try {
          if (target.pathname === '/trace-record') {
            const field = z.enum(['text', 'output']).parse(target.searchParams.get('field'));
            const offset = z
              .number()
              .int()
              .nonnegative()
              .parse(Number(target.searchParams.get('offset') ?? 0));
            const value = textSchema.parse(
              await report.execute(
                { action: 'text', ...base, field, offset },
                report.binding.revision,
              ),
            );
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(value));
          } else {
            if (!target.searchParams.has('image')) throw new Error('Invalid image index');
            const index = z
              .number()
              .int()
              .nonnegative()
              .parse(Number(target.searchParams.get('image')));
            const value = z
              .object({ image: z.string() })
              .parse(
                await report.execute({ action: 'image', ...base, index }, report.binding.revision),
              );
            const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(
              value.image,
            );
            if (!match) throw new Error('Image unavailable');
            response.setHeader('Content-Type', match[1]);
            response.end(Buffer.from(match[2], 'base64'));
          }
        } catch (error) {
          const code = error instanceof RuntimeError ? error.code : undefined;
          response
            .writeHead(code === 'stale' ? 409 : code === 'not_found' ? 404 : 400)
            .end(String(error));
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
          response.end(withDiagnostics(await renderReview(trace.data)));
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
        response.end(withDiagnostics(html));
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
        try {
          const snapshot = await report.refreshRaw(async (snapshot) => {
            const nextHtml = await render(snapshot, initial.javascript);
            await writeFile(initial.file, nextHtml);
            await writeFile(resolve(initial.output, 'usage.json'), JSON.stringify(snapshot));
            html = nextHtml;
            return snapshot;
          });
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(snapshot));
        } catch (error) {
          response
            .writeHead(error instanceof RuntimeError && error.code === 'busy' ? 409 : 500)
            .end(String(error));
        }

        return;
      }
      response.writeHead(404).end('Not found');
    })().catch((e: unknown) => {
      response.writeHead(500).end(e instanceof Error ? e.message : String(e));
    });
  });
  server.once('close', () => {
    report.dispose();
    selections.dispose();
    void diagnostics.close();
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
  const index = usageIndexPath(selected, indexDirectory);
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
