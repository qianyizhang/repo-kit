/** Test harness assets never enter the shipped plugin. */
import { build } from 'rolldown';
import { mkdir } from 'node:fs/promises';
await mkdir(new URL('../.cache', import.meta.url), { recursive: true });
await build({
  input: new URL('../tests/host.ts', import.meta.url).pathname,
  platform: 'browser',
  output: { format: 'iife', file: new URL('../.cache/browser-host.js', import.meta.url).pathname },
});
