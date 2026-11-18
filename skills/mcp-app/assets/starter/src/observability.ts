import { z } from "zod";

import { PAYLOAD_LIMIT, snapshot } from "./diagnostic-payload.ts";
export { PAYLOAD_LIMIT, snapshot } from "./diagnostic-payload.ts";

export const payloadSchema = z.object({
  text: z.string().max(PAYLOAD_LIMIT),
  originalBytes: z.number().int().nonnegative(),
  redacted: z.boolean(),
  truncated: z.boolean(),
  omitted: z.boolean(),
});
export const eventSchema = z.object({
  id: z.uuid(),
  session: z.uuid(),
  interaction: z.uuid(),
  time: z.iso.datetime(),
  source: z.enum(["app", "server"]),
  method: z.string().max(120),
  direction: z.string().max(120),
  phase: z.enum(["request", "result", "error"]),
  status: z.string().max(80),
  payload: payloadSchema,
});
export type Event = z.infer<typeof eventSchema>;
export class Recorder {
  readonly session = crypto.randomUUID();
  readonly events: Event[] = [];
  dropped = 0;
  readonly source: Event["source"];
  readonly sink?: (event: Event) => void;
  constructor(source: Event["source"], sink?: (event: Event) => void) {
    this.source = source;
    this.sink = sink;
  }
  record(
    interaction: string,
    method: string,
    direction: string,
    phase: Event["phase"],
    status: string,
    value: unknown,
  ): Event {
    const event = eventSchema.parse({
      id: crypto.randomUUID(),
      session: this.session,
      interaction,
      time: new Date().toISOString(),
      source: this.source,
      method,
      direction,
      phase,
      status,
      payload: snapshot(value),
    });
    this.events.push(event);
    if (this.events.length > 250) {
      this.events.shift();
      this.dropped++;
    }
    // Recording is best effort and must not change the observed action's result.
    try {
      this.sink?.(event);
    } catch {
      /* Sink exposes its own health. */
    }
    return event;
  }
}
