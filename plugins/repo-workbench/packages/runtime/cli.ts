#!/usr/bin/env node
import { setup } from './setup.ts';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { runCli as usage } from '../usage/build.ts';
import { runCli as trace } from '../trace/build.ts';
import { asset } from './assets.ts';
import { apiMiddleware } from '../repo-canvas/src/server/api.ts';
import { Repository } from '../repo-canvas/src/server/repository.ts';
const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'setup') console.log(JSON.stringify(await setup(args), null, 2));
  else if (command === 'usage') await usage(args);
  else if (command === 'trace') await trace(args);
  else if (command === 'canvas') {
    let root = process.cwd(),
      port = 4317,
      validate = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--validate') {
        validate = true;
        continue;
      }
      if (!['--repo', '--port'].includes(args[i]) || !args[i + 1])
        throw new Error('Use canvas [--repo DIR] [--port N] [--validate]');
      if (args[i] === '--repo') root = resolve(args[++i]);
      else port = Number(args[++i]);
    }
    if (validate) console.log(JSON.stringify(new Repository(root).snapshot()));
    else {
      if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
      const html = await asset('canvas.html'),
        middleware = apiMiddleware(root);
      const server = createServer((req, res) =>
        middleware(req, res, () => {
          if (req.url !== '/') {
            res.writeHead(404).end();
            return;
          }
          res
            .writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' })
            .end(html);
        }),
      );
      server.listen(port, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address === 'object')
          console.log(JSON.stringify({ repo: root, url: `http://127.0.0.1:${address.port}/` }));
      });
      process.once('SIGINT', () => server.close());
      process.once('SIGTERM', () => server.close());
    }
  } else if (!command || command === '--help')
    console.log(
      'repo-workbench canvas [--repo DIR] [--port N] [--validate]\nrepo-workbench usage [--root LOG_DIR ...] [--out NEW_DIR] [--cache DIR] [--serve]\nrepo-workbench trace --repo DIR --input DIR --case FILE [--out NEW_DIR]\nrepo-workbench setup --scope user|repo [--repo DIR]',
    );
  else throw new Error(`Unknown command: ${command}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
