import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
  mkdtemp,
  writeFile,
  symlink,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readIR,
  readFrame,
  standaloneFrame,
  findRoute,
  type Transition,
  type ViewOptions,
} from "./schema.ts";
import { compileAtlas } from "./renderer.ts";
import { renderActions } from "./screen.ts";
import { buildPage, writeOutput, writeRuntime } from "./build.ts";
const fixture = JSON.parse(
  await readFile(new URL("./example.json", import.meta.url), "utf8"),
) as Record<string, unknown>;
const data = () => structuredClone(fixture);
const groups = (svg: string) =>
  [...svg.matchAll(/<g class="landscape-edge[^]*?<\/g>/g)].map((m) => m[0]);
test("normalizes and rejects version, duplicate IDs, dangling edges and unknown fields", () => {
  assert.equal(readIR(data()).version, 1);
  for (const [change, message] of [
    [
      (o: Record<string, unknown>) => {
        o.version = 2;
      },
      /version/,
    ],
    [
      (o: Record<string, unknown>) => {
        (o.states as unknown[]).push((o.states as unknown[])[0]);
      },
      /duplicate id/,
    ],
    [
      (o: Record<string, unknown>) => {
        (o.transitions as Array<Record<string, unknown>>)[0]!.to = "missing";
      },
      /unknown endpoint/,
    ],
    [
      (o: Record<string, unknown>) => {
        o.coords = "typo";
      },
      /unknown field/,
    ],
    [
      (o: Record<string, unknown>) => {
        o.initial = "missing";
      },
      /unknown state/,
    ],
  ] as const) {
    const input = data();
    change(input);
    assert.throws(() => readIR(input), message);
  }
});
test("rejects malformed geometry and a terminal state with outgoing work", () => {
  const input = data();
  input.layout = { states: { draft: [NaN, 0] }, regions: {} };
  assert.throws(() => readIR(input), /finite coordinates/);
  input.layout = {
    states: {},
    regions: { writing: { outline: [[1, 2]], label: [0, 0] } },
  };
  assert.throws(() => readIR(input), /three points/);
  delete input.layout;
  (input.states as Array<Record<string, unknown>>)[0]!.terminal = true;
  assert.throws(() => readIR(input), /terminal states/);
});
test("layout and rendering are deterministic after input array permutation", () => {
  const a = compileAtlas(data()),
    input = data();
  for (const key of ["states", "regions", "transitions"])
    (input[key] as unknown[]).reverse();
  const b = compileAtlas(input);
  assert.deepEqual(a.layout, b.layout);
  assert.equal(
    a.render(standaloneFrame(a.ir)),
    b.render(standaloneFrame(b.ir)),
  );
  for (const point of a.layout.states.values())
    assert.ok(point.every(Number.isFinite));
  assert.equal(
    new Set([...a.layout.states.values()].map((p) => p.join(","))).size,
    a.ir.states.length,
  );
});
test("explicit layout hints survive rendering and input mutation does not alter compiled data", () => {
  const input = data();
  input.layout = { states: { draft: [25, 35] }, regions: {} };
  const atlas = compileAtlas(input);
  assert.deepEqual(atlas.layout.states.get("draft"), [25, 35]);
  (input.states as Array<Record<string, unknown>>)[0]!.label = "Mutated";
  assert.notEqual(
    atlas.ir.states.find((s) => s.id === "draft")!.label,
    "Mutated",
  );
});
test("reserved JavaScript property names are ordinary IDs, not implicit coordinates", () => {
  const input = data();
  (input.states as Array<Record<string, unknown>>)[0]!.id = "constructor";
  input.initial = "constructor";
  for (const j of input.journeys as Array<Record<string, unknown>>)
    if (j.start === "draft") j.start = "constructor";
  for (const e of input.transitions as Array<Record<string, unknown>>) {
    if (e.from === "draft") e.from = "constructor";
    if (e.to === "draft") e.to = "constructor";
  }
  input.layout = { states: {}, regions: {} };
  assert.ok(
    compileAtlas(input)
      .layout.states.get("constructor")!
      .every(Number.isFinite),
  );
});
test("standalone simulation never evaluates textual guards", () => {
  const ir = readIR(data());
  assert.ok(
    !standaloneFrame(ir, "reviewing").available.some((e) => e.id === "publish"),
  );
  assert.equal(findRoute(ir, "draft", "published"), undefined);
  assert.deepEqual(
    findRoute(ir, "draft", "approved")!.map((e) => e.id),
    ["prepare", "submit", "approve"],
  );
  assert.equal(standaloneFrame(ir, "approved").ended, true);
  assert.deepEqual(standaloneFrame(ir, "approved").available, []);
});
test("inspection and taken paths keep the full topology stable and the current plane active", () => {
  const atlas = compileAtlas(data()),
    frame = standaloneFrame(atlas.ir);
  const before = atlas.render(frame);
  const after = atlas.render({
    ...frame,
    selected: "published",
    taken: [atlas.ir.transitions.find((e) => e.id === "submit")!],
  });
  const points = (svg: string) =>
    [...svg.matchAll(/data-node="[^"]+" data-x="[^"]+" data-y="[^"]+"/g)].map(
      (m) => m[0],
    );
  assert.equal(points(before).length, atlas.ir.states.length);
  assert.deepEqual(points(before), points(after));
  assert.match(after, /terrain active" data-region="writing"/);
  assert.match(after, /landscape-node [^"]*inspected" data-node="published"/);
  assert.match(after, /data-current="draft"/);
  assert.equal(groups(before).length, groups(after).length);
  const immediate = groups(after).filter((g) => g.includes("hop-flow"));
  assert.equal(immediate.length, 1);
  assert.match(immediate[0]!, /data-from="draft" data-to="ready"/);
});
test("same-state and parallel events remain in the action list without duplicate spatial paths", () => {
  const atlas = compileAtlas(data()),
    frame = standaloneFrame(atlas.ir);
  frame.available.push({
    id: "progress",
    from: "draft",
    to: "draft",
    label: "Progress arrives",
    kind: "system",
  });
  frame.available.push({
    ...frame.available[0]!,
    id: "another-prepare",
    label: "Prepare another way",
  });
  const paths = groups(atlas.render(frame));
  assert.equal(
    paths.filter((g) => g.includes('data-from="draft" data-to="ready"')).length,
    1,
  );
  assert.ok(
    !paths.some((g) => g.includes('data-from="draft" data-to="draft"')),
  );
  const actions = renderActions(
    frame.available.map((edge) => ({
      edge,
      enabled: true,
      reason: "",
      destination: edge.to,
    })),
  );
  assert.match(actions, /data-take="progress"/);
  assert.match(actions, /data-take="another-prepare"/);
});
test("stale snapshots, unknown endpoints, discontinuous routes and unavailable first steps fail", () => {
  const ir = readIR(data()),
    frame = standaloneFrame(ir);
  const edge = frame.available[0]!;
  assert.throws(
    () => readFrame(ir, { ...frame, current: "reviewing" }),
    /does not leave/,
  );
  assert.throws(
    () => readFrame(ir, { ...frame, current: "missing" }),
    /unknown state/,
  );
  assert.throws(
    () => readFrame(ir, { ...frame, route: [{ ...edge, from: "ready" }] }),
    /continuity/,
  );
  assert.throws(
    () => readFrame(ir, { ...frame, available: [], route: [edge] }),
    /not available/,
  );
  assert.throws(
    () => readFrame(ir, { ...frame, available: [{ ...edge, to: "missing" }] }),
    /unknown endpoint/,
  );
  assert.throws(
    () => readFrame(ir, { ...frame, ended: true }),
    /ended journey/,
  );
});
test("runtime-resolved direct edges replace abstract edges without duplicate contradictory targets", () => {
  const atlas = compileAtlas(data()),
    frame = standaloneFrame(atlas.ir, "ready"),
    original = frame.available.find((e) => e.id === "submit")!;
  const resolved: Transition = { ...original, to: "changes" };
  frame.available = frame.available.map((e) =>
    e.id === resolved.id ? resolved : e,
  );
  const paths = groups(atlas.render(frame));
  assert.equal(
    paths.filter((g) => g.includes('data-from="changes" data-to="ready"'))
      .length,
    1,
  );
  assert.ok(
    !paths.some((g) => g.includes('data-from="ready" data-to="reviewing"')),
  );
});
test("escaping protects SVG labels, titles and the embedded JSON script boundary", async () => {
  const input = data(),
    bad = "</script><script>window.injected=true</script>";
  input.title = bad;
  (input.states as Array<Record<string, unknown>>)[0]!.label = bad;
  const atlas = compileAtlas(input),
    svg = atlas.render(standaloneFrame(atlas.ir));
  assert.ok(!svg.includes(bad));
  assert.match(svg, /&lt;\/script&gt;/);
  const page = await buildPage(input);
  assert.ok(!page.includes(bad));
  assert.match(page, /\\u003c\/script>/);
  assert.equal(page, await buildPage(input));
  assert.ok(!page.includes("from './schema.ts'"));
});
test("motion can stop while the current state and direct-edge cues remain present", () => {
  const atlas = compileAtlas(data()),
    svg = atlas.render(standaloneFrame(atlas.ir), { motion: false });
  assert.match(svg, /data-motion="off"/);
  assert.match(svg, /YOU ARE HERE/);
  assert.match(svg, /location-halo/);
  assert.match(svg, /landscape-edge available/);
});
test("output refuses existing files and symlink parents; explicit replacement succeeds", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-output-"));
  try {
    const out = join(root, "page.html");
    await writeOutput(out, "first");
    await assert.rejects(writeOutput(out, "second"), /Output exists/);
    assert.equal(await readFile(out, "utf8"), "first");
    await writeOutput(out, "second", true);
    assert.equal(await readFile(out, "utf8"), "second");
    await symlink(root, join(root, "alias"));
    await assert.rejects(
      writeOutput(join(root, "alias", "other.html"), "x"),
      /symlink/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("runtime generation preflights all destinations before replacing any file", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-runtime-"));
  try {
    await writeFile(join(root, "renderer.js"), "existing");
    await assert.rejects(writeRuntime(root), /exists/);
    assert.deepEqual(await readdir(root), ["renderer.js"]);
    await writeRuntime(root, true);
    const files = await readdir(root);
    assert.ok(files.includes("schema.ts"));
    assert.match(
      await readFile(join(root, "renderer.js"), "utf8"),
      /from "\.\/schema.js"/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI rejects invalid IR before emitting any runtime files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-invalid-"));
  try {
    const input = join(directory, "bad.json"),
      out = join(directory, "runtime");
    await writeFile(input, JSON.stringify({ version: 1 }));
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL("./build.ts", import.meta.url)),
        "--input",
        input,
        "--check",
        "--runtime-out",
        out,
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /expected an object/);
    assert.deepEqual(await readdir(directory), ["bad.json"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("frame availability supports the same transition bound as IR", () => {
  const ir = readIR(data()),
    frame = standaloneFrame(ir);
  frame.available = Array.from({ length: 241 }, (_, i) => ({
    ...frame.available[0]!,
    id: `action-${i}`,
  }));
  assert.equal(readFrame(ir, frame).available.length, 241);
});
test("invalid map options fail before producing markup", () => {
  const atlas = compileAtlas(data()),
    frame = standaloneFrame(atlas.ir);
  assert.throws(
    () =>
      atlas.render(frame, { names: '" onload="bad' } as unknown as ViewOptions),
    /view.names/,
  );
  assert.throws(
    () => atlas.render(frame, { idPrefix: '" onload="bad' }),
    /view.idPrefix/,
  );
});
