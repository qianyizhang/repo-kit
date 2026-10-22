import { build } from 'rolldown';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, rm, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const hash = createHash('sha256');
for (const dir of ['src', 'scripts']) {
  for (const file of (await readdir(resolve(root, dir))).sort()) {
    hash.update(`${dir}/${file}`).update(await readFile(resolve(root, dir, file)));
  }
}
hash.update(await readFile(resolve(root, 'package-lock.json')));
const fingerprint = hash.digest('hex').slice(0, 12);
const dist = resolve(root, 'dist');
const existing = await lstat(dist).catch(() => undefined);
if (existing?.isSymbolicLink()) throw new Error('Refusing to replace symlinked dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
async function bundle(entry: string, platform: 'browser' | 'node', name?: string) {
  const output = await build({
    write: false,
    input: resolve(root, entry),
    platform,
    external: [/^node:/],
    transform: { define: { EXAMPLE_BUILD: JSON.stringify(fingerprint) } },
    output: {
      format: platform === 'browser' ? 'iife' : 'esm',
      codeSplitting: false,
      ...(platform === 'node'
        ? {
            banner:
              "import {createRequire as exampleRequire} from 'node:module'; const require=exampleRequire(import.meta.url);",
          }
        : {}),
    },
  });
  const chunk = output.output.find((item) => item.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error(`Missing bundle: ${entry}`);
  if (name) await writeFile(resolve(root, 'dist', name), chunk.code);
  return chunk.code;
}
const app = await bundle('src/app.ts', 'browser');
const styles = await readFile(resolve(root, 'src/styles.css'), 'utf8');
const html = (await readFile(resolve(root, 'src/app.html'), 'utf8'))
  .replace('/* STYLES */', () => styles)
  .replace('/* SCRIPT */', () => app.replace(/<\/script/gi, '<\\/script'));
await writeFile(resolve(root, 'dist/app.html'), html);
await bundle('src/server.ts', 'node', 'server.mjs');
await bundle('src/preview.ts', 'node', 'preview.mjs');
await writeFile(resolve(dist, 'build.json'), JSON.stringify({ build: fingerprint }) + '\n');
console.log(`Built Example MCP App ${fingerprint}`);
