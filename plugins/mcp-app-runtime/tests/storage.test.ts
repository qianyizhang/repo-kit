import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Recorder, snapshot } from "../src/events.ts";
import { LogStore, pruneSessions } from "../src/store.ts";

void test("journal keeps receipt order, isolates equal interaction IDs by owner, and labels partial captures", (t) => {
  const root = mkdtempSync(join(tmpdir(), "shared-journal-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const store = new LogStore("test", root),
    recorder = new Recorder("server", (event) => store.append(event));
  const a = crypto.randomUUID(),
    b = crypto.randomUUID();
  const one = recorder.record(
    a,
    "call",
    "App → Server",
    "request",
    "sent",
    { text: "retained private text" },
    { owner: "chat:a" },
  );
  const two = recorder.record(
    b,
    "call",
    "App → Server",
    "request",
    "sent",
    {},
    { owner: "chat:b" },
  );
  const three = recorder.record(
    a,
    "call",
    "Server → App",
    "result",
    "accepted",
    {},
    { owner: "chat:a" },
  );
  assert.deepEqual(
    recorder.events.map((e) => e.id),
    [one.id, two.id, three.id],
  );
  for (let i = 0; i < 40; i++)
    recorder.record(
      a,
      "call",
      "Server → App",
      "result",
      "observed",
      { i },
      { owner: "chat:b" },
    );
  assert.equal(recorder.journal.completeness(a, "chat:a").evicted, 0);
  assert.equal(recorder.journal.completeness(a, "chat:b").complete, false);
  const capture = store.capture(a, "chat:b");
  const saved = JSON.parse(readFileSync(capture.path, "utf8")) as {
    completeness: { complete: boolean; evicted: number };
  };
  assert.equal(saved.completeness.complete, false);
  assert.equal(saved.completeness.evicted, 8);
  assert.doesNotMatch(
    readFileSync(capture.path, "utf8"),
    /retained private text/,
  );
  assert.doesNotMatch(
    readFileSync(join(store.directory, "server.jsonl"), "utf8"),
    /retained private text/,
  );
  const cycle: { self?: unknown } = {};
  cycle.self = cycle;
  assert.equal(snapshot(cycle).omitted, true);
});
void test("startup retention keeps active and unrecognized evidence and never follows a symlink", (t) => {
  const root = mkdtempSync(join(tmpdir(), "shared-retention-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const app = join(root, "test");
  mkdirSync(app);
  const now = Date.now();
  for (let i = 0; i < 10; i++) {
    const path = join(app, crypto.randomUUID());
    mkdirSync(path);
    writeFileSync(
      join(path, "session.json"),
      JSON.stringify({
        owner: "test",
        pid: 2147483647,
        started: now - i * 1000,
      }),
    );
  }
  const active = join(app, crypto.randomUUID());
  mkdirSync(active);
  writeFileSync(
    join(active, "session.json"),
    JSON.stringify({ owner: "test", pid: process.pid, started: 0 }),
  );
  const outside = join(root, "retained");
  mkdirSync(outside);
  writeFileSync(join(outside, "sentinel"), "keep");
  const link = join(app, crypto.randomUUID());
  symlinkSync(outside, link);
  const unknown = join(app, crypto.randomUUID());
  mkdirSync(unknown);
  writeFileSync(
    join(unknown, "session.json"),
    JSON.stringify({ owner: "test", pid: 2147483647, started: 0 }),
  );
  writeFileSync(join(unknown, "unrecognized"), "keep");
  pruneSessions(app, "test", now);
  assert.equal(readdirSync(app).length, 11); // 8 inactive, active, symlink, unknown directory.
  assert.equal(readFileSync(join(unknown, "unrecognized"), "utf8"), "keep");
  assert.equal(existsSync(active), true);
  assert.equal(readFileSync(join(outside, "sentinel"), "utf8"), "keep");
});
void test("equal event IDs from different owners remain independently ordered and capturable", (t) => {
  const root = mkdtempSync(join(tmpdir(), "shared-capture-owner-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const store = new LogStore("test", root);
  const event = new Recorder("app").record(
    crypto.randomUUID(),
    "test",
    "App → Server",
    "request",
    "observed",
    "private-a",
  );
  store.append({ ...event, owner: "chat:a" });
  store.append({ ...event, owner: "chat:b", payload: snapshot("private-b") });
  store.append({ ...event, owner: "chat:a" });
  assert.deepEqual(
    store.events.map((record) => record.owner),
    ["chat:a", "chat:b"],
  );
  assert.throws(() => store.capture(event.interaction), /expired/);
  const path = store.capture(event.interaction, "chat:b").path;
  assert.match(readFileSync(path, "utf8"), /private-b/);
  assert.doesNotMatch(readFileSync(path, "utf8"), /private-a/);
});
void test("startup tolerates another pruner removing an enumerated session and reports genuine errors", (t) => {
  const root = mkdtempSync(join(tmpdir(), "shared-prune-race-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const app = join(root, "race");
  const expired = join(app, crypto.randomUUID());
  const session = join(expired, "session.json");
  mkdirSync(expired, { recursive: true });
  writeFileSync(
    session,
    JSON.stringify({ owner: "race", pid: 2147483647, started: 0 }),
  );
  const lstat = fs.lstatSync;
  t.mock.method(fs, "lstatSync", (path: string) => {
    // Reproduce a second process winning the race after directory enumeration.
    if (path === session) rmSync(expired, { recursive: true, force: true });
    return lstat(path);
  });
  syncBuiltinESMExports();
  let store: LogStore;
  try {
    store = new LogStore("race", root);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
  assert.equal(store.status().health, "recording");
  assert.equal(store.status().retentionError, null);
  new Recorder("app", (event) => store.append(event)).record(
    crypto.randomUUID(),
    "startup",
    "App → Server",
    "result",
    "observed",
    {},
  );
  assert.equal(existsSync(join(store.directory, "app.jsonl")), true);

  const readdir = fs.readdirSync;
  t.mock.method(fs, "readdirSync", (path: string) => {
    if (path === app)
      throw Object.assign(new Error("retention denied"), { code: "EACCES" });
    return readdir(path);
  });
  syncBuiltinESMExports();
  try {
    const status = new LogStore("race", root).status();
    assert.equal(status.health, "recording");
    assert.match(status.retentionError ?? "", /retention denied/);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }

  writeFileSync(join(root, "blocked"), "not a directory");
  const blocked = new LogStore("blocked", root).status();
  assert.equal(blocked.health, "memory-only");
  assert.match(blocked.error ?? "", /EEXIST|ENOTDIR/);
});
