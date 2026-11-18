import { DiagnosticFiles } from "./diagnostic-files.ts";
import { eventsForOwner } from "./diagnostic-owner.ts";
import { eventSchema, type Event } from "./observability.ts";

export class LogStore extends DiagnosticFiles {
  private readonly records: { event: Event; owner: string }[] = [];
  constructor(root?: string) {
    super("__APP_ID__", root);
  }
  events(owner: string) {
    return eventsForOwner(this.records, owner).map(({ event }) => event);
  }
  append(input: Event, owner: string) {
    const event = eventSchema.parse(input);
    if (this.events(owner).some((item) => item.id === event.id)) return;
    this.records.push({ event, owner });
    if (this.records.length > 500) this.records.shift();
    this.writeMetadata(event);
  }
  capture(interaction: string, owner: string) {
    return this.writeCapture(
      interaction,
      this.events(owner).filter((event) => event.interaction === interaction),
    );
  }
}
