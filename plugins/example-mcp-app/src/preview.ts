/** Fixture-only local preview. No MCP process, fake host, conversation inbox or RPC proxy. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const port = Number(process.env.PORT ?? 4390);
const server = createServer((request, response) => {
  if (request.headers.host !== `127.0.0.1:${port}`) {
    response.writeHead(403).end();
    return;
  }
  if (request.method !== 'GET' || request.url !== '/') {
    response.writeHead(404).end();
    return;
  }
  void readFile(new URL('./app.html', import.meta.url)).then(
    (html) => {
      response
        .writeHead(200, {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store',
          'Content-Security-Policy':
            "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src data:;",
          'X-Content-Type-Options': 'nosniff',
        })
        .end(html);
    },
    () => response.writeHead(500).end('Build the app first.'),
  );
});
server.listen(port, '127.0.0.1', () =>
  console.log(`Fixture-only preview: http://127.0.0.1:${port}`),
);
process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
