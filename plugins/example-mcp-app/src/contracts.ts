import { z } from 'zod';

export const journeySchema = z.enum([
  'startup',
  'tool',
  'resource',
  'context',
  'message',
  'error',
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
  runId: z.string().max(100).optional(),
  provenance: z.enum(['captured', 'fixture']),
});
export type TraceEvent = z.infer<typeof eventSchema>;
export const runSchema = z.object({
  id: z.string().max(100),
  ordinal: z.number(),
  journey: journeySchema,
  mode: z.enum(['fixture', 'live']),
  status: z.enum(['running', 'success', 'error', 'uncertain', 'closed']),
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
  private reports = new Map<string, AppReport & { reportedAt: string }>();
  put(report: AppReport) {
    this.reports.delete(report.panelId);
    this.reports.set(report.panelId, { ...report, reportedAt: new Date().toISOString() });
    if (this.reports.size > 12) this.reports.delete(this.reports.keys().next().value!);
  }
  list(panelId?: string) {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [id, report] of this.reports)
      if (Date.parse(report.reportedAt) < cutoff) this.reports.delete(id);
    return [...this.reports.values()].filter((report) => !panelId || report.panelId === panelId);
  }
}
