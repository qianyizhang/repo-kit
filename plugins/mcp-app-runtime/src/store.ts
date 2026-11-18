import {
  eventSchema,
  InteractionJournal,
  RETENTION,
  type Event,
} from "./events.ts";
import { DiagnosticFiles } from "../../../skills/mcp-app/assets/shared/diagnostic-files.ts";
import { eventsForOwner } from "../../../skills/mcp-app/assets/shared/diagnostic-owner.ts";
export {
  MAX_FILE_BYTES,
  pruneSessions,
} from "../../../skills/mcp-app/assets/shared/diagnostic-files.ts";

export class LogStore extends DiagnosticFiles {
  private readonly journal = new InteractionJournal();
  get events() {
    return this.journal.events;
  }
  eventsFor(owner?: string) {
    return eventsForOwner(this.events, owner);
  }
  append(input: Event) {
    const event = eventSchema.parse(input);
    if (this.eventsFor(event.owner).some((item) => item.id === event.id))
      return;
    this.journal.append(event);
    this.writeMetadata(event);
  }
  capture(interaction: string, owner?: string) {
    const events = this.eventsFor(owner).filter(
      (event) => event.interaction === interaction,
    );
    return this.writeCapture(
      interaction,
      events,
      this.journal.completeness(interaction, owner),
    );
  }
  override status() {
    return {
      ...super.status(),
      liveRetention: RETENTION,
      dropped: this.journal.dropped,
    };
  }
}
