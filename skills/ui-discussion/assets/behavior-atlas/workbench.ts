import {
  readIR,
  findRoute,
  type AtlasIR,
  type Journey,
  type Frame,
  type Transition,
} from "./schema.ts";

export type Operation = "journey" | "exploration" | "comparison";
export type MajorView = "app" | "map";
export interface Trace {
  start: string;
  end: string;
  steps: string[];
}
export function visitsFor(ir: AtlasIR, journey: Journey): string[] {
  return [
    journey.start,
    ...journey.steps.map((id) => ir.transitions.find((e) => e.id === id)!.to),
  ];
}
/** Align visits, not unique state IDs: repeated visits remain separate scrub points. */
export function alignVisits(
  a: string[],
  b: string[],
): Array<{ a?: number; b?: number }> {
  const table = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i]![j] =
        a[i] === b[j]
          ? 1 + table[i + 1]![j + 1]!
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
  const columns: Array<{ a?: number; b?: number }> = [];
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j])
      columns.push({ a: i++, b: j++ });
    else if (
      i < a.length &&
      (j === b.length || table[i + 1]![j]! >= table[i]![j + 1]!)
    )
      columns.push({ a: i++ });
    else columns.push({ b: j++ });
  }
  return columns;
}
export class Workbench {
  readonly ir: AtlasIR;
  readonly journeys: Journey[];
  readonly authored: Set<string>;
  mode: Operation;
  view: MajorView = "app";
  journeyId: string;
  cursor = 0;
  exploration: Journey;
  paused = false;
  comparisonId: string | undefined;
  comparisonCursors: [number, number] = [0, 0];
  trace: Trace | null = null;
  private sequence = 0;
  private explored = false;
  constructor(value: unknown) {
    this.ir = readIR(value);
    this.journeys = structuredClone(this.ir.journeys ?? []);
    if (!this.journeys.length) {
      for (const target of this.ir.states
        .filter((s) => s.outcome || s.terminal)
        .slice(0, 12)) {
        const route = findRoute(this.ir, this.ir.initial, target.id);
        if (route?.length)
          this.journeys.push({
            id: `route-${target.id}`,
            label: target.outcome ?? target.label,
            start: this.ir.initial,
            steps: route.map((e) => e.id),
          });
      }
    }
    this.authored = new Set(this.journeys.map((j) => j.id));
    this.journeyId =
      this.journeys.find(
        (j) => !this.ir.comparisons?.some((c) => c.after === j.id),
      )?.id ??
      this.journeys[0]?.id ??
      "";
    this.mode = this.journeys.length ? "journey" : "exploration";
    this.exploration = {
      id: "exploring",
      label: "Exploration",
      start: this.ir.initial,
      steps: [],
    };
    this.comparisonId = this.ir.comparisons?.[0]?.id;
  }
  edge(id: string): Transition {
    const edge = this.ir.transitions.find((e) => e.id === id);
    if (!edge) throw new Error(`Unknown transition: ${id}`);
    return edge;
  }
  journey(id = this.journeyId): Journey {
    const j = this.journeys.find((j) => j.id === id);
    if (!j) throw new Error(`Unknown journey: ${id}`);
    return j;
  }
  comparison() {
    const c = this.ir.comparisons?.find((c) => c.id === this.comparisonId);
    if (!c) throw new Error("No comparison proposal");
    return c;
  }
  replay(side?: 0 | 1): { journey: Journey; cursor: number } {
    if (this.mode === "comparison") {
      const c = this.comparison();
      return {
        journey: this.journey(side === 1 ? c.after : c.before),
        cursor: this.comparisonCursors[side ?? 0],
      };
    }
    return { journey: this.journey(), cursor: this.cursor };
  }
  current(side?: 0 | 1): string {
    if (this.trace)
      return this.trace.steps.length
        ? this.edge(this.trace.steps.at(-1)!).to
        : this.trace.start;
    if (this.mode === "exploration")
      return this.exploration.steps.length
        ? this.edge(this.exploration.steps.at(-1)!).to
        : this.exploration.start;
    const { journey, cursor } = this.replay(side);
    return visitsFor(this.ir, journey)[cursor]!;
  }
  options(side?: 0 | 1): Array<{
    edge: Transition;
    enabled: boolean;
    reason: string;
    destination: string;
  }> {
    const current = this.current(side),
      replay =
        !this.trace && this.mode !== "exploration"
          ? this.replay(side)
          : undefined;
    const next = replay?.journey.steps[replay.cursor];
    return this.ir.transitions
      .filter((e) => e.from === current && (!e.proposed || e.id === next))
      .map((edge) => {
        const reason = edge.guard
          ? `${edge.guard} · condition not evaluated`
          : replay && edge.id !== next
            ? "Outside this replay"
            : this.mode === "exploration" && this.paused && !this.trace
              ? "Outcome reached; continue explicitly"
              : "";
        return {
          edge,
          enabled: !reason,
          reason,
          destination: this.ir.states.find((s) => s.id === edge.to)!.label,
        };
      });
  }
  frame(side?: 0 | 1): Frame {
    const current = this.current(side),
      available = this.options(side)
        .filter((o) => o.enabled)
        .map((o) => o.edge);
    let route: Transition[] = [],
      taken: Transition[] = [];
    if (this.trace) taken = this.trace.steps.map((id) => this.edge(id));
    else if (this.mode === "exploration")
      taken = this.exploration.steps.map((id) => this.edge(id));
    else {
      const replay = this.replay(side);
      taken = replay.journey.steps
        .slice(0, replay.cursor)
        .map((id) => this.edge(id));
      if (available.some((e) => e.id === replay.journey.steps[replay.cursor]))
        route = replay.journey.steps
          .slice(replay.cursor)
          .map((id) => this.edge(id));
    }
    return {
      current,
      available,
      route,
      taken,
      ended: this.trace
        ? !!this.ir.states.find((s) => s.id === current)?.terminal
        : this.mode === "exploration"
          ? this.paused ||
            !!this.ir.states.find((s) => s.id === current)?.terminal
          : this.replay(side).cursor === this.replay(side).journey.steps.length,
    };
  }
  setMode(mode: Operation): void {
    if (mode === "comparison") this.comparison();
    if (mode === "journey") this.journey();
    if (mode === "exploration" && !this.explored) {
      this.exploration.start = this.current();
      this.explored = true;
    }
    this.mode = mode;
    this.trace = null;
  }
  selectJourney(id: string): void {
    this.journey(id);
    this.journeyId = id;
    this.cursor = 0;
    this.mode = "journey";
    this.trace = null;
  }
  scrub(index: number, side?: 0 | 1): void {
    if (this.trace || this.mode === "exploration")
      throw new Error("Scrubbing is for recorded journeys");
    const { journey } = this.replay(side);
    if (!Number.isInteger(index) || index < 0 || index > journey.steps.length)
      throw new Error("Invalid replay point");
    if (this.mode === "comparison") this.comparisonCursors[side ?? 0] = index;
    else this.cursor = index;
  }
  take(id: string, side?: 0 | 1): void {
    if (!this.options(side).some((o) => o.edge.id === id && o.enabled))
      throw new Error("This transition is not available here");
    if (this.trace) {
      if (this.trace.steps.length >= 1200)
        throw new Error("Route limit reached");
      this.trace.steps.push(id);
      return;
    }
    if (this.mode === "exploration") {
      if (this.exploration.steps.length >= 1200)
        throw new Error(
          "Route limit reached; review or restart this exploration",
        );
      this.exploration.steps.push(id);
      const state = this.ir.states.find((s) => s.id === this.current())!;
      this.paused = !!state.outcome || state.terminal;
    } else this.scrub(this.replay(side).cursor + 1, side);
  }
  back(): void {
    if (this.trace) this.trace.steps.pop();
    else if (this.mode === "exploration") {
      this.exploration.steps.pop();
      this.paused = false;
    } else if (this.mode === "journey" && this.cursor) this.cursor--;
  }
  continueExploration(): void {
    if (this.ir.states.find((s) => s.id === this.current())?.terminal)
      throw new Error("This is a terminal state; rewind or restart");
    this.paused = false;
  }
  restart(): void {
    this.exploration.start = this.ir.initial;
    this.explored = true;
    this.exploration.steps = [];
    this.paused = false;
  }
  private storeJourney(label: string, start: string, steps: string[]): Journey {
    const duplicate = this.journeys.find(
      (j) =>
        j.start === start && JSON.stringify(j.steps) === JSON.stringify(steps),
    );
    if (duplicate) {
      this.selectJourney(duplicate.id);
      return duplicate;
    }
    if (this.journeys.length >= 100)
      throw new Error(
        "Journey limit reached; export this review before starting another model",
      );
    let id: string;
    do {
      id = `recorded-${++this.sequence}`;
    } while (this.journeys.some((j) => j.id === id));
    const journey = {
      id,
      label: label.trim() || "Recorded journey",
      start,
      steps: [...steps],
    };
    // Reuse boundary validation even for programmatically created records.
    readIR({ ...this.ir, journeys: [...(this.ir.journeys ?? []), journey] });
    this.journeys.push(journey);
    this.selectJourney(id);
    return journey;
  }
  capture(): Journey {
    if (this.mode !== "exploration" || this.trace)
      throw new Error(
        "Only exploration can be captured; save a trace separately",
      );
    if (!this.exploration.steps.length)
      throw new Error("Take an action before recording a journey");
    const state = this.ir.states.find((s) => s.id === this.current())!;
    return this.storeJourney(
      state.outcome ?? `Explore to ${state.label}`,
      this.exploration.start,
      this.exploration.steps,
    );
  }
  startTrace(start: string, end: string, suggest = true): void {
    if (
      !this.ir.states.some((s) => s.id === start) ||
      !this.ir.states.some((s) => s.id === end)
    )
      throw new Error("Unknown route endpoint");
    const route = suggest ? findRoute(this.ir, start, end) : [];
    if (!route)
      throw new Error(
        "No unguarded route found; choose other endpoints or trace manually",
      );
    this.trace = { start, end, steps: route.map((e) => e.id) };
  }
  saveTrace(label: string): Journey {
    if (
      !this.trace ||
      this.current() !== this.trace.end ||
      !this.trace.steps.length
    )
      throw new Error("Trace must reach its destination before saving");
    return this.storeJourney(label, this.trace.start, this.trace.steps);
  }
  review(journey = this.journey()): string {
    return [
      `Review this ${this.ir.title} journey and propose a clearer route with the same start and outcome.`,
      `Source: ${this.ir.source.revision} — ${this.ir.source.description}`,
      "This is a model replay, not live application evidence. Preserve guards, retained work, recovery and system events.",
      ...visitsFor(this.ir, journey).map(
        (id, i) =>
          `${i + 1}. ${this.ir.states.find((s) => s.id === id)!.label}${i ? ` — ${this.edge(journey.steps[i - 1]!).label} [${this.edge(journey.steps[i - 1]!).kind}]` : " [start]"}`,
      ),
      "Return an explicit proposed journey and explain which friction it removes; keep repeated visits in the original.",
      JSON.stringify(
        {
          source: this.ir.source,
          coverage: this.ir.coverage,
          journey,
          states: [...new Set(visitsFor(this.ir, journey))].map((id) =>
            this.ir.states.find((s) => s.id === id),
          ),
          transitions: journey.steps.map((id) => this.edge(id)),
        },
        null,
        2,
      ),
    ].join("\n");
  }
  private fingerprint(): string {
    return JSON.stringify([
      this.ir.source,
      this.ir.states,
      this.ir.transitions,
    ]);
  }
  exportSaved(): string {
    return JSON.stringify({
      version: 1,
      model: this.fingerprint(),
      journeys: this.journeys.filter((j) => !this.authored.has(j.id)),
    });
  }
  restoreSaved(value: string): void {
    const data: unknown = JSON.parse(value);
    if (
      !data ||
      typeof data !== "object" ||
      !("model" in data) ||
      data.model !== this.fingerprint() ||
      !("version" in data) ||
      data.version !== 1 ||
      !("journeys" in data) ||
      !Array.isArray(data.journeys)
    )
      throw new Error("Saved journeys belong to a different model");
    const validated = readIR({
      ...this.ir,
      journeys: [...this.journeys, ...data.journeys],
    });
    for (const journey of validated.journeys!.slice(this.journeys.length))
      if (
        journey.steps.some(
          (id) => this.edge(id).guard || this.edge(id).proposed,
        )
      )
        throw new Error(
          "Saved custom journeys cannot authorize guards or proposed transitions",
        );
    this.journeys.splice(0, this.journeys.length, ...validated.journeys!);
  }
}
