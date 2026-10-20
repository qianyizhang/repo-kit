import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
const root = resolve('test-results');
createServer((req, res) => {
  void (async () => {
    if (req.url === '/') {
      res.end('Review fixtures');
      return;
    }
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname);
    const path = resolve('.', '.' + pathname);
    if (!path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const file = (await stat(path)).isDirectory() ? resolve(path, 'index.html') : path;
    const type =
      extname(file) === '.html'
        ? 'text/html'
        : extname(file) === '.png'
          ? 'image/png'
          : 'application/json';
    res.writeHead(200, { 'Content-Type': type }).end(await readFile(file));
  })().catch(() => res.writeHead(404).end());
}).listen(4385, '127.0.0.1');
