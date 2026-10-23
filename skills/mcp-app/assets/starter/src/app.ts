import { App } from "@modelcontextprotocol/ext-apps";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  Composer,
  deliveryLabels,
  fixtures,
  messagePayload,
  type Selection,
} from "./message.ts";
import { Recorder, eventSchema, type Event } from "./observability.ts";

declare const APP_BUILD: string;
function element<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}
const draft = element<HTMLTextAreaElement>("draft"),
  attach = element<HTMLInputElement>("attach");
const notes = element<HTMLSelectElement>("note"),
  send = element<HTMLButtonElement>("send");
const dialog = element<HTMLDialogElement>("diagnostics");
const nonce = document.querySelector<HTMLMetaElement>(
  "meta[name=app-nonce]",
)?.content;
const hosted = window.parent !== window;
const app = hosted
  ? new App({ name: "__APP_ID__", version: "0.1.0" }, {})
  : undefined;
let connected = !hosted,
  closed = false,
  selected: Selection | undefined;
let info: Record<string, unknown> = {},
  tools: Record<string, unknown>[] = [];
let recording = "App observations in memory; persistence not yet checked",
  selectionSerial = 0;
let filter: string | undefined;
let captureInteraction: string | undefined;
let inspectionRevision = 0,
  capturePending = false;
const persistence = new Set<Promise<void>>();
const remote = new Map<string, Omit<Event, "payload">>();
const log = new Recorder("app", (event) => {
  if (closed || (hosted && !connected)) {
    recording = "Memory only: server connection unavailable";
    return;
  }
  const pending = raw("logs_append", { event })
    .then((result) => {
      const value = z
        .object({ stored: z.boolean(), health: z.string() })
        .parse(result);
      recording = value.stored
        ? "Recording metadata locally; payloads live until this session ends"
        : "Memory only: server log write failed";
      renderEvents();
    })
    .catch(() => {
      recording = "Memory only: event persistence failed";
      renderEvents();
    });
  persistence.add(pending);
  void pending.finally(() => persistence.delete(pending));
});
const composer = new Composer(log);
async function raw(
  name: string,
  args: Record<string, unknown>,
  observed?: (value: unknown) => void,
) {
  let value: unknown;
  if (app) {
    if (!connected || !app.getHostCapabilities()?.serverTools)
      throw new Error("Server tools unavailable");
    value = await app.callServerTool(
      { name, arguments: args },
      { timeout: 5000 },
    );
  } else {
    if (!nonce)
      throw new Error("Open this app through its standalone HTTP server");
    const response = await fetch(`/api/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-nonce": nonce },
      body: JSON.stringify(args),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    value = await response.json();
  }
  observed?.(value);
  const result = CallToolResultSchema.parse(value);
  if (result.isError) throw new Error(JSON.stringify(result.content));
  return result.structuredContent;
}
async function call(name: string, args: Record<string, unknown>) {
  const interaction = crypto.randomUUID(),
    input = { ...args, interaction };
  log.record(
    interaction,
    name,
    hosted ? "App → Host → Server" : "App → HTTP → Server",
    "request",
    "sending",
    input,
  );
  try {
    const result = await raw(name, input, (value) => {
      const parsed = CallToolResultSchema.safeParse(value);
      log.record(
        interaction,
        name,
        "Server → App",
        "result",
        parsed.success && !parsed.data.isError ? "completed" : "failed",
        value,
      );
    });
    return result;
  } catch (error) {
    log.record(
      interaction,
      name,
      "Server → App",
      "error",
      "failed",
      String(error),
    );
    throw error;
  }
}
function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}
function node(tag: string, text: string) {
  const result = document.createElement(tag);
  result.textContent = text;
  return result;
}
function edit() {
  composer.edit(draft.value, attach.checked ? selected : undefined);
  element("scope").textContent =
    attach.checked && selected
      ? `Attached: ${selected.id}, revision ${selected.revision}, ${selected.excerpt.length} characters.`
      : "No context attached.";
  controls();
}
function controls() {
  send.disabled =
    closed ||
    !connected ||
    !app?.getHostCapabilities()?.message ||
    composer.pending ||
    !draft.value.trim() ||
    (attach.checked && !selected);
  element<HTMLButtonElement>("inspect-send").disabled =
    !composer.lastInteraction;
  element("delivery").textContent = deliveryLabels[composer.status];
}
function metadata() {
  element("metadata-json").textContent = json({
    app: "__APP_ID__",
    panelBuild: APP_BUILD,
    mode: hosted ? "hosted" : "standalone",
    connection: closed
      ? "closed locally"
      : connected
        ? "connected"
        : "unavailable",
    host: app?.getHostVersion() ?? null,
    capabilities: app?.getHostCapabilities() ?? {},
    server: info,
    recording,
    droppedAppEvents: log.dropped,
  });
}
function show(tab: string) {
  for (const id of ["metadata", "tools", "flow", "events"])
    element(id).hidden = tab !== id;
  document
    .querySelectorAll<HTMLButtonElement>("[data-tab]")
    .forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.tab === tab)),
    );
  metadata();
  renderEvents();
}
function renderEvents() {
  element("recording").textContent =
    `${recording}. App-origin observations remain app claims. SDK boundaries only; host internals unknown.`;
  const list = element("event-list");
  list.replaceChildren();
  const localIds = new Set(log.events.map((event) => event.id));
  const summaries = [
    ...log.events,
    ...[...remote.values()].filter((event) => !localIds.has(event.id)),
  ];
  for (const event of summaries.filter(
    (item) => !filter || item.interaction === filter,
  )) {
    const li = node("li", ""),
      button = node(
        "button",
        `${event.source} · ${event.method} · ${event.phase} · ${event.status}`,
      );
    button.onclick = () => {
      void inspect(event.id);
    };
    li.append(button);
    list.append(li);
  }
}
async function inspect(id: string) {
  const revision = ++inspectionRevision;
  captureInteraction = undefined;
  element<HTMLButtonElement>("save-capture").disabled = true;
  element("payload").textContent = "Loading observation…";
  element("capture-status").textContent =
    "Inspect an available observation before saving its interaction.";
  try {
    const local = log.events.find((event) => event.id === id);
    const event =
      local ??
      z.object({ event: eventSchema }).parse(await raw("logs_event", { id }))
        .event;
    if (revision !== inspectionRevision || closed) return;
    element("payload").textContent = json(event);
    captureInteraction = event.interaction;
    element<HTMLButtonElement>("save-capture").disabled = capturePending;
    element("capture-status").textContent =
      `Save the retained app/server payloads for interaction ${event.interaction}. Up to 2 MiB; session retention applies.`;
  } catch (error) {
    if (revision === inspectionRevision && !closed)
      element("payload").textContent = String(error);
  }
}
element("info").onclick = () => {
  filter = undefined;
  show("metadata");
  dialog.showModal();
  void raw("app_info", {})
    .then((value) => {
      info = z
        .object({ info: z.record(z.string(), z.unknown()) })
        .parse(value).info;
      metadata();
    })
    .catch((error) => {
      recording = `Info refresh failed: ${String(error)}`;
      metadata();
    });
};
element("close-info").onclick = () => dialog.close();
document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
  button.onclick = () => {
    filter = undefined;
    show(button.dataset.tab!);
  };
});
draft.oninput = edit;
attach.onchange = edit;
notes.onchange = () => {
  const serial = ++selectionSerial;
  selected = undefined;
  edit();
  if (!notes.value) {
    element("note-body").textContent = "Select a note.";
    return;
  }
  element("note-body").textContent = "Loading note";
  void call("note_read", { id: notes.value })
    .then((value) => {
      if (closed || serial !== selectionSerial) return;
      const { note } = z
        .object({
          note: z.object({
            id: z.string(),
            revision: z.number(),
            text: z.string(),
          }),
        })
        .parse(value);
      selected = {
        id: note.id,
        revision: note.revision,
        excerpt: note.text.slice(0, 400),
      };
      element("note-body").textContent = note.text;
      edit();
    })
    .catch((error) => {
      if (!closed && serial === selectionSerial)
        element("note-body").textContent = String(error);
    });
};
send.onclick = () => {
  void (async () => {
    const pending = composer.send(
      app && connected && app.getHostCapabilities()?.message
        ? (payload) => app.sendMessage(payload, { timeout: 3000 })
        : undefined,
    );
    controls();
    await pending;
    if (closed) return;
    draft.value = composer.text;
    if (!composer.selection) attach.checked = false;
    element("scope").textContent = composer.selection
      ? `Attached: ${composer.selection.id}, revision ${composer.selection.revision}.`
      : "No context attached.";
    controls();
    renderEvents();
  })().catch((error) => {
    element("delivery").textContent = String(error);
  });
};
element("prepare").onclick = () => {
  try {
    if (attach.checked && !selected)
      throw new Error("Select a note before attaching it");
    element("copy-text").textContent = json(
      messagePayload(draft.value, attach.checked ? selected : undefined),
    );
    const preview = element<HTMLDetailsElement>("copy-preview");
    preview.hidden = false;
    preview.open = true;
    element("delivery").textContent = "Prepared for copying; no message sent";
  } catch (error) {
    element("delivery").textContent = String(error);
  }
};
element("inspect-send").onclick = () => {
  filter = composer.lastInteraction;
  show("events");
  dialog.showModal();
};
element("refresh-events").onclick = () => {
  void raw("logs_list", {
    ...(filter ? { interaction: filter } : {}),
    limit: 20,
  })
    .then((value) => {
      const result = z
        .object({
          events: z.array(eventSchema.omit({ payload: true })),
          next: z.number().nullable(),
        })
        .parse(value);
      remote.clear();
      result.events.forEach((event) => remote.set(event.id, event));
      renderEvents();
      if (result.next !== null)
        element("recording").textContent +=
          " Showing first 20 server summaries; full retained files are at the log path.";
    })
    .catch((error) => {
      element("recording").textContent = String(error);
    });
};
element("export-events").onclick = () => {
  element("export-json").textContent = json(
    log.events.filter((event) => !filter || event.interaction === filter),
  );
  const preview = element<HTMLDetailsElement>("export-preview");
  preview.hidden = false;
  preview.open = true;
};
element("save-capture").onclick = () => {
  const interaction = captureInteraction;
  if (!interaction || capturePending) return;
  capturePending = true;
  const button = element<HTMLButtonElement>("save-capture");
  button.disabled = true;
  element("capture-status").textContent = "Saving selected interaction…";
  void (async () => {
    // Include observations already dispatched before this deliberate capture.
    await Promise.all([...persistence]);
    const saved = z
      .object({ path: z.string(), eventCount: z.number() })
      .parse(await raw("logs_capture", { interaction }));
    element("capture-status").textContent =
      `Saved interaction ${interaction}: ${saved.eventCount} retained observations to ${saved.path}`;
  })()
    .catch((error) => {
      element("capture-status").textContent =
        `Capture not confirmed for ${interaction}: ${String(error)}`;
    })
    .finally(() => {
      capturePending = false;
      button.disabled = closed || !captureInteraction;
    });
};
for (const fixture of fixtures) {
  const block = node("section", ""),
    sequence = node("ol", "");
  fixture.steps.forEach((step) => sequence.append(node("li", step)));
  block.append(
    node("h3", fixture.name),
    sequence,
    node("pre", json({ request: fixture.request, reads: fixture.reads })),
  );
  element("fixtures").append(block);
}
if (app) {
  app.onhostcontextchanged = (context) => {
    if (context.theme) document.documentElement.dataset.theme = context.theme;
  };
  app.onteardown = () => {
    closed = true;
    connected = false;
    composer.close();
    selectionSerial++;
    element("connection").textContent =
      "Panel closed locally; host work is not cancelled";
    controls();
    return {};
  };
}
async function start() {
  try {
    if (app) {
      await app.connect();
      connected = true;
    }
    element("connection").textContent = hosted
      ? "Hosted · conversation capability checked"
      : "Standalone · conversation unavailable";
    if (!app?.getHostCapabilities()?.message) composer.status = "unavailable";
    const result = z
      .object({
        info: z.record(z.string(), z.unknown()),
        tools: z.array(z.record(z.string(), z.unknown())),
      })
      .parse(await raw("app_info", {}));
    info = result.info;
    tools = result.tools;
    if (info.build !== APP_BUILD)
      throw new Error("Panel/server build mismatch; reopen after updating");
    for (const tool of tools) {
      const block = node("section", "");
      block.className = "tool";
      block.append(
        node("h3", String(tool.name)),
        node("p", String(tool.purpose)),
      );
      const detail = document.createElement("details");
      detail.append(
        node("summary", "Contract, schemas and example"),
        node("pre", json(tool)),
      );
      block.append(detail);
      element("tools").append(block);
    }
    const data = z
      .object({
        notes: z.array(z.object({ id: z.string(), title: z.string() })),
      })
      .parse(await call("notes_list", {}));
    if (closed) return;
    data.notes.forEach((note) => notes.add(new Option(note.title, note.id)));
    metadata();
    controls();
  } catch (error) {
    connected = false;
    element("connection").textContent = `Unavailable: ${String(error)}`;
    controls();
  }
}
void start();
