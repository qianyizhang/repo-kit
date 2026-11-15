export type Point = [number, number];
export interface Region {
  id: string;
  label: string;
  plane: boolean;
}
export interface ScreenField {
  label: string;
  value: string;
}
export type ScreenBlock =
  | { kind: "text" | "heading"; text: string }
  | { kind: "fields"; fields: ScreenField[] }
  | {
      kind: "notice";
      tone: "neutral" | "success" | "warning" | "danger";
      text: string;
    }
  | { kind: "actions"; transitions: string[] };
export interface ScreenPreview {
  title: string;
  body: string;
  fields: ScreenField[];
  blocks: ScreenBlock[];
  overlay?: { title: string; body: string; blocks: ScreenBlock[] };
}
export interface StateNode {
  id: string;
  region: string;
  label: string;
  detail?: string;
  source?: string;
  secondary: boolean;
  terminal: boolean;
  outcome?: string;
  preview?: ScreenPreview;
}
export interface Transition {
  id: string;
  from: string;
  to: string;
  label: string;
  kind: "user" | "system" | "input";
  action?: string;
  guard?: string;
  source?: string;
  proposed?: boolean;
}
export interface Journey {
  id: string;
  label: string;
  description?: string;
  start: string;
  steps: string[];
}
export interface Comparison {
  id: string;
  label: string;
  before: string;
  after: string;
  detail?: string;
}
export interface AtlasIR {
  version: 1;
  title: string;
  initial: string;
  source: { revision: string; description: string };
  coverage: { included: string[]; omitted: string[] };
  regions: Region[];
  states: StateNode[];
  transitions: Transition[];
  journeys?: Journey[];
  comparisons?: Comparison[];
  layout?: {
    states: Record<string, Point>;
    regions: Record<string, { outline: Point[]; label: Point }>;
  };
}
export interface Frame {
  current: string;
  available: Transition[];
  route: Transition[];
  taken: Transition[];
  selected?: string;
  ended: boolean;
}
export interface ViewOptions {
  compact?: boolean;
  motion?: boolean;
  idPrefix?: string;
  passive?: boolean;
  names?: "all" | "nearby";
}
const fail = (at: string, why: string): never => {
  throw new Error(`${at}: ${why}`);
};
const record = (value: unknown, at: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail(at, "expected an object");
  return value as Record<string, unknown>;
};
const keys = (
  value: Record<string, unknown>,
  allowed: string[],
  at: string,
): void => {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) fail(`${at}.${key}`, "unknown field");
};
const text = (value: unknown, at: string, max = 240): string => {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    return fail(at, `expected nonempty text, at most ${max} characters`);
  return value;
};
const id = (value: unknown, at: string): string => {
  const result = text(value, at, 120);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(result))
    fail(at, "use letters, digits, dots, colons, underscores or hyphens");
  return result;
};
const optional = (value: unknown, at: string): string | undefined =>
  value === undefined ? undefined : text(value, at, 1200);
const bool = (value: unknown, at: string, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") return fail(at, "expected a boolean");
  return value;
};
const list = (value: unknown, at: string, max: number): unknown[] => {
  if (!Array.isArray(value) || value.length > max)
    return fail(at, `expected an array with at most ${max} entries`);
  return value;
};
export const compareId = (a: { id: string }, b: { id: string }): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
function unique<T extends { id: string }>(
  items: T[],
  at: string,
  sorted = true,
): T[] {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) fail(at, `duplicate id ${item.id}`);
    seen.add(item.id);
  }
  return sorted ? items.sort(compareId) : items;
}
function point(value: unknown, at: string): Point {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !value.every(
      (n) =>
        typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 100000,
    )
  )
    return fail(at, "expected two finite coordinates within ±100000");
  return [value[0] as number, value[1] as number];
}
function screenFields(value: unknown, at: string): ScreenField[] {
  return list(value ?? [], at, 12).map((entry, i) => {
    const loc = `${at}[${i}]`,
      f = record(entry, loc);
    keys(f, ["label", "value"], loc);
    return {
      label: text(f.label, `${loc}.label`),
      value: text(f.value, `${loc}.value`, 1200),
    };
  });
}
function screenBlocks(value: unknown, at: string): ScreenBlock[] {
  return list(value ?? [], at, 20).map((entry, i): ScreenBlock => {
    const loc = `${at}[${i}]`,
      b = record(entry, loc);
    if (b.kind === "text" || b.kind === "heading") {
      keys(b, ["kind", "text"], loc);
      return { kind: b.kind, text: text(b.text, `${loc}.text`, 4000) };
    }
    if (b.kind === "fields") {
      keys(b, ["kind", "fields"], loc);
      return { kind: b.kind, fields: screenFields(b.fields, `${loc}.fields`) };
    }
    if (b.kind === "notice") {
      keys(b, ["kind", "tone", "text"], loc);
      if (!["neutral", "success", "warning", "danger"].includes(String(b.tone)))
        fail(`${loc}.tone`, "unknown notice tone");
      return {
        kind: b.kind,
        tone: b.tone as "neutral" | "success" | "warning" | "danger",
        text: text(b.text, `${loc}.text`, 1200),
      };
    }
    if (b.kind === "actions") {
      keys(b, ["kind", "transitions"], loc);
      const transitions = list(b.transitions, `${loc}.transitions`, 30).map(
        (v, k) => id(v, `${loc}.transitions[${k}]`),
      );
      if (new Set(transitions).size !== transitions.length)
        fail(loc, "duplicate action placement");
      return { kind: b.kind, transitions };
    }
    return fail(
      `${loc}.kind`,
      "expected text, heading, fields, notice or actions",
    );
  });
}
function screenPreview(value: unknown, at: string): ScreenPreview {
  const p = record(value, at);
  keys(p, ["title", "body", "fields", "blocks", "overlay"], at);
  let overlay: ScreenPreview["overlay"];
  if (p.overlay !== undefined) {
    const o = record(p.overlay, `${at}.overlay`);
    keys(o, ["title", "body", "blocks"], `${at}.overlay`);
    overlay = {
      title: text(o.title, `${at}.overlay.title`),
      body:
        o.body === undefined || o.body === ""
          ? ""
          : text(o.body, `${at}.overlay.body`, 4000),
      blocks: screenBlocks(o.blocks, `${at}.overlay.blocks`),
    };
  }
  return {
    title: text(p.title, `${at}.title`),
    body:
      p.body === undefined || p.body === ""
        ? ""
        : text(p.body, `${at}.body`, 4000),
    fields: screenFields(p.fields, `${at}.fields`),
    blocks: screenBlocks(p.blocks, `${at}.blocks`),
    ...(overlay ? { overlay } : {}),
  };
}
function transition(
  value: unknown,
  at: string,
  states: Set<string>,
): Transition {
  const o = record(value, at);
  keys(
    o,
    [
      "id",
      "from",
      "to",
      "label",
      "kind",
      "action",
      "guard",
      "source",
      "proposed",
    ],
    at,
  );
  const from = id(o.from, `${at}.from`),
    to = id(o.to, `${at}.to`);
  if (!states.has(from) || !states.has(to))
    fail(at, `unknown endpoint ${!states.has(from) ? from : to}`);
  const kind = o.kind ?? "user";
  if (!["user", "system", "input"].includes(String(kind)))
    fail(`${at}.kind`, "expected user, system or input");
  return {
    id: id(o.id, `${at}.id`),
    from,
    to,
    label: text(o.label, `${at}.label`),
    kind: kind as Transition["kind"],
    action: o.action === undefined ? undefined : id(o.action, `${at}.action`),
    guard: optional(o.guard, `${at}.guard`),
    source: optional(o.source, `${at}.source`),
    ...(o.proposed === undefined
      ? {}
      : { proposed: bool(o.proposed, `${at}.proposed`, false) }),
  };
}
export function readIR(value: unknown): AtlasIR {
  const o = record(value, "atlas");
  keys(
    o,
    [
      "version",
      "title",
      "initial",
      "source",
      "coverage",
      "regions",
      "states",
      "transitions",
      "layout",
      "journeys",
      "comparisons",
    ],
    "atlas",
  );
  if (o.version !== 1) fail("atlas.version", "expected 1");
  const source = record(o.source, "atlas.source");
  keys(source, ["revision", "description"], "atlas.source");
  const coverage = record(o.coverage, "atlas.coverage");
  keys(coverage, ["included", "omitted"], "atlas.coverage");
  const regions = unique(
    list(o.regions, "atlas.regions", 24).map((r, i) => {
      const at = `atlas.regions[${i}]`,
        q = record(r, at);
      keys(q, ["id", "label", "plane"], at);
      return {
        id: id(q.id, `${at}.id`),
        label: text(q.label, `${at}.label`),
        plane: bool(q.plane, `${at}.plane`, true),
      };
    }),
    "atlas.regions",
  );
  if (!regions.length) fail("atlas.regions", "at least one region is required");
  const regionIds = new Set(regions.map((r) => r.id));
  const states = unique(
    list(o.states, "atlas.states", 240).map((s, i) => {
      const at = `atlas.states[${i}]`,
        q = record(s, at);
      keys(
        q,
        [
          "id",
          "label",
          "region",
          "detail",
          "source",
          "secondary",
          "terminal",
          "outcome",
          "preview",
        ],
        at,
      );
      const region = id(q.region, `${at}.region`);
      if (!regionIds.has(region)) fail(at, `unknown region ${region}`);
      const preview =
        q.preview === undefined
          ? undefined
          : screenPreview(q.preview, `${at}.preview`);
      return {
        id: id(q.id, `${at}.id`),
        region,
        label: text(q.label, `${at}.label`),
        detail: optional(q.detail, `${at}.detail`),
        source: optional(q.source, `${at}.source`),
        secondary: bool(q.secondary, `${at}.secondary`, false),
        terminal: bool(q.terminal, `${at}.terminal`, false),
        ...(q.outcome === undefined
          ? {}
          : { outcome: text(q.outcome, `${at}.outcome`) }),
        ...(preview ? { preview } : {}),
      };
    }),
    "atlas.states",
  );
  if (!states.length) fail("atlas.states", "at least one state is required");
  const stateIds = new Set(states.map((s) => s.id)),
    initial = id(o.initial, "atlas.initial");
  if (!stateIds.has(initial)) fail("atlas.initial", `unknown state ${initial}`);
  const transitions = unique(
    list(o.transitions, "atlas.transitions", 1200).map((e, i) =>
      transition(e, `atlas.transitions[${i}]`, stateIds),
    ),
    "atlas.transitions",
  );
  for (const e of transitions)
    if (states.find((s) => s.id === e.from)?.terminal)
      fail(
        `atlas.transitions.${e.id}`,
        "terminal states cannot have outgoing transitions; use explicit history rewind",
      );
  for (const state of states) {
    const places = [
      ...(state.preview?.blocks ?? []),
      ...(state.preview?.overlay?.blocks ?? []),
    ].flatMap((b) => (b.kind === "actions" ? b.transitions : []));
    if (new Set(places).size !== places.length)
      fail(
        `atlas.states.${state.id}.preview`,
        "each transition has one screen placement",
      );
    for (const edgeId of places) {
      const edge = transitions.find((e) => e.id === edgeId);
      if (!edge || edge.from !== state.id)
        fail(
          `atlas.states.${state.id}.preview`,
          `action ${edgeId} is not an outgoing transition`,
        );
    }
  }
  const journeys = unique(
    list(o.journeys ?? [], "atlas.journeys", 100).map((value, i): Journey => {
      const at = `atlas.journeys[${i}]`,
        j = record(value, at);
      keys(j, ["id", "label", "description", "start", "steps"], at);
      const start = id(j.start, `${at}.start`);
      if (!stateIds.has(start)) fail(`${at}.start`, "unknown state");
      let current = start;
      const steps = list(j.steps, `${at}.steps`, 1200).map((v, k) => {
        const edgeId = id(v, `${at}.steps[${k}]`),
          edge = transitions.find((e) => e.id === edgeId);
        if (!edge || edge.from !== current)
          fail(`${at}.steps[${k}]`, "unknown transition or broken continuity");
        current = edge!.to;
        return edgeId;
      });
      return {
        id: id(j.id, `${at}.id`),
        label: text(j.label, `${at}.label`),
        description: optional(j.description, `${at}.description`),
        start,
        steps,
      };
    }),
    "atlas.journeys",
    false,
  );
  const comparisons = unique(
    list(o.comparisons ?? [], "atlas.comparisons", 30).map(
      (value, i): Comparison => {
        const at = `atlas.comparisons[${i}]`,
          c = record(value, at);
        keys(c, ["id", "label", "before", "after", "detail"], at);
        const before = id(c.before, `${at}.before`),
          after = id(c.after, `${at}.after`);
        const a = journeys.find((j) => j.id === before),
          b = journeys.find((j) => j.id === after);
        const end = (j: Journey) =>
          transitions.find((e) => e.id === j.steps.at(-1))?.to ?? j.start;
        if (!a || !b || a === b || a.start !== b.start || end(a) !== end(b))
          fail(at, "comparison needs two journeys with shared start and end");
        return {
          id: id(c.id, `${at}.id`),
          label: text(c.label, `${at}.label`),
          before,
          after,
          detail: optional(c.detail, `${at}.detail`),
        };
      },
    ),
    "atlas.comparisons",
  );
  let layout: AtlasIR["layout"];
  if (o.layout !== undefined) {
    const q = record(o.layout, "atlas.layout");
    keys(q, ["states", "regions"], "atlas.layout");
    const nodes = record(q.states ?? {}, "atlas.layout.states"),
      planes = record(q.regions ?? {}, "atlas.layout.regions");
    layout = {
      states: Object.create(null) as Record<string, Point>,
      regions: Object.create(null) as NonNullable<AtlasIR["layout"]>["regions"],
    };
    for (const [key, p] of Object.entries(nodes)) {
      if (!stateIds.has(key))
        fail(`atlas.layout.states.${key}`, "unknown state");
      layout.states[key] = point(p, `atlas.layout.states.${key}`);
    }
    for (const [key, p] of Object.entries(planes)) {
      if (!regionIds.has(key))
        fail(`atlas.layout.regions.${key}`, "unknown region");
      const at = `atlas.layout.regions.${key}`,
        plane = record(p, at);
      keys(plane, ["outline", "label"], at);
      const outline = list(plane.outline, `${at}.outline`, 32).map((v, i) =>
        point(v, `${at}.outline[${i}]`),
      );
      if (outline.length < 3)
        fail(`${at}.outline`, "at least three points are required");
      layout.regions[key] = {
        outline,
        label: point(plane.label, `${at}.label`),
      };
    }
  }
  return {
    version: 1,
    title: text(o.title, "atlas.title"),
    initial,
    source: {
      revision: text(source.revision, "atlas.source.revision"),
      description: text(source.description, "atlas.source.description", 1200),
    },
    coverage: {
      included: list(coverage.included, "atlas.coverage.included", 100).map(
        (s, i) => text(s, `atlas.coverage.included[${i}]`, 1200),
      ),
      omitted: list(coverage.omitted, "atlas.coverage.omitted", 100).map(
        (s, i) => text(s, `atlas.coverage.omitted[${i}]`, 1200),
      ),
    },
    regions,
    states,
    transitions,
    ...(journeys.length ? { journeys } : {}),
    ...(comparisons.length ? { comparisons } : {}),
    ...(layout ? { layout } : {}),
  };
}
export function readFrame(ir: AtlasIR, value: unknown): Frame {
  const o = record(value, "frame");
  keys(
    o,
    ["current", "available", "route", "taken", "selected", "ended"],
    "frame",
  );
  const states = new Set(ir.states.map((s) => s.id)),
    current = id(o.current, "frame.current");
  if (!states.has(current)) fail("frame.current", `unknown state ${current}`);
  const selected =
    o.selected === undefined ? undefined : id(o.selected, "frame.selected");
  if (selected && !states.has(selected))
    fail("frame.selected", `unknown state ${selected}`);
  const edges = (name: string, max: number) =>
    list(o[name] ?? [], `frame.${name}`, max).map((e, i) =>
      transition(e, `frame.${name}[${i}]`, states),
    );
  const available = unique(edges("available", 1200), "frame.available"),
    route = edges("route", 1200),
    taken = edges("taken", 1200);
  for (const e of available)
    if (e.from !== current)
      fail("frame.available", `${e.id} does not leave the current state`);
  let from = current;
  for (const e of route) {
    if (e.from !== from) fail("frame.route", `${e.id} breaks route continuity`);
    from = e.to;
  }
  const first = route[0];
  if (first && !available.some((e) => e.id === first.id && e.to === first.to))
    fail("frame.route", "first step is not available from the current state");
  if (ir.states.find((s) => s.id === current)?.terminal && available.length)
    fail("frame.available", "terminal states cannot offer actions");
  const ended = bool(o.ended, "frame.ended", false);
  if (ended && (available.length || route.length))
    fail(
      "frame",
      "an ended journey cannot offer available actions or a remaining route",
    );
  return { current, available, route, taken, selected, ended };
}
export function standaloneFrame(
  ir: AtlasIR,
  current = ir.initial,
  taken: Transition[] = [],
): Frame {
  const terminal = ir.states.find((s) => s.id === current)?.terminal ?? false;
  return readFrame(ir, {
    current,
    available: terminal
      ? []
      : ir.transitions.filter(
          (e) => e.from === current && !e.guard && !e.proposed,
        ),
    route: [],
    taken,
    ended: terminal,
  });
}
export function findRoute(
  ir: AtlasIR,
  from: string,
  to: string,
): Transition[] | undefined {
  if (from === to) return [];
  const queue: Array<{ id: string; path: Transition[] }> = [
      { id: from, path: [] },
    ],
    seen = new Set([from]);
  for (let i = 0; i < queue.length; i++) {
    const entry = queue[i]!;
    for (const edge of ir.transitions.filter(
      (e) => e.from === entry.id && !e.guard && !e.proposed,
    )) {
      if (seen.has(edge.to)) continue;
      const path = [...entry.path, edge];
      if (edge.to === to) return path;
      seen.add(edge.to);
      queue.push({ id: edge.to, path });
    }
  }
  return undefined;
}
