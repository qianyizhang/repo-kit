import { z } from 'zod';
import { eventSchema, eventMetadataSchema } from './events.ts';
import type { LogStore } from './store.ts';

type Definition = {
  name: string;
  description: string;
  input: z.ZodObject;
  writes: boolean;
  run(value: unknown): Record<string, unknown>;
};
function define<I extends z.ZodObject>(
  name: string,
  description: string,
  input: I,
  writes: boolean,
  run: (args: z.infer<I>) => Record<string, unknown>,
): Definition {
  return { name, description, input, writes, run: (value) => run(input.parse(value)) };
}
/** HTTP and MCP publish the same scoped diagnostic operations. */
export function diagnosticOperations(store: LogStore, identity: object, catalog: () => unknown[]) {
  return [
    define(
      'diagnostics_info',
      'Read server identity, canonical log path, retention and recording health. No payloads.',
      z.object({}).strict(),
      false,
      () => ({
        ...identity,
        instance: store.instance,
        ...store.status(),
        coverage:
          'Server JSON-RPC/HTTP boundaries and app SDK calls. IDs are local to each boundary; host internals and model responses are unobserved.',
      }),
    ),
    define(
      'diagnostics_tools',
      'List contracts from the active server registrations. No domain data.',
      z.object({}).strict(),
      false,
      () => ({ tools: catalog() }),
    ),
    define(
      'diagnostics_append',
      'Retain one app observation in bounded memory and persist its metadata only. App-origin observations remain claims.',
      z.object({ event: eventSchema }).strict(),
      true,
      ({ event }) => {
        store.append({ ...event, source: 'app' });
        return { stored: !store.error, health: store.status().health };
      },
    ),
    define(
      'diagnostics_events',
      'Read at most 20 recent server event summaries. Payloads excluded; inspection never repeats an action.',
      z
        .object({
          limit: z.number().int().min(1).max(20).default(20),
          interaction: z.uuid().optional(),
        })
        .strict(),
      false,
      ({ limit, interaction }) => ({
        events: store.events
          .filter(
            (event) =>
              event.source === 'server' && (!interaction || event.interaction === interaction),
          )
          .slice(-limit)
          .map((event) => eventMetadataSchema.parse(event)),
      }),
    ),
    define(
      'diagnostics_event',
      'Read one frozen, masked, bounded diagnostic event. Expired payloads are unavailable.',
      z.object({ id: z.uuid() }).strict(),
      false,
      ({ id }) => {
        const event = store.events.find((event) => event.id === id);
        if (!event) throw new Error('Observation unavailable or expired');
        return { event };
      },
    ),
    define(
      'diagnostics_capture',
      'Save diagnostic capture: explicitly persist the retained masked payloads for one selected interaction. No source reread or replay.',
      z.object({ interaction: z.uuid() }).strict(),
      true,
      ({ interaction }) => store.capture(interaction),
    ),
  ];
}
