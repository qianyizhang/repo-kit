import { build } from 'vite';
import { resolve } from 'node:path';
let script: Promise<string> | undefined;
function bundle() {
  return (script ??= build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      lib: {
        entry: resolve('tests/browser/host.ts'),
        name: 'WorkbenchTestHost',
        formats: ['iife'],
      },
    },
  }).then((result) => {
    const output = (Array.isArray(result) ? result : [result]).flatMap((part) => {
      if (!('output' in part)) throw new Error('Expected test host bundle');
      return part.output;
    });
    const entry = output.find((item) => item.type === 'chunk' && item.isEntry);
    if (!entry || entry.type !== 'chunk') throw new Error('Missing test host entry');
    return entry.code.replace(/<\/script/gi, '<\\/script');
  }));
}
export async function hostDocument(
  html: string,
  options: { messaging?: boolean; theme?: 'light' | 'dark' } = {},
) {
  const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
  return `<!doctype html><meta charset="UTF-8"><style>body{margin:0}iframe{width:100vw;height:100vh;border:0}</style><iframe title="Repo Canvas" sandbox="allow-scripts allow-forms allow-modals allow-downloads"></iframe><script>window.resourceHtml=${json(html)};window.hostOptions=${json({ messaging: true, theme: 'dark', ...options })};${await bundle()}</script>`;
}
