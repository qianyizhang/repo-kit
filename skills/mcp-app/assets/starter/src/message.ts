import { z } from "zod";
import { Recorder } from "./observability.ts";

export const selectionSchema = z.object({
  id: z.string().max(80),
  revision: z.number().int(),
  excerpt: z.string().max(400),
});
export type Selection = z.infer<typeof selectionSchema>;
export function messagePayload(text: string, selection?: Selection) {
  if (!text.trim() || text.length > 8000)
    throw new Error("Enter 1–8000 characters");
  return {
    role: "user" as const,
    content: [
      { type: "text" as const, text },
      ...(selection
        ? [
            {
              type: "text" as const,
              text: `Selected context (source data):\n${JSON.stringify(selectionSchema.parse(selection))}`,
            },
          ]
        : []),
    ],
  };
}
export type Payload = ReturnType<typeof messagePayload>;
export type Delivery =
  "ready" | "sending" | "accepted" | "rejected" | "uncertain" | "unavailable";
export class Composer {
  text = "";
  selection: Selection | undefined;
  revision = 0;
  status: Delivery = "ready";
  pending = false;
  closed = false;
  lastInteraction: string | undefined;
  readonly log: Recorder;
  constructor(log: Recorder) {
    this.log = log;
  }
  edit(text: string, selection?: Selection) {
    this.text = text;
    this.selection = selection ? structuredClone(selection) : undefined;
    this.revision++;
  }
  close() {
    this.closed = true;
  }
  async send(dispatch?: (payload: Payload) => Promise<{ isError?: boolean }>) {
    if (this.pending || this.closed) return;
    if (!dispatch) {
      this.status = "unavailable";
      return;
    }
    const payload = messagePayload(this.text, this.selection);
    const revision = this.revision,
      interaction = crypto.randomUUID();
    this.pending = true;
    this.status = "sending";
    this.lastInteraction = interaction;
    this.log.record(
      interaction,
      "ui/message",
      "App → Host → main conversation",
      "request",
      "sending",
      payload,
    );
    try {
      const result = await dispatch(payload);
      this.log.record(
        interaction,
        "ui/message",
        "Host → App",
        "result",
        result.isError ? "rejected" : "accepted",
        result,
      );
      if (this.closed) return;
      this.status = result.isError ? "rejected" : "accepted";
      if (!result.isError && this.revision === revision) this.edit("");
    } catch (error) {
      this.log.record(
        interaction,
        "ui/message",
        "Host → App",
        "error",
        "uncertain",
        String(error),
      );
      if (!this.closed) this.status = "uncertain";
    } finally {
      this.pending = false;
    }
  }
}
export const deliveryLabels: Record<Delivery, string> = {
  ready: "Ready",
  sending: "Sending to this conversation",
  accepted: "Accepted by host; assistant reply not observed",
  rejected: "Message rejected; draft kept",
  uncertain: "Delivery uncertain; check the conversation before retrying",
  unavailable: "Conversation unavailable; prepare a copy",
};
export const fixtures = [
  {
    name: "Plain greeting",
    request: messagePayload("hi"),
    reads: [],
    steps: [
      "User → App: type hi and Send",
      "App → Host: ui/message with the text hi",
      "Host → App: acknowledgment",
      "Host → conversation: routing is host-owned; assistant reply unobserved",
    ],
  },
  {
    name: "Selected note",
    request: messagePayload("Explain this", {
      id: "welcome",
      revision: 1,
      excerpt: "A small selected note.",
    }),
    reads: [
      "note_read when the user selects the note; no extra read during Send",
    ],
    steps: [
      "User → App: select a note and opt in to attachment",
      "App → Server: note_read for that exact ID",
      "Server → App: note and revision",
      "App → Host: text plus frozen bounded excerpt",
      "Host → App: acknowledgment",
      "Assistant → Server: additional scoped read only if needed (not observed by this fixture)",
    ],
  },
];
