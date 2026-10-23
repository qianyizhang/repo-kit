import { build as vite } from 'vite';
import { build as bundle } from 'rolldown';
import { mkdir, writeFile, readFile, chmod, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildFingerprint } from './fingerprint.ts';
const root = resolve(import.meta.dirname, '..');
const buildId = await buildFingerprint(root);
const assets = resolve(root, 'dist/assets');
await rm(resolve(root, 'dist'), { recursive: true, force: true });
await mkdir(assets, { recursive: true });
async function outputs(options: Parameters<typeof vite>[0]) {
  const result = await vite(options);
  return (Array.isArray(result) ? result : [result]).flatMap((result) => {
    if (!('output' in result)) throw new Error('Expected build output');
    return result.output;
  });
}
const canvas = await outputs({
  root: resolve(root, 'packages/repo-canvas'),
  configFile: resolve(root, 'packages/repo-canvas/vite.config.ts'),
  logLevel: 'warn',
  define: { WORKBENCH_BUILD: JSON.stringify(buildId) },
  build: { write: false },
});
const files = new Map(
  canvas.map((item) => [
    item.fileName,
    item.type === 'chunk' ? item.code : Buffer.from(item.source).toString('utf8'),
  ]),
);
function read(path: string) {
  const value = files.get(path.replace(/^\//, ''));
  if (value === undefined) throw new Error(`Missing asset ${path}`);
  return value;
}
const html = read('index.html')
  .replace(
    /<script[^>]*src="([^"]+)"[^>]*><\/script>/g,
    (_tag, path: string) =>
      `<script type="module">${read(path).replace(/<\/script/gi, '<\\/script')}</script>`,
  )
  .replace(
    /<link[^>]*href="([^"]+\.css)"[^>]*>/g,
    (_tag, path: string) => `<style>${read(path).replace(/<\/style/gi, '<\\/style')}</style>`,
  );
await writeFile(resolve(assets, 'canvas.html'), html);
const reportTheme = await readFile(resolve(root, 'packages/reports/theme.css'), 'utf8');
const review = await outputs({
  configFile: resolve(root, 'packages/session-review/vite.config.ts'),
  logLevel: 'warn',
  build: { write: false },
});
const entry = review.find((item) => item.type === 'chunk' && item.isEntry);
if (!entry || entry.type !== 'chunk') throw new Error('Missing review entry');
await writeFile(resolve(assets, 'review.js'), entry.code.replace(/<(?=\/?script\b)/gi, '\\x3c'));
await writeFile(
  resolve(assets, 'review.css'),
  review
    .filter((item) => item.type === 'asset' && item.fileName.endsWith('.css'))
    .map((item) => (item.type === 'asset' ? String(item.source) : ''))
    .join('\n'),
);
const usage = await outputs({
  configFile: false,
  logLevel: 'warn',
  build: {
    write: false,
    lib: {
      entry: resolve(root, 'packages/usage/browser/main.ts'),
      name: 'UsageDashboard',
      formats: ['iife'],
      fileName: () => 'usage.js',
    },
  },
});
const script = usage.find((item) => item.type === 'chunk');
if (!script || script.type !== 'chunk') throw new Error('Missing usage entry');
await writeFile(resolve(assets, 'usage.js'), script.code);
for (const [source, dest] of [
  ['index.html', 'usage.html'],
  ['styles.css', 'usage.css'],
])
  await writeFile(
    resolve(assets, dest),
    (source === 'styles.css' ? reportTheme : '') +
      (await readFile(resolve(root, 'packages/usage/browser', source), 'utf8')),
  );
const reportApp = await bundle({
  write: false,
  input: resolve(root, 'packages/reports/app.ts'),
  platform: 'browser',
  transform: { define: { WORKBENCH_BUILD: JSON.stringify(buildId) } },
  output: { format: 'iife', codeSplitting: false },
});
const reportScript = reportApp.output.find((item) => item.type === 'chunk');
if (!reportScript || reportScript.type !== 'chunk') throw new Error('Missing report app bundle');
const usageTemplate = await readFile(resolve(assets, 'usage.html'), 'utf8');
const body = /<body>([\s\S]*)<\/body>/.exec(usageTemplate)?.[1];
if (!body) throw new Error('Missing usage template');
const reportHTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Repo Workbench reports</title><style id="usage-style">${await readFile(resolve(assets, 'usage.css'), 'utf8')}</style><style id="trace-style" media="not all">${await readFile(resolve(assets, 'review.css'), 'utf8')}</style><style>${await readFile(resolve(root, 'packages/reports/styles.css'), 'utf8')}</style></head><body><div id="report-toolbar"><button id="report-back" hidden>Back to usage</button><span id="report-status" role="status">Connecting…</span><input id="report-question" aria-label="Discuss this view" placeholder="Ask about this view" maxlength="4000"><label title="Usage: current filters or open evidence. Trace: the whole selected turn or action."><input id="report-context" type="checkbox"> <span id="report-context-label">Attach filters or open evidence</span></label><button id="report-send" disabled>Send</button></div><div id="usage-view" hidden>${body}</div><div id="root" hidden></div><script>${reportScript.code.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
await writeFile(resolve(assets, 'reports.html'), reportHTML);
await bundle({
  input: {
    cli: resolve(root, 'packages/runtime/cli.ts'),
    'canvas-server': resolve(root, 'packages/repo-canvas/src/server/stdio.ts'),
    'reports-server': resolve(root, 'packages/reports/stdio.ts'),
    'reports-worker': resolve(root, 'packages/reports/scan-worker.ts'),
  },
  platform: 'node',
  external: [/^node:/],
  transform: { define: { WORKBENCH_BUNDLED: 'true', WORKBENCH_BUILD: JSON.stringify(buildId) } },
  output: {
    banner: `import {createRequire as workbenchRequire} from 'node:module'; import {fileURLToPath as workbenchFile} from 'node:url'; import {dirname as workbenchDirectory} from 'node:path'; const require=workbenchRequire(import.meta.url); const __filename=workbenchFile(import.meta.url); const __dirname=workbenchDirectory(__filename);`,
    dir: resolve(root, 'dist'),
    format: 'esm',
    entryFileNames: '[name].mjs',
    chunkFileNames: 'shared-[hash].mjs',
  },
});
await chmod(resolve(root, 'dist/cli.mjs'), 0o755);
console.log('Built standalone plugin: CLI, MCP server, and offline UI assets.');
