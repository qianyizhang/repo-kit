import { z } from "zod";
import { immutable } from "./definition.ts";

export const PAYLOAD_LIMIT = 64 * 1024;
export function isCredentialField(key: string) {
  return /^(?:authorization|proxyauthorization|cookie|setcookie|password|secret|clientsecret|token|accesstoken|refreshtoken|idtoken|apikey|privatekey)$/.test(
    key.replace(/[-_]/g, "").toLowerCase(),
  );
}
export const payloadSchema = z.object({
  text: z.string().max(PAYLOAD_LIMIT),
  originalBytes: z.number().int().nonnegative(),
  redacted: z.boolean(),
  truncated: z.boolean(),
  omitted: z.boolean(),
});
export function snapshot(
  value: unknown,
  omit = false,
): z.infer<typeof payloadSchema> {
  try {
    let redacted = false;
    const original = JSON.stringify(value) ?? "null";
    const text =
      JSON.stringify(
        value,
        (key, item: unknown) => {
          if (isCredentialField(key)) {
            redacted = true;
            return "[redacted]";
          }
          return item;
        },
        2,
      ) ?? "null";
    const bytes = new TextEncoder().encode(text);
    return {
      text: omit
        ? "[payload omitted by recording policy]"
        : new TextDecoder().decode(bytes.slice(0, PAYLOAD_LIMIT)),
      originalBytes: new TextEncoder().encode(original).length,
      redacted,
      truncated: bytes.length > PAYLOAD_LIMIT,
      omitted: omit,
    };
  } catch {
    return {
      text: "[payload unavailable: serialization failed]",
      originalBytes: 0,
      redacted: false,
      truncated: false,
      omitted: true,
    };
  }
}
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
  retention: z.enum(["user", "background"]).default("user"),
  callId: z.uuid().optional(),
  parentId: z.uuid().optional(),
  owner: z.string().max(200).optional(),
});
export type Event = z.infer<typeof eventSchema>;
export const eventMetadataSchema = eventSchema.omit({ payload: true });
export const RETENTION = immutable({
  user: { interactions: 40, bytes: 16 * 1024 * 1024, ageMs: 3600_000 },
  background: { interactions: 100, bytes: 2 * 1024 * 1024, ageMs: 300_000 },
  eventsPerInteraction: 32,
});
export type EventContext = {
  retention?: Event["retention"];
  callId?: string;
  parentId?: string;
  owner?: string;
};
/** One policy owns count, byte and age limits. Groups expire whole, never one half of a send. */
export class InteractionJournal {
  #groups = new Map<
    string,
    {
      events: Event[];
      bytes: number;
      retainedAt: number;
      retention: Event["retention"];
      lost: number;
    }
  >();
  #pin?: string;
  #order = new Map<string, number>();
  #sequence = 0;
  #expired = new Map<string, number>();
  #dropped = 0;
  get dropped() {
    return this.#dropped;
  }
  #remove(id: string) {
    const group = this.#groups.get(id);
    if (group) {
      this.#dropped += group.events.length;
      group.events.forEach((event) => this.#order.delete(event.id));
      this.#expired.set(id, group.events.length + group.lost);
      if (this.#expired.size > 100)
        this.#expired.delete(this.#expired.keys().next().value!);
    }
    this.#groups.delete(id);
  }
  #prune() {
    const now = Date.now();
    for (const [id, group] of this.#groups)
      if (
        id !== this.#pin &&
        now - group.retainedAt > RETENTION[group.retention].ageMs
      )
        this.#remove(id);
    for (const kind of ["user", "background"] as const) {
      const groups = [...this.#groups].filter(([, g]) => g.retention === kind);
      let bytes = groups.reduce((n, [, g]) => n + g.bytes, 0),
        count = groups.length;
      for (const [id, g] of groups) {
        if (
          count <= RETENTION[kind].interactions &&
          bytes <= RETENTION[kind].bytes
        )
          break;
        if (id === this.#pin) continue;
        bytes -= g.bytes;
        count--;
        this.#remove(id);
      }
    }
  }
  append(input: Event): Event {
    const event = immutable(eventSchema.parse(input));
    const key = `${event.owner ?? ""}/${event.interaction}`;
    let group = this.#groups.get(key);
    if (group?.events.some((e) => e.id === event.id)) return event;
    group ??= {
      events: [],
      lost: this.#expired.get(key) ?? 0,
      bytes: 0,
      retainedAt: Date.now(),
      retention: event.retention,
    };
    // A user action is never demoted by a child/background observation.
    if (event.retention === "user") group.retention = "user";
    this.#order.set(event.id, ++this.#sequence);
    group.events.push(event);
    group.bytes += new TextEncoder().encode(JSON.stringify(event)).length;
    if (group.events.length > RETENTION.eventsPerInteraction) {
      // Mark bounded incompleteness; never pretend a partial group is a full capture.
      const removed = group.events.shift()!;
      this.#order.delete(removed.id);
      group.lost++;
      group.bytes -= new TextEncoder().encode(JSON.stringify(removed)).length;
      this.#dropped++;
    }
    this.#groups.set(key, group);
    this.#prune();
    return event;
  }
  get events(): Event[] {
    this.#prune();
    return [...this.#groups.values()]
      .flatMap((g) => g.events)
      .sort((a, b) => this.#order.get(a.id)! - this.#order.get(b.id)!);
  }
  completeness(interaction: string, owner = "") {
    const id = `${owner}/${interaction}`;
    this.#prune();
    const group = this.#groups.get(id);
    return immutable({
      available: !!group,
      retained: group?.events.length ?? 0,
      evicted: group?.lost ?? this.#expired.get(id) ?? null,
      scope:
        "Only observations received by this recorder; unobserved host steps remain unknown",
      complete: !!group && group.lost === 0,
    });
  }
  pin(interaction?: string, owner = "") {
    const id = interaction ? `${owner}/${interaction}` : undefined;
    this.#pin = id && this.#groups.has(id) ? id : undefined;
    this.#prune();
  }
}
export class Recorder {
  readonly session = crypto.randomUUID();
  readonly journal = new InteractionJournal();
  readonly source: Event["source"];
  #sink?: (event: Event) => void;
  get events() {
    return this.journal.events;
  }
  get dropped() {
    return this.journal.dropped;
  }
  constructor(source: Event["source"], sink?: (event: Event) => void) {
    this.source = source;
    this.#sink = sink;
  }
  record(
    interaction: string,
    method: string,
    direction: string,
    phase: Event["phase"],
    status: string,
    value: unknown,
    context: EventContext = {},
  ): Event {
    const event = this.journal.append(
      eventSchema.parse({
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
        ...context,
      }),
    );
    try {
      this.#sink?.(event);
    } catch {
      /* Diagnostic failure never changes the observed result. */
    }
    return event;
  }
}
