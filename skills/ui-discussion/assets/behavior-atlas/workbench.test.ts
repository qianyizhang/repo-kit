import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Workbench, alignVisits, visitsFor } from "./workbench.ts";
import { readIR } from "./schema.ts";
import { compileAtlas } from "./renderer.ts";
import { buildPage } from "./build.ts";
const fixture = JSON.parse(
  await readFile(new URL("./ez-example.json", import.meta.url), "utf8"),
);
const make = () => new Workbench(structuredClone(fixture));
test("replay preserves repeated visits and refuses off-route actions", () => {
  const w = make();
  w.selectJourney("retry");
  assert.equal(w.current(), "draft");
  assert.throws(() => w.take("info"), /not available/);
  w.take("send");
  assert.throws(() => w.take("finish"), /not available/);
  w.take("fail");
  w.take("retry");
  assert.deepEqual(visitsFor(w.ir, w.journey()), [
    "draft",
    "receiving",
    "failed",
    "receiving",
    "answer",
  ]);
  w.scrub(1);
  assert.equal(w.current(), "receiving");
  w.scrub(3);
  assert.equal(w.current(), "receiving");
  assert.equal(w.options().find((o) => o.edge.id === "finish")!.enabled, true);
  w.take("finish");
  assert.equal(w.current(), "answer");
  assert.equal(
    w.options().some((o) => o.enabled),
    false,
  );
});
test("exploration offers only actual transitions; soft outcomes pause, continue and retain exact loops", () => {
  const w = make();
  w.setMode("exploration");
  assert.throws(() => w.take("direct-config"), /not available/);
  for (const id of ["send", "fail", "retry", "finish"]) w.take(id);
  assert.equal(w.paused, true);
  assert.throws(() => w.take("more"), /not available/);
  w.continueExploration();
  w.take("more");
  w.take("export");
  w.take("export-save");
  const captured = w.capture();
  assert.deepEqual(captured.steps, [
    "send",
    "fail",
    "retry",
    "finish",
    "more",
    "export",
    "export-save",
  ]);
  assert.equal(w.mode, "journey");
  assert.equal(w.cursor, 0);
  w.setMode("exploration");
  assert.equal(w.current(), "exported");
  assert.deepEqual(captured.steps, w.exploration.steps);
  w.back();
  assert.equal(captured.steps.length, 7);
  assert.match(w.review(captured), /Request fails \[system\]/);
});
test("terminal outcomes have no continue action and empty exploration cannot be captured", () => {
  const source = structuredClone(fixture);
  source.transitions = source.transitions.filter(
    (e: { from: string }) => e.from !== "exported",
  );
  source.states.find((s: { id: string }) => s.id === "exported").terminal =
    true;
  const w = new Workbench(source);
  w.setMode("exploration");
  assert.throws(() => w.capture(), /Take an action/);
  for (const id of ["send", "finish"]) w.take(id);
  w.continueExploration();
  for (const id of ["more", "export", "export-save"]) w.take(id);
  assert.throws(() => w.continueExploration(), /terminal/);
  assert.equal(w.options().length, 0);
  w.back();
  assert.equal(w.current(), "export");
});
test("trace suggests a route, permits recovery loops, and requires the declared end", () => {
  const w = make();
  w.startTrace("draft", "answer");
  assert.equal(w.current(), "answer");
  assert.deepEqual(w.trace!.steps, ["send", "finish"]);
  w.back();
  w.take("fail");
  w.take("retry");
  assert.throws(() => w.saveTrace("Recovery"), /destination/);
  w.take("finish");
  const j = w.saveTrace("Recovery");
  assert.deepEqual(j.steps, ["send", "fail", "retry", "finish"]);
  assert.equal(w.trace, null);
  w.startTrace("edits", "returned", false);
  for (const id of ["leave", "keep", "save", "return"]) w.take(id);
  const loop = w.saveTrace("Keep editing");
  assert.deepEqual(loop.steps, ["leave", "keep", "save", "return"]);
});
test("guard text never authorizes a transition or a suggested shortcut", () => {
  const input = structuredClone(fixture);
  input.transitions.find((e: { id: string }) => e.id === "finish").guard =
    "Requires confirmation";
  const w = new Workbench(input);
  w.selectJourney("retry");
  w.scrub(3);
  assert.throws(() => w.take("finish"), /not available/);
  w.scrub(4);
  assert.equal(w.current(), "answer"); // Scrubbing examines an authored record; it executes no event.
  w.setMode("exploration");
  w.restart();
  w.take("send");
  assert.throws(() => w.take("finish"), /not available/);
  assert.match(
    w.options().find((o) => o.edge.id === "finish")!.reason,
    /condition not evaluated/,
  );
});
test("comparison cursors are independent; LCS preserves every visit through a fork", () => {
  const w = make();
  w.setMode("comparison");
  w.take("info", 0);
  w.take("direct-config", 1);
  assert.equal(w.current(0), "info");
  assert.equal(w.current(1), "config");
  w.scrub(0, 0);
  assert.equal(w.current(1), "config");
  const a = ["draft", "receiving", "failed", "receiving", "answer"],
    b = ["draft", "receiving", "answer"];
  const columns = alignVisits(a, b);
  assert.deepEqual(
    columns.flatMap((c) => (c.a === undefined ? [] : [c.a])),
    [0, 1, 2, 3, 4],
  );
  assert.deepEqual(
    columns.flatMap((c) => (c.b === undefined ? [] : [c.b])),
    [0, 1, 2],
  );
  for (const col of columns)
    if (col.a !== undefined && col.b !== undefined)
      assert.equal(a[col.a], b[col.b]);
});
test("saved custom routes survive reload; stale or malformed records fail without partial mutation", () => {
  const w = make();
  w.startTrace("edits", "returned", false);
  for (const id of ["leave", "keep", "save", "return"]) w.take(id);
  w.saveTrace("Retained loop");
  const restored = make();
  restored.restoreSaved(w.exportSaved());
  const j = restored.journeys.find((j) => j.label === "Retained loop")!;
  assert.ok(j);
  assert.deepEqual(j.steps, ["leave", "keep", "save", "return"]);
  const bad = JSON.parse(w.exportSaved());
  bad.journeys[0].steps = ["missing"];
  const before = restored.journeys.length;
  assert.throws(() => restored.restoreSaved(JSON.stringify(bad)));
  assert.equal(restored.journeys.length, before);
  const changed = structuredClone(fixture);
  changed.transitions[0].label = "Changed model";
  assert.throws(
    () => new Workbench(changed).restoreSaved(w.exportSaved()),
    /different model/,
  );
});
test("IR rejects broken journeys, invalid comparisons and unexpected preview fields", () => {
  for (const mutate of [
    (x: typeof fixture) => x.journeys[0].steps.push("missing"),
    (x: typeof fixture) => (x.comparisons[0].after = "retry"),
    (x: typeof fixture) => (x.states[0].preview.script = "alert(1)"),
  ]) {
    const input = structuredClone(fixture);
    mutate(input);
    assert.throws(() => readIR(input));
  }
});
test("full and companion maps retain all states and fixed coordinates; companions have no controls", () => {
  const w = make(),
    atlas = compileAtlas(w.ir);
  w.setMode("exploration");
  const attrs = (s: string) =>
    [
      ...s.matchAll(/data-node="([^"]+)" data-x="([^"]+)" data-y="([^"]+)"/g),
    ].map((m) => m.slice(1));
  const before = atlas.render(w.frame(), {});
  w.take("send");
  const after = atlas.render(w.frame(), {});
  const mini = atlas.render(w.frame(), {
    compact: true,
    passive: true,
  });
  assert.equal(attrs(before).length, w.ir.states.length);
  assert.deepEqual(attrs(before), attrs(after));
  assert.deepEqual(attrs(before), attrs(mini));
  assert.doesNotMatch(
    mini,
    /role="button"|tabindex=|data-atlas-action=|data-atlas-state=/,
  );
  assert.match(after, /data-current="receiving"/);
  assert.match(before, /landmark-label/);
});
test("self-contained workbench builds deterministically, includes all modes and escapes fixture content", async () => {
  const input = structuredClone(fixture);
  input.states[0].preview.body = "</script><img src=x onerror=alert(1)>";
  const page = await buildPage(input);
  assert.equal(page, await buildPage(input));
  assert.ok(page.includes("class Workbench"));
  assert.ok(page.includes("Comparison timeline"));
  assert.ok(!page.includes("</script><img"));
  // The inlined module must not leave unresolved relative imports or duplicate re-exports.
  assert.doesNotMatch(page, /from "\.\/(?:landscape|workbench)\.ts"/);
});

test("a full catalog can select a duplicate route while refusing a new one", () => {
  const input = structuredClone(fixture);
  while (input.journeys.length < 100)
    input.journeys.push({
      ...input.journeys[0],
      id: `extra-${input.journeys.length}`,
    });
  const w = new Workbench(input);
  w.startTrace("draft", "answer", false);
  for (const id of ["send", "fail", "retry", "finish"]) w.take(id);
  assert.equal(w.saveTrace("Recovery").id, "retry");
  assert.equal(w.journeys.length, 100);
  w.startTrace("edits", "returned", false);
  for (const id of ["leave", "keep", "save", "return"]) w.take(id);
  assert.throws(() => w.saveTrace("New loop"), /Journey limit/);
  assert.deepEqual(w.trace!.steps, ["leave", "keep", "save", "return"]);
});
test("capturing outside exploration cannot mislabel a retained exploration path", () => {
  const w = make();
  w.setMode("exploration");
  w.take("send");
  w.setMode("journey");
  assert.throws(() => w.capture(), /Only exploration/);
  w.setMode("exploration");
  w.startTrace("edits", "returned");
  assert.throws(() => w.capture(), /Only exploration/);
  assert.deepEqual(w.exploration.steps, ["send"]);
});
