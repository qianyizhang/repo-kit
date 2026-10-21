import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { httpOperation, operations } from '../model/operations.ts';
import { operate } from './operations.ts';
import { Repository } from './repository.ts';
import { CanvasBridge } from './bridge.ts';
import { serveMcp } from './mcp.ts';

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk as Uint8Array);
    size += bytes.length;
    if (size > 2_000_000) throw new Error('Request exceeds 2 MB');
    chunks.push(bytes);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString());
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an object');
  return value as Record<string, unknown>;
}
function json(res: ServerResponse, value: unknown, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}
export function apiMiddleware(root: string) {
  const repository = new Repository(root),
    token = randomBytes(24).toString('hex');
  const bridge = new CanvasBridge({ repo: repository.root, chat: 'standalone' });
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/') && req.url !== '/mcp') {
      next();
      return;
    }
    void (async () => {
      const host = req.headers.host ?? '';
      if (
        !/^127\.0\.0\.1:\d+$/.test(host) ||
        (req.headers.origin && req.headers.origin !== `http://${host}`) ||
        req.headers['sec-fetch-site'] === 'cross-site'
      ) {
        json(res, { error: 'Only same-origin loopback requests are allowed' }, 403);
        return;
      }
      const url = new URL(req.url!, `http://${host}`);
      if (url.pathname === '/mcp') {
        await serveMcp(
          req,
          res,
          req.method === 'POST' ? await body(req) : undefined,
          bridge,
          repository,
        );
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/state') {
        json(res, {
          ...operate('state', {}, repository, bridge),
          token,
          plugin: 'Current Codex chat via MCP',
        });
        return;
      }
      if (req.headers['x-repo-canvas-token'] !== token) {
        json(res, { error: 'Missing local session token' }, 403);
        return;
      }
      const action = httpOperation(req.method, url.pathname);
      if (action) {
        const args =
          operations[action].method === 'GET'
            ? Object.fromEntries(
                [...url.searchParams.keys()].map((key) => [key, url.searchParams.get(key)]),
              )
            : await body(req);
        json(res, operate(action, args, repository, bridge));
        return;
      }
      json(res, { error: 'Unknown route' }, 404);
    })().catch((error: unknown) =>
      json(
        res,
        { error: error instanceof Error ? error.message : String(error) },
        error instanceof Error && error.message.startsWith('Conflict:') ? 409 : 400,
      ),
    );
  };
}
export function apiPlugin(root: string): Plugin {
  return {
    name: 'repo-canvas-local-api',
    configureServer(server) {
      server.middlewares.use(apiMiddleware(root));
    },
  };
}
