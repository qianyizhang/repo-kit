import { createServer } from 'node:http';
import { asset } from './assets.ts';
import { registeredRepositories, registerRepository } from './repositories.ts';
import { apiMiddleware } from '../repo-canvas/src/server/api.ts';
/** One loopback launcher; each registered route keeps its own repository and bridge. */
export async function canvasServer() {
  const html = await asset('canvas.html');
  const sessions = new Map<string, ReturnType<typeof apiMiddleware>>();
  return createServer((req, res) => {
    void (async () => {
      const host = req.headers.host ?? '';
      if (
        !/^127\.0\.0\.1:\d+$/.test(host) ||
        (req.headers.origin && req.headers.origin !== `http://${host}`) ||
        req.headers['sec-fetch-site'] === 'cross-site'
      ) {
        res.writeHead(403).end('Only same-origin loopback requests are allowed');
        return;
      }
      const url = new URL(req.url ?? '/', `http://${host}`);
      const json = (value: unknown) => {
        res
          .writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
          .end(JSON.stringify(value));
      };
      if (url.pathname === '/api/state' && req.method === 'GET') {
        json({ needsRepository: true });
        return;
      }
      if (url.pathname === '/api/repositories' && req.method === 'GET') {
        json(await registeredRepositories());
        return;
      }
      if (url.pathname === '/api/repositories' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) {
          body += String(chunk);
          if (body.length > 8192) throw new Error('Repository path is too long');
        }
        const value = JSON.parse(body) as { path?: unknown };
        if (typeof value.path !== 'string' || !value.path.startsWith('/'))
          throw new Error('Provide an absolute repository path');
        const path = await registerRepository(value.path);
        json((await registeredRepositories()).find((entry) => entry.path === path));
        return;
      }
      const sendHtml = () => {
        res
          .writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          })
          .end(html);
      };
      if (url.pathname === '/' && req.method === 'GET') {
        sendHtml();
        return;
      }
      const route = /^\/canvas\/([a-f0-9]{24})\/(.*)$/.exec(url.pathname);
      if (!route) {
        res.writeHead(404).end();
        return;
      }
      const [, id, suffix] = route;
      let middleware = sessions.get(id);
      if (!middleware) {
        const entry = (await registeredRepositories()).find(
          (entry) => entry.id === id && entry.available,
        );
        if (!entry) {
          res.writeHead(404).end('Repository is not registered or is unavailable.');
          return;
        }
        if (sessions.size >= 100) {
          res.writeHead(503).end('Canvas session limit reached');
          return;
        }
        middleware = apiMiddleware(entry.path);
        sessions.set(id, middleware);
      }
      req.url = `/${suffix}${url.search}`;
      middleware(req, res, () => {
        if (!suffix && req.method === 'GET') sendHtml();
        else res.writeHead(404).end();
      });
    })().catch((error: unknown) => {
      if (!res.headersSent)
        res
          .writeHead(400, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      else res.end();
    });
  });
}
