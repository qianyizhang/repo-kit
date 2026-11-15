import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readIR } from "./schema.ts";
import { Workbench } from "./workbench.ts";
import { renderApp } from "./screen.ts";
import { compileAtlas } from "./renderer.ts";
const fixture = JSON.parse(
  readFileSync(new URL("./ez-example.json", import.meta.url), "utf8"),
);
test("screen blocks validate references, kinds and single placements; normalized data can be read again", () => {
  const ir = readIR(fixture);
  assert.deepEqual(readIR(ir), ir);
  const bad = structuredClone(fixture);
  bad.states[0].preview.blocks.push({
    kind: "actions",
    transitions: ["finish"],
  });
  assert.throws(() => readIR(bad), /not an outgoing transition/);
  bad.states[0].preview.blocks = [
    { kind: "html", html: "<script>alert(1)</script>" },
  ];
  assert.throws(() => readIR(bad), /expected text/);
  bad.states[0].preview.blocks = [
    { kind: "actions", transitions: ["send"] },
    { kind: "actions", transitions: ["send"] },
  ];
  assert.throws(() => readIR(bad), /one screen placement/);
});
test("app fixture placement obeys replay; overlays retain an inert background; passive previews never act", () => {
  const w = new Workbench(fixture),
    draft = w.ir.states.find((s) => s.id === "draft")!,
    region = w.ir.regions.find((r) => r.id === draft.region)!;
  const html = renderApp(draft, region, w.options());
  assert.match(html, /data-take="info"[^>]*>/);
  assert.match(html, /data-take="send"[^>]*disabled/);
  assert.doesNotMatch(html, /data-take="direct-config"/);
  w.take("info");
  const state = w.ir.states.find((s) => s.id === w.current())!;
  const overlay = renderApp(state, region, w.options());
  assert.match(overlay, /inert aria-hidden="true"/);
  assert.match(overlay, /role="dialog"/);
  assert.equal((overlay.match(/data-take="configure"/g) ?? []).length, 1);
  assert.doesNotMatch(
    renderApp(state, region, w.options(), true),
    /button|data-take|tabindex|role="dialog"/,
  );
  state.preview!.overlay!.title = "<script>unsafe</script>";
  assert.match(renderApp(state, region, w.options()), /&lt;script&gt;unsafe/);
});
test("entering exploration starts at the inspected replay point, then retains its own history", () => {
  const w = new Workbench(fixture);
  w.scrub(2);
  w.setMode("exploration");
  assert.equal(w.current(), "config");
  w.take("edit");
  w.setMode("journey");
  w.scrub(0);
  w.setMode("exploration");
  assert.equal(w.current(), "edits");
  w.restart();
  assert.equal(w.current(), "draft");
});
test("names and passive maps do not change the compiled geography; proposed actions stay isolated", () => {
  const w = new Workbench(fixture),
    atlas = compileAtlas(fixture);
  const a = atlas.render(w.frame(), {
    names: "all",
    idPrefix: "a",
  });
  const b = atlas.render(w.frame(), {
    names: "nearby",
    idPrefix: "b",
  });
  const points = (s: string) =>
    [
      ...s.matchAll(/data-node="([^"]+)" data-x="([^"]+)" data-y="([^"]+)"/g),
    ].map((m) => m.slice(1));
  assert.deepEqual(points(a), points(b));
  assert.equal(points(a).length, 16);
  assert.match(b, /data-names="nearby"/);
  assert.doesNotMatch(a, /data-atlas-action="direct-config"/);
  const mini = atlas.render(w.frame(), {
    compact: true,
    passive: true,
    idPrefix: "mini",
  });
  assert.deepEqual(points(a), points(mini));
  assert.match(mini, /landmark-code/);
  assert.doesNotMatch(mini, /tabindex|data-atlas-action|data-atlas-state/);
});
test("saved data cannot turn a proposal into a custom executable journey", () => {
  const w = new Workbench(fixture),
    saved = JSON.parse(w.exportSaved());
  saved.journeys = [
    {
      id: "tampered",
      label: "Shortcut",
      start: "draft",
      steps: ["direct-config"],
    },
  ];
  assert.throws(
    () => w.restoreSaved(JSON.stringify(saved)),
    /cannot authorize/,
  );
  assert.ok(!w.journeys.some((j) => j.id === "tampered"));
});

test("action blocks keep their declared order without duplicating unplaced actions", () => {
  const w = new Workbench(fixture);
  w.setMode("exploration");
  const state = w.ir.states.find((s) => s.id === "draft")!;
  state.preview!.blocks = [{ kind: "actions", transitions: ["send", "info"] }];
  const html = renderApp(
    state,
    w.ir.regions.find((r) => r.id === state.region)!,
    w.options(),
  );
  assert.deepEqual(
    [...html.matchAll(/data-take="([^"]+)"/g)].map((m) => m[1]),
    ["send", "info"],
  );
});
