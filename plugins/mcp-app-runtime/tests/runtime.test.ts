import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { HostSession, type HostAdapter } from "../src/host-session.ts";
import { RuntimeError } from "../src/definition.ts";
import {
  ScopedRegistry,
  hostedPrincipal,
  LOCAL_PRINCIPAL,
} from "../src/registry.ts";
import { Recorder } from "../src/events.ts";
import { poll } from "../src/poller.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
function fixture() {
  const messages: unknown[] = [];
  const adapter = {
    ontoolresult() {},
    ontoolinput() {},
    ontoolinputpartial() {},
    ontoolcancelled() {},
    onhostcontextchanged() {},
    async onteardown() {
      return {};
    },
    onclose() {},
    onerror() {},
    async connect() {},
    async close() {},
    getHostCapabilities: () => ({
      message: { text: {} },
      serverTools: {},
      serverResources: {},
      openLinks: {},
      downloadFile: {},
    }),
    getHostVersion: () => ({ name: "fixture", version: "1" }),
    getHostContext: () => ({}),
    async callServerTool() {
      return { content: [] };
    },
    async readServerResource() {
      return { contents: [] };
    },
    async sendMessage(value: unknown) {
      messages.push(value);
      return {};
    },
    async updateModelContext() {
      return {};
    },
    async openLink() {
      return {};
    },
    async downloadFile() {
      return {};
    },
    async requestTeardown() {},
  } as HostAdapter;
  return { adapter, messages };
}
const code = (expected: string) => (error: unknown) =>
  error instanceof RuntimeError && error.code === expected;

void test("declaration and callbacks are fixed; capabilities are detached; disposal is terminal", async () => {
  const { adapter } = fixture();
  let target = 0;
  const definition = {
    name: "test",
    version: "1",
    capabilities: { availableDisplayModes: ["inline" as const] },
  };
  const handlers = {
    ontoolresult: () => {
      target++;
    },
  };
  const session = new HostSession(definition, handlers, () => adapter);
  definition.name = "changed";
  handlers.ontoolresult = () => {
    target += 100;
  };
  assert.equal(session.definition.name, "test");
  assert.throws(() => {
    session.definition.capabilities!.availableDisplayModes!.push("fullscreen");
  }, TypeError);
  await session.connect();
  adapter.ontoolresult?.({ content: [] });
  assert.equal(target, 1);
  await session.dispose();
  await session.dispose();
  adapter.ontoolresult?.({ content: [] });
  assert.equal(target, 1);
  await assert.rejects(session.connect(), code("unavailable"));
  assert.equal(session.snapshot().phase, "closed");
});
void test("frozen send is dispatched once; pre-dispatch unavailability differs from uncertain delivery", async () => {
  const { adapter, messages } = fixture(),
    connected = deferred<void>(),
    acknowledgment = deferred<{}>();
  adapter.connect = () => connected.promise;
  adapter.sendMessage = (value) => {
    messages.push(value);
    return acknowledgment.promise;
  };
  const session = new HostSession(
    { name: "test", version: "1" },
    {},
    () => adapter,
  );
  const input = {
    role: "user" as const,
    content: [{ type: "text" as const, text: "  exact text  " }],
  };
  const first = session.sendMessage(input);
  input.content[0].text = "edited later";
  await assert.rejects(session.sendMessage(input), code("busy"));
  connected.resolve();
  await delay(0);
  assert.equal((messages[0] as typeof input).content[0].text, "  exact text  ");
  await session.dispose();
  acknowledgment.resolve({});
  await assert.rejects(first, code("uncertain"));
  assert.equal(messages.length, 1);
  const unavailable = fixture();
  unavailable.adapter.getHostCapabilities = () => ({});
  const other = new HostSession(
    { name: "no-message", version: "1" },
    {},
    () => unavailable.adapter,
  );
  await assert.rejects(other.sendMessage(input), code("unavailable"));
  assert.equal(unavailable.messages.length, 0);
  await other.dispose();
});
void test("a delayed read from an ended session cannot become a new session result", async () => {
  const old = fixture(),
    pending = deferred<{ content: [] }>();
  old.adapter.callServerTool = () => pending.promise;
  const a = new HostSession({ name: "a", version: "1" }, {}, () => old.adapter);
  const read = a.callServerTool({ name: "read" });
  await delay(0);
  await a.dispose();
  const b = new HostSession(
    { name: "b", version: "1" },
    {},
    () => fixture().adapter,
  );
  await b.connect();
  pending.resolve({ content: [] });
  await assert.rejects(read, code("closed"));
  assert.equal(b.snapshot().phase, "ready");
  assert.notEqual(a.definition.id, b.definition.id);
  await b.dispose();
});
void test("registry resolves ownership for every lookup and releases expired or closed contexts once", () => {
  const a = hostedPrincipal({ threadId: crypto.randomUUID() }),
    b = hostedPrincipal({ threadId: crypto.randomUUID() });
  assert.throws(() => hostedPrincipal({}), code("forbidden"));
  let now = 0;
  const disposed: string[] = [];
  const registry = new ScopedRegistry<string>(
    { maxEntries: 2, maxBytes: 10, maxAgeMs: 100, overflow: "reject" },
    (v) => disposed.push(v),
    () => now,
  );
  const id = registry.create(a, "a", 6);
  assert.equal(registry.resolve(id, a), "a");
  assert.throws(() => registry.resolve(id, b), code("expired"));
  assert.deepEqual(registry.list(b), []);
  assert.throws(() => registry.create(b, "b", 5), code("limit"));
  now = 101;
  assert.throws(() => registry.resolve(id, a), code("expired"));
  assert.deepEqual(disposed, ["a"]);
  registry.create(LOCAL_PRINCIPAL, "local", 2);
  registry.close();
  registry.close();
  assert.deepEqual(disposed, ["a", "local"]);
  assert.throws(() => registry.list(a), code("closed"));
});
void test("background traffic cannot evict frozen user interactions; returned collections cannot mutate history", () => {
  const log = new Recorder("app"),
    id = crypto.randomUUID();
  const payload = { text: "selected text", token: "secret", totalTokens: 7 };
  log.record(id, "ui/message", "App → Host", "request", "sending", payload);
  log.record(id, "ui/message", "Host → App", "result", "accepted", {});
  payload.text = "later";
  for (let i = 0; i < 5000; i++)
    log.record(
      crypto.randomUUID(),
      "status",
      "App → Server",
      "request",
      "sent",
      {},
      { retention: "background" },
    );
  const selected = log.events.filter((e) => e.interaction === id);
  assert.equal(selected.length, 2);
  assert.match(selected[0].payload.text, /selected text/);
  assert.doesNotMatch(selected[0].payload.text, /secret/);
  assert.match(selected[0].payload.text, /totalTokens/);
  assert.ok(log.events.length <= 102);
  log.events.splice(0);
  assert.equal(log.events.filter((e) => e.interaction === id).length, 2);
  assert.throws(() => {
    selected[0].status = "changed";
  }, TypeError);
});
void test("polling is single-flight, visibility-aware and stops without further dispatch", async () => {
  const visibility = new EventTarget() as Document;
  Object.defineProperty(visibility, "visibilityState", {
    value: "visible",
    writable: true,
  });
  const pending = deferred<void>();
  let calls = 0;
  let signal: AbortSignal | undefined;
  const stop = poll(
    async (s) => {
      calls++;
      signal = s;
      await pending.promise;
    },
    { interval: 5, visibility },
  );
  await delay(20);
  assert.equal(calls, 1);
  stop();
  pending.resolve();
  await delay(20);
  assert.equal(calls, 1);
  assert.equal(signal?.aborted, true);
  Object.defineProperty(visibility, "visibilityState", { value: "hidden" });
  const stopHidden = poll(
    async () => {
      calls++;
    },
    { interval: 5, visibility },
  );
  await delay(15);
  assert.equal(calls, 1);
  stopHidden();
});
