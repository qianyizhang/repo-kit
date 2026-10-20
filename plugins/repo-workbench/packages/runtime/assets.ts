import { readFile } from 'node:fs/promises';
declare const WORKBENCH_BUNDLED: boolean;
const base = new URL(
  typeof WORKBENCH_BUNDLED !== 'undefined' ? './assets/' : '../../dist/assets/',
  import.meta.url,
);
export function asset(name: string): Promise<string> {
  return readFile(new URL(name, base), 'utf8');
}
