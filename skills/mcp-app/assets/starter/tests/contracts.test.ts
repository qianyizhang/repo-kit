import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Composer, messagePayload } from "../src/message.ts";
import { Recorder, snapshot } from "../src/observability.ts";
import { LogStore, MAX_FILE_BYTES, pruneSessions } from "../src/log-store.ts";
import { createOperations } from "../src/operations.ts";

test("plain text is direct; selected context is frozen and bounded", () => {
  assert.deepEqual(messagePayload(" hi "), {
    role: "user",
    content: [{ type: "text", text: " hi " }],
  });
  const selection = { id: "one", revision: 1, excerpt: "selected" };
  const request = messagePayload("Explain", selection);
  selection.excerpt = "later";
  assert.match(request.content[1]!.text, /selected/);
  assert.doesNotMatch(request.content[1]!.text, /later/);
  assert.throws(() =>
    messagePayload("Explain", { ...selection, excerpt: "x".repeat(401) }),
  );
});
test("pending send prevents duplicate dispatch; acknowledgment preserves a newer revision", async () => {
  const log = new Recorder("app"),
    composer = new Composer(log);
  let release!: (result: {}) => void,
    count = 0;
  composer.edit("first");
  const send = () => {
    count++;
    return new Promise<{}>((resolve) => {
      release = resolve;
    });
  };
  const pending = composer.send(send);
  await composer.send(send);
  composer.edit("second");
  composer.edit("first"); // Same bytes, different draft ownership.
  release({});
  await pending;
  assert.equal(count, 1);
  assert.equal(composer.text, "first");
  assert.equal(composer.status, "accepted");
  assert.deepEqual(
    JSON.parse(log.events[0]!.payload.text),
    messagePayload("first"),
  );
});
test("rejected, uncertain, unavailable and teardown outcomes retain drafts", async () => {
  for (const outcome of [
    "rejected",
    "uncertain",
    "unavailable",
    "closed",
  ] as const) {
    const composer = new Composer(new Recorder("app"));
    composer.edit("keep me");
    await composer.send(
      outcome === "unavailable"
        ? undefined
        : async () => {
            if (outcome === "uncertain")
              throw new Error("Disconnected after dispatch");
            if (outcome === "closed") composer.close();
            return { isError: outcome === "rejected" };
          },
    );
    assert.equal(composer.text, "keep me");
    if (outcome !== "closed") assert.equal(composer.status, outcome);
  }
});
test("payload masking, truncation and omission are explicit", () => {
  const secret = snapshot({
    token: "private",
    nested: { password: "private" },
    text: "hello",
  });
  assert.equal(secret.redacted, true);
  assert.doesNotMatch(secret.text, /private/);
  assert.equal(snapshot("x".repeat(70000)).truncated, true);
  assert.equal(snapshot("private prose", true).omitted, true);
  assert.doesNotMatch(snapshot("private prose", true).text, /private prose/);
});
test("credential names are masked without hiding token usage metrics", () => {
  const usage = {
    input_tokens: 120,
    outputTokens: 30,
    totalTokens: 150,
    tokens: { cached: 40 },
    tokenization: "reported",
  };
  const metrics = snapshot({ usage });
  assert.equal(metrics.redacted, false);
  assert.deepEqual(JSON.parse(metrics.text), { usage });
  const credentials = Object.fromEntries(
    [
      "Authorization",
      "Proxy-Authorization",
      "Cookie",
      "Set-Cookie",
      "PASSWORD",
      "secret",
      "client_secret",
      "TOKEN",
      "access_token",
      "refreshToken",
      "id-token",
      "api_key",
      "privateKey",
    ].map((key) => [key, "credential-sentinel"]),
  );
  const masked = snapshot({ usage, nested: [credentials] });
  assert.equal(masked.redacted, true);
  assert.doesNotMatch(masked.text, /credential-sentinel/);
  assert.deepEqual(JSON.parse(masked.text), {
    usage,
    nested: [
      Object.fromEntries(
        Object.keys(credentials).map((key) => [key, "[redacted]"]),
      ),
    ],
  });
});
test("logs are bounded, private, inspectable and non-recursive", () => {
  const root = mkdtempSync(join(tmpdir(), "mcp-log-test-")),
    store = new LogStore(root);
  const operations = createOperations(store),
    recorder = new Recorder("app");
  for (let index = 0; index < 6000; index++) {
    const event = recorder.record(
      crypto.randomUUID(),
      "ui/message",
      "App → Host",
      "request",
      "sending",
      "private diagnostic prose",
    );
    operations.call("logs_append", { event });
  }
  assert.equal(store.events.length, 500);
  assert.ok(readdirSync(store.directory).includes("app.jsonl.1"));
  for (const name of readdirSync(store.directory).filter((name) =>
    name.includes(".jsonl"),
  )) {
    assert.ok(statSync(join(store.directory, name)).size <= MAX_FILE_BYTES);
    assert.equal(statSync(join(store.directory, name)).mode & 0o777, 0o600);
    const persisted = readFileSync(join(store.directory, name), "utf8");
    assert.doesNotMatch(persisted, /private diagnostic prose/);
    persisted
      .trim()
      .split("\n")
      .forEach((line) => JSON.parse(line));
  }
  const before = store.events.length;
  const summaries = operations.call("logs_list", { limit: 2 });
  assert.equal(summaries.structuredContent?.events instanceof Array, true);
  assert.doesNotMatch(JSON.stringify(summaries), /xxxx/);
  assert.equal(
    operations.call("logs_event", { id: store.events[0]!.id }).isError,
    undefined,
  );
  assert.equal(store.events.length, before);
  assert.equal(operations.call("logs_list", { limit: 21 }).isError, true);
});
test("payloads stay live until one interaction is explicitly captured", () => {
  const store = new LogStore(mkdtempSync(join(tmpdir(), "mcp-capture-")));
  const operations = createOperations(store),
    recorder = new Recorder("app");
  const selected = recorder.record(
    crypto.randomUUID(),
    "ui/message",
    "App → Host",
    "request",
    "sending",
    { text: "selected-private-text", token: "never-save-secret" },
  );
  const unrelated = recorder.record(
    crypto.randomUUID(),
    "ui/message",
    "App → Host",
    "request",
    "sending",
    "unrelated-private-text",
  );
  operations.call("logs_append", { event: selected });
  operations.call("logs_append", { event: unrelated });
  assert.match(
    JSON.stringify(operations.call("logs_event", { id: selected.id })),
    /selected-private-text/,
  );
  assert.doesNotMatch(
    readFileSync(join(store.directory, "app.jsonl"), "utf8"),
    /private-text|never-save-secret/,
  );
  assert.equal(
    readdirSync(store.directory).some((name) => name.startsWith("capture-")),
    false,
  );
  const saved = operations.call("logs_capture", {
    interaction: selected.interaction,
  });
  const path = saved.structuredContent!.path as string;
  const capture = readFileSync(path, "utf8");
  assert.match(capture, /selected-private-text/);
  assert.doesNotMatch(capture, /unrelated-private-text|never-save-secret/);
  assert.equal(JSON.parse(capture).events.length, 1);
  assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.equal(store.events.length, 2); // Inspection and capture do not observe themselves.
  assert.equal(
    operations.call("logs_capture", { interaction: crypto.randomUUID() })
      .isError,
    true,
  );
});
test("capture limits fail explicitly without creating partial or unbounded files", () => {
  const store = new LogStore(mkdtempSync(join(tmpdir(), "mcp-capture-limit-")));
  const recorder = new Recorder("app"),
    interaction = crypto.randomUUID();
  for (let i = 0; i < 34; i++)
    store.append(
      recorder.record(
        interaction,
        "ui/message",
        "App → Host",
        "request",
        "sending",
        "x".repeat(64000),
      ),
    );
  assert.throws(() => store.capture(interaction), /2 MiB/);
  assert.equal(
    readdirSync(store.directory).filter((name) => name.startsWith("capture-"))
      .length,
    0,
  );
  const small = crypto.randomUUID();
  store.append(
    recorder.record(
      small,
      "ui/message",
      "App → Host",
      "result",
      "accepted",
      {},
    ),
  );
  for (let i = 0; i < 8; i++) store.capture(small);
  assert.throws(() => store.capture(small), /8 per server session/);
  assert.equal(
    readdirSync(store.directory).filter((name) => name.startsWith("capture-"))
      .length,
    8,
  );
});
test("logging failure leaves domain operations usable and exposes the gap", () => {
  const root = mkdtempSync(join(tmpdir(), "mcp-log-failure-"));
  const file = join(root, "file");
  writeFileSync(file, "not a directory");
  const store = new LogStore(file),
    operations = createOperations(store);
  assert.equal(store.status().health, "memory-only");
  assert.equal(
    operations.call("note_read", { id: "welcome" }).isError,
    undefined,
  );
  assert.equal(operations.call("note_read", { id: "missing" }).isError, true);
  assert.throws(
    () => store.capture(store.events[0]!.interaction),
    /storage unavailable/,
  );
});
test("retention excludes live sessions, symlinks and unknown directories", () => {
  const root = mkdtempSync(join(tmpdir(), "mcp-retention-"));
  const old = Date.now() - 9 * 86400_000;
  for (const kind of ["old", "live", "linked"]) {
    const path = join(root, crypto.randomUUID());
    mkdirSync(path);
    writeFileSync(
      join(path, "session.json"),
      JSON.stringify({
        owner: "__APP_ID__",
        pid: kind === "live" ? process.pid : 2147483647,
        started: old,
      }),
    );
    if (kind === "linked") symlinkSync(root, join(path, "app.jsonl"));
  }
  pruneSessions(root);
  assert.equal(readdirSync(root).length, 2);
});
test("opening is compact; catalog accounts for every registered operation", () => {
  const operations = createOperations(
    new LogStore(mkdtempSync(join(tmpdir(), "mcp-catalog-"))),
  );
  const opened = operations.call("app_open", {});
  assert.doesNotMatch(JSON.stringify(opened), /welcome|Another note|notes/);
  assert.deepEqual(
    operations.catalog().map((tool) => tool.name),
    operations.definitions.map((tool) => tool.name),
  );
  for (const definition of operations.definitions) {
    assert.equal(
      definition.input.safeParse(definition.example).success,
      true,
      definition.name,
    );
  }
  for (const tool of operations.catalog()) {
    assert.ok(
      tool.purpose &&
        tool.effect &&
        tool.scope &&
        tool.authorization &&
        tool.inputSchema &&
        tool.outputSchema,
    );
  }
});
