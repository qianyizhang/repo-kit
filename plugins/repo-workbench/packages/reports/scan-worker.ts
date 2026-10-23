import { parentPort, workerData } from 'node:worker_threads';
import { z } from 'zod';
import { loadIndex, saveIndex, scan, usageIndexPath } from '../usage/scan.ts';
import { overview } from '../usage/overview.ts';
import { saveOverview } from './history.ts';
const roots = z.array(z.string()).parse(workerData);
const index = usageIndexPath(roots);
const start = performance.now();
const cache = await loadIndex(index);
const loaded = performance.now();
const prior = new Map(cache);
const snapshot = await scan(roots, cache);
const scanned = performance.now();
const overviews = ['Asia/Shanghai', 'UTC'].map((timezone) => overview(snapshot, timezone));
const summarized = performance.now();
await saveIndex(index, cache, prior);
await Promise.all(overviews.map((data) => saveOverview(index, data)));
parentPort!.postMessage({
  snapshot,
  overviews,
  timings: {
    indexMs: loaded - start,
    scanMs: scanned - loaded,
    summaryMs: summarized - scanned,
    persistMs: performance.now() - summarized,
  },
});
