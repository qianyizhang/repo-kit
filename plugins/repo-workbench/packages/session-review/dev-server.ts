import type { Plugin } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reviewFixture } from '../trace/review-fixture.ts';
import { examples } from './src/dev/examples.ts';

/** Synthetic data only; the browser never imports filesystem normalization code. */
export function fixtureServer(): Plugin {
  return {
    name: 'review-fixtures',
    apply: 'serve',
    configureServer(server) {
      const documents = new Map<string, ReturnType<typeof reviewFixture>>();
      const roots: string[] = [];
      server.httpServer?.once('close', () => {
        void Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
      });
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://localhost');
        if (url.pathname !== '/__review-fixture') return next();
        const id = url.searchParams.get('id');
        if (!examples.some((example) => example.id === id)) {
          response.statusCode = 404;
          response.end('Unknown review example');
          return;
        }
        const scenario = id === 'ambiguity' ? 'ambiguity' : 'actions';
        let document = documents.get(scenario);
        if (!document) {
          document = mkdtemp(join(tmpdir(), 'review-fixture-')).then((root) => {
            roots.push(root);
            return reviewFixture(root, scenario);
          });
          documents.set(scenario, document);
        }
        void document
          .then((data) => {
            response.setHeader('Content-Type', 'application/json');
            response.setHeader('Cache-Control', 'no-store');
            response.end(JSON.stringify(data));
          })
          .catch((error: unknown) => {
            response.statusCode = 500;
            response.end(error instanceof Error ? error.message : String(error));
          });
      });
    },
  };
}
