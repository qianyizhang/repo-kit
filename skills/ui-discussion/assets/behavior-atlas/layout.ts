import { type AtlasIR, type Point } from "./schema.ts";
export interface Layout {
  states: Map<string, Point>;
  regions: Map<string, { outline: Point[]; label: Point }>;
}
const round = (n: number): number => Math.round(n * 1000) / 1000;
export function layoutAtlas(ir: AtlasIR): Layout {
  const states = new Map<string, Point>(),
    regions = new Map<string, { outline: Point[]; label: Point }>();
  const degrees = new Map(ir.regions.map((r) => [r.id, 0])),
    stateRegion = new Map(ir.states.map((s) => [s.id, s.region]));
  for (const e of ir.transitions)
    if (stateRegion.get(e.from) !== stateRegion.get(e.to))
      for (const r of [stateRegion.get(e.from)!, stateRegion.get(e.to)!])
        degrees.set(r, degrees.get(r)! + 1);
  const ordered = [...ir.regions].sort(
    (a, b) =>
      degrees.get(b.id)! - degrees.get(a.id)! ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const largest = Math.max(
    ...ir.regions.map((r) => ir.states.filter((s) => s.region === r.id).length),
  );
  const spacing =
    Math.max(1000, Math.sqrt(largest) * 430) *
    (1 + Math.max(0, ordered.length - 5) / 5);
  for (const [regionIndex, region] of ordered.entries()) {
    const members = ir.states.filter((s) => s.region === region.id),
      count = members.length;
    if (!count) continue;
    const theta =
      ordered.length === 2
        ? -0.1
        : (2 * Math.PI * (regionIndex - 1)) / Math.max(1, ordered.length - 1) -
          Math.PI / 3;
    const center: Point =
      regionIndex === 0
        ? [0, 0]
        : [Math.cos(theta) * spacing, Math.sin(theta) * spacing];
    const local = members.map((s, i): Point =>
      ir.layout?.states[s.id]
        ? [...ir.layout.states[s.id]!]
        : [
            center[0] +
              Math.cos((i * 2 * Math.PI) / count) * Math.max(200, count * 28),
            center[1] +
              Math.sin((i * 2 * Math.PI) / count) * Math.max(180, count * 25),
          ],
    );
    const index = new Map(members.map((s, i) => [s.id, i]));
    const edges = ir.transitions.filter(
      (e) => index.has(e.from) && index.has(e.to) && e.from !== e.to,
    );
    // Bounded, synchronous layout. No random seed, clock, animation loop or DOM measurement.
    if (!members.every((s) => ir.layout?.states[s.id]))
      for (let pass = 0; pass < 120; pass++) {
        const forces = local.map(() => [0, 0] as Point);
        for (let i = 0; i < count; i++)
          for (let j = i + 1; j < count; j++) {
            const a = local[i]!,
              b = local[j]!,
              dx = a[0] - b[0],
              dy = a[1] - b[1],
              distance = Math.max(1, Math.hypot(dx, dy));
            const repel = Math.min(32, 22000 / (distance * distance));
            forces[i]![0] += (dx / distance) * repel;
            forces[i]![1] += (dy / distance) * repel;
            forces[j]![0] -= (dx / distance) * repel;
            forces[j]![1] -= (dy / distance) * repel;
          }
        for (const edge of edges) {
          const i = index.get(edge.from)!,
            j = index.get(edge.to)!,
            dx = local[j]![0] - local[i]![0],
            dy = local[j]![1] - local[i]![1],
            d = Math.max(1, Math.hypot(dx, dy)),
            f = (d - 220) * 0.015;
          forces[i]![0] += (dx / d) * f;
          forces[i]![1] += (dy / d) * f;
          forces[j]![0] -= (dx / d) * f;
          forces[j]![1] -= (dy / d) * f;
        }
        for (let i = 0; i < count; i++)
          if (!ir.layout?.states[members[i]!.id]) {
            local[i]![0] += forces[i]![0] + (center[0] - local[i]![0]) * 0.002;
            local[i]![1] += forces[i]![1] + (center[1] - local[i]![1]) * 0.002;
          }
      }
    for (let i = 0; i < count; i++)
      states.set(members[i]!.id, [round(local[i]![0]), round(local[i]![1])]);
    const minX = Math.min(...local.map((p) => p[0])) - 190,
      maxX = Math.max(...local.map((p) => p[0])) + 190,
      minY = Math.min(...local.map((p) => p[1])) - 150,
      maxY = Math.max(...local.map((p) => p[1])) + 190,
      w = maxX - minX,
      h = maxY - minY;
    regions.set(
      region.id,
      ir.layout?.regions[region.id] ?? {
        label: [minX + 40, minY - 20],
        outline: [
          [minX, minY + h * 0.25],
          [minX + w * 0.25, minY],
          [minX + w * 0.75, minY - 15],
          [maxX, minY + h * 0.3],
          [maxX + 25, minY + h * 0.7],
          [minX + w * 0.75, maxY],
          [minX + w * 0.25, maxY + 10],
          [minX - 25, minY + h * 0.7],
        ],
      },
    );
  }
  return { states, regions };
}
