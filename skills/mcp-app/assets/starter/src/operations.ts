import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { eventSchema, Recorder, snapshot } from "./observability.ts";
import { LogStore } from "./log-store.ts";

declare const APP_BUILD: string;
export const build = typeof APP_BUILD === "undefined" ? "source" : APP_BUILD;
export const resourceUri = `ui://__APP_ID__/app-${build}.html`;
const notes = [
  {
    id: "welcome",
    revision: 1,
    title: "Welcome",
    text: "A small selected note. Standalone and hosted views use the same operations.",
  },
  {
    id: "other",
    revision: 1,
    title: "Another note",
    text: "This unrelated note must not appear in a message about Welcome.",
  },
];
const correlation = z.uuid().optional();
type Result = Record<string, unknown>;
type Definition = {
  name: string;
  purpose: string;
  visibility: ("app" | "model")[];
  effect: string;
  authorization: string;
  scope: string;
  source: string;
  input: z.ZodObject;
  output: z.ZodObject;
  example: Record<string, unknown>;
  run: (value: unknown) => Result;
};
function define<I extends z.ZodObject, O extends z.ZodObject>(
  input: I,
  output: O,
  description: Omit<Definition, "input" | "output" | "run">,
  run: (value: z.infer<I>) => z.infer<O>,
): Definition {
  return {
    ...description,
    input,
    output,
    run: (value) => output.parse(run(input.parse(value))),
  };
}
const noteSchema = z.object({
  id: z.string(),
  revision: z.number().int(),
  title: z.string(),
  text: z.string(),
});
export function createOperations(store = new LogStore()) {
  const log = new Recorder("server", (event) => store.append(event));
  const definitions: Definition[] = [
    define(
      z.object({}).strict(),
      z.object({ build: z.string(), resourceUri: z.string() }),
      {
        name: "app_open",
        purpose: "Open the note browser",
        visibility: ["model"],
        effect: "Opens a panel; does not return the note catalog to the model",
        authorization: "Host tool access; no external data",
        scope: "App identity only",
        source: "src/operations.ts",
        example: {},
      },
      () => ({ build, resourceUri }),
    ),
    define(
      z.object({ interaction: correlation }).strict(),
      z.object({ notes: z.array(noteSchema.omit({ text: true })) }),
      {
        name: "notes_list",
        purpose: "List the available fixture notes",
        visibility: ["app", "model"],
        effect: "Reads fixture metadata",
        authorization: "Local fixture data; replace with domain authorization",
        scope: "Two fixture notes; no bodies",
        source: "src/operations.ts",
        example: {},
      },
      () => ({ notes: notes.map(({ text: _text, ...note }) => note) }),
    ),
    define(
      z.object({ id: z.string().max(80), interaction: correlation }).strict(),
      z.object({ note: noteSchema }),
      {
        name: "note_read",
        purpose: "Read one exact fixture note",
        visibility: ["app", "model"],
        effect: "Reads one note body and revision",
        authorization: "Exact known fixture ID",
        scope: "One note, never the whole collection",
        source: "src/operations.ts",
        example: { id: "welcome" },
      },
      ({ id }) => {
        const note = notes.find((item) => item.id === id);
        if (!note) throw new Error("Unknown note");
        return { note };
      },
    ),
    define(
      z.object({}).strict(),
      z.object({
        info: z.record(z.string(), z.unknown()),
        tools: z.array(z.record(z.string(), z.unknown())),
      }),
      {
        name: "app_info",
        purpose: "Show identity, log health and tool catalog",
        visibility: ["app"],
        effect: "Reads diagnostics metadata only",
        authorization:
          "Local companion; app-only visibility is not authorization",
        scope: "Current server and registered tool contracts",
        source: "src/operations.ts",
        example: {},
      },
      () => ({
        info: {
          app: "__APP_ID__",
          build,
          resourceUri,
          instance: store.instance,
          ...store.status(),
        },
        tools: catalog(),
      }),
    ),
    define(
      z.object({ event: eventSchema }).strict(),
      z.object({ stored: z.boolean(), health: z.string() }),
      {
        name: "logs_append",
        purpose: "Record one app observation",
        visibility: ["app"],
        effect:
          "Persists metadata; keeps the payload in bounded memory; never adds model context",
        authorization: "Validated event; source forced to app",
        scope: "One live 64 KiB payload; app-origin claim",
        source: "src/log-store.ts",
        example: {
          event: {
            id: "00000000-0000-4000-8000-000000000001",
            session: "00000000-0000-4000-8000-000000000002",
            interaction: "00000000-0000-4000-8000-000000000003",
            time: "2026-01-01T00:00:00.000Z",
            source: "app",
            method: "ui/message",
            direction: "App → Host",
            phase: "request",
            status: "sending",
            payload: snapshot({
              role: "user",
              content: [{ type: "text", text: "hi" }],
            }),
          },
        },
      },
      ({ event }) => {
        store.append({ ...event, source: "app" });
        return { stored: !store.error, health: store.status().health };
      },
    ),
    define(
      z
        .object({
          interaction: z.uuid().optional(),
          offset: z.number().int().min(0).default(0),
          limit: z.number().int().min(1).max(20).default(20),
        })
        .strict(),
      z.object({
        events: z.array(eventSchema.omit({ payload: true })),
        next: z.number().nullable(),
      }),
      {
        name: "logs_list",
        purpose: "List recent event summaries",
        visibility: ["app"],
        effect: "Reads diagnostics without recording the inspection",
        authorization: "Current server memory only",
        scope:
          "Up to 20 summaries; optional exact interaction; payloads excluded",
        source: "src/operations.ts",
        example: { limit: 10 },
      },
      ({ interaction, offset, limit }) => {
        const matching = store.events.filter(
          (item) => !interaction || item.interaction === interaction,
        );
        return {
          events: matching
            .slice(offset, offset + limit)
            .map(({ payload: _payload, ...event }) => event),
          next: offset + limit < matching.length ? offset + limit : null,
        };
      },
    ),
    define(
      z.object({ interaction: z.uuid() }).strict(),
      z.object({
        path: z.string(),
        savedAt: z.iso.datetime(),
        eventCount: z.number().int(),
      }),
      {
        name: "logs_capture",
        purpose: "Save one interaction's diagnostic capture",
        visibility: ["app"],
        effect:
          "Explicitly writes the retained masked payloads for one interaction to disk",
        authorization:
          "User chooses Save diagnostic capture for this interaction; app-only visibility is not authorization",
        scope:
          "Current retained observations only; up to 2 MiB and 8 captures per session; no reread or replay",
        source: "src/log-store.ts",
        example: { interaction: "00000000-0000-4000-8000-000000000003" },
      },
      ({ interaction }) => store.capture(interaction),
    ),
    define(
      z.object({ id: z.uuid() }).strict(),
      z.object({ event: eventSchema }),
      {
        name: "logs_event",
        purpose: "Inspect one frozen event payload",
        visibility: ["app"],
        effect: "Reads a recorded payload; never reruns its action",
        authorization: "Exact event ID in current server memory",
        scope:
          "One live retained event; historical payloads exist only in explicitly saved captures",
        source: "src/operations.ts",
        example: { id: "00000000-0000-4000-8000-000000000000" },
      },
      ({ id }) => {
        const event = store.events.find((item) => item.id === id);
        if (!event) throw new Error("Event unavailable or expired");
        return { event };
      },
    ),
  ];
  function catalog() {
    return definitions.map(({ run: _run, input, output, ...definition }) => ({
      ...definition,
      inputSchema: z.toJSONSchema(input, { target: "draft-7", io: "input" }),
      outputSchema: z.toJSONSchema(output, { target: "draft-7", io: "output" }),
    }));
  }
  function call(name: string, value: unknown): CallToolResult {
    const definition = definitions.find((item) => item.name === name);
    if (!definition) throw new Error("Unknown operation");
    const observer = name.startsWith("logs_") || name === "app_info";
    const supplied = z
      .object({ interaction: z.uuid().optional() })
      .safeParse(value);
    const interaction =
      (supplied.success && supplied.data.interaction) || crypto.randomUUID();
    if (!observer)
      log.record(
        interaction,
        name,
        "Adapter → Server",
        "request",
        "received",
        value,
      );
    try {
      const data = definition.run(value);
      const result = {
        content: [{ type: "text" as const, text: JSON.stringify(data) }],
        structuredContent: data,
      };
      if (!observer)
        log.record(
          interaction,
          name,
          "Server → Adapter",
          "result",
          "completed",
          result,
        );
      return result;
    } catch (error) {
      if (!observer)
        log.record(
          interaction,
          name,
          "Server → Adapter",
          "error",
          "failed",
          String(error),
        );
      return {
        isError: true,
        content: [{ type: "text" as const, text: String(error) }],
      };
    }
  }
  return { definitions, catalog, call, store };
}
