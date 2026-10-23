import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { overviewSchema } from './contracts.ts';
import type { Snapshot, UsageOverview } from '../usage/model.ts';
declare const WORKBENCH_BUNDLED: boolean;
const zip = promisify(gzip),
  unzip = promisify(gunzip);
const filename = (directory: string, timezone: string) =>
  resolve(directory, `overview-v1-${timezone.replace('/', '-')}.json.gz`);
export async function loadOverview(
  directory: string,
  timezone: string,
): Promise<UsageOverview | undefined> {
  try {
    const parsed = overviewSchema.parse(
      JSON.parse((await unzip(await readFile(filename(directory, timezone)))).toString()),
    );
    return parsed.timezone === timezone ? parsed : undefined;
  } catch {
    return undefined;
  }
}
export async function saveOverview(directory: string, data: UsageOverview) {
  await mkdir(directory, { recursive: true });
  const target = filename(directory, data.timezone),
    temporary = target + '.' + randomUUID() + '.tmp';
  await writeFile(temporary, await zip(JSON.stringify(data)), { mode: 0o600, flag: 'wx' });
  await rename(temporary, target);
}
export type HistoryResult = {
  snapshot: Snapshot;
  overviews: UsageOverview[];
  timings: Record<string, number>;
};
export function scanHistory(roots: string[]) {
  const worker = new Worker(
    new URL(
      typeof WORKBENCH_BUNDLED !== 'undefined' ? './reports-worker.mjs' : './scan-worker.ts',
      import.meta.url,
    ),
    { workerData: roots },
  );
  const promise = new Promise<HistoryResult>((resolve, reject) => {
    let delivered = false;
    worker.once('message', (result: HistoryResult) => {
      delivered = true;
      resolve(result);
    });
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (!delivered) reject(new Error(`History scan stopped (${code}). Retry refresh.`));
    });
  });
  return { promise, stop: () => worker.terminate() };
}
