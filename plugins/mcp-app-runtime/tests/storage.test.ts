import { test } from "node:test";
import assert from "node:assert/strict";
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
  pruneSessions(app, "test", now);
  assert.equal(readdirSync(app).length, 10); // 8 inactive + active + unowned symlink.
  assert.equal(existsSync(active), true);
  assert.equal(readFileSync(join(outside, "sentinel"), "utf8"), "keep");
});
