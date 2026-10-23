import { parentPort, workerData } from 'node:worker_threads';
import { z } from 'zod';
import { loadIndex, saveIndex, scan, usageIndexPath, type ScanCache } from '../usage/scan.ts';
import { overview } from '../usage/overview.ts';
import { saveOverview } from './history.ts';
const {
  roots,
  index: providedIndex,
  seed,
} = z
  .object({
    roots: z.array(z.string()),
    index: z.string().optional(),
    seed: z.custom<ScanCache>((value) => value instanceof Map).optional(),
  })
  .parse(workerData);
const index = providedIndex ?? usageIndexPath(roots);
const start = performance.now();
const cache = seed ?? (await loadIndex(index));
const loaded = performance.now();
// Seeded entries came from the initial build, not necessarily this disk index.
const prior: ScanCache = new Map(cache);
if (seed) prior.clear();
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
