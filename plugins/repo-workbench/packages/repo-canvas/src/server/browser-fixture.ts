/** Disposable repository; the browser test acts as the MCP client. */
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
// Serve the delivered CLI and matching UI. Source Vite state must never impersonate a bundle.
const server = spawn(
  process.execPath,
  [
    fileURLToPath(new URL('../../../../dist/cli.mjs', import.meta.url)),
    'canvas',
    '--repo',
    root,
    '--port',
    '4318',
  ],
  { stdio: 'inherit', env: process.env },
);
server.once('error', (error) => {
  throw error;
});
const exited = new Promise<void>((done) => server.once('exit', () => done()));
const close = async () => {
  server.kill('SIGTERM');
  await exited;
  rmSync(root, { recursive: true, force: true });
  process.exit(0);
};
process.on('SIGTERM', () => {
  void close();
});
process.on('SIGINT', () => {
  void close();
});
