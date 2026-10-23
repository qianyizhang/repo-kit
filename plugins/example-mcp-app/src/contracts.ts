import { ScopedRegistry, type Principal } from '../../mcp-app-runtime/src/registry.ts';
import { immutable } from '../../mcp-app-runtime/src/definition.ts';
import { z } from 'zod';

export const journeySchema = z.enum([
  'startup',
  'tool',
  'resource',
  'context',
  'message',
  'investigate',
  'teardown',
]);
export type JourneyId = z.infer<typeof journeySchema>;
export const eventSchema = z.object({
  sequence: z.number(),
  time: z.string(),
  source: z.enum(['server', 'app']),
  direction: z.string(),
  method: z.string(),
  kind: z.enum(['request', 'response', 'notification', 'local']),
  status: z.string(),
  requestId: z.union([z.string(), z.number()]).optional(),
  elapsedMs: z.number().optional(),
  payload: z.string().max(13000),
  observer: z.boolean(),
  owner: z.string().optional(),
  runId: z.string().max(100).optional(),
  provenance: z.enum(['captured', 'fixture']),
});
export type TraceEvent = z.infer<typeof eventSchema>;
export const runSchema = z.object({
  id: z.string().max(100),
  ordinal: z.number(),
  journey: journeySchema,
  mode: z.enum(['fixture', 'live']),
  status: z.enum(['running', 'waiting', 'success', 'error', 'uncertain', 'closed']),
  scenario: z.enum([
    'success',
    'tool-error',
    'protocol-error',
    'rejected',
    'timeout',
    'missing-trace',
  ]),
  input: z.string().max(2000),
  summary: z.string().max(3000),
  result: z.string().max(13000),
  startedAt: z.string(),
});
export type Run = z.infer<typeof runSchema>;
export const reportSchema = z.object({
  panelId: z.uuid(),
  build: z.string().max(100),
  host: z.object({ name: z.string().max(200), version: z.string().max(100) }),
  connection: z.string().max(100),
  mode: z.enum(['fixture', 'live']),
  runs: z.array(runSchema).max(30),
  events: z.array(eventSchema).max(250),
  dropped: z.number().nonnegative(),
});
export type AppReport = z.infer<typeof reportSchema>;
export const serverIdentitySchema = z.object({ instance: z.string(), build: z.string() });
export const snapshotSchema = serverIdentitySchema.extend({
  uri: z.string(),
  events: z.array(eventSchema),
  dropped: z.number(),
  panels: z.array(reportSchema.extend({ reportedAt: z.string() })),
  panelIndex: z.array(
    z.object({ panelId: z.string(), host: z.string(), build: z.string(), reportedAt: z.string() }),
  ),
});

/** Reports are self-reported app evidence, not trusted proof of host/model behavior. */
export class PanelReports {
  #reports = new ScopedRegistry<AppReport & { reportedAt: string }>({
    maxEntries: 12,
    maxBytes: 16 * 1024 * 1024,
    maxAgeMs: 3600_000,
    overflow: 'evict',
  });
  put(report: AppReport, owner: Principal) {
    const value = immutable({ ...report, reportedAt: new Date().toISOString() });
    const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
    if (this.#reports.list(owner).some((entry) => entry.id === report.panelId))
      this.#reports.update(report.panelId, owner, value, bytes);
    else this.#reports.create(owner, value, bytes, report.panelId);
  }
  list(owner: Principal, panelId?: string) {
    if (panelId) {
      try {
        return [this.#reports.resolve(panelId, owner)];
      } catch {
        return [];
      }
    }
    return this.#reports.list(owner).map((entry) => entry.value);
  }
  dispose() {
    this.#reports.close();
  }
}
