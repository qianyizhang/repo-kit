/** Disposable repository; the browser test acts as the MCP client. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { apiPlugin } from './api.ts';
import { Repository } from './repository.ts';
const root = mkdtempSync(join(tmpdir(), 'canvas-browser-'));
process.env.XDG_STATE_HOME = join(root, '.test-state');
process.env.XDG_CONFIG_HOME = join(root, '.test-config');
execFileSync('git', ['init', '-q', root]);
mkdirSync(join(root, 'src/core'), { recursive: true });
writeFileSync(join(root, 'src/core/rules.ts'), 'export const rule = "domain owns rules";\n');
execFileSync('git', ['add', '.'], { cwd: root });
const repo = new Repository(root),
  snapshot = repo.snapshot();
repo.save({ ...snapshot.document, title: 'Architecture test repo' }, snapshot.revision);
const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('../../', import.meta.url)),
  plugins: [react(), apiPlugin(root)],
  server: { host: '127.0.0.1', port: 4318, strictPort: true },
});
await server.listen();
const close = async () => {
  await server.close();
  rmSync(root, { recursive: true, force: true });
  process.exit(0);
};
process.on('SIGTERM', () => {
  void close();
});
process.on('SIGINT', () => {
  void close();
});
