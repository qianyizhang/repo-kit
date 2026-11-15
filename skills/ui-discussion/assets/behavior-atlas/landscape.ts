import type { AtlasIR, Frame, Point, ViewOptions } from "./schema.ts";
import type { Layout } from "./layout.ts";
export const escapeText = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
type LandscapeBox = { x: number; y: number; w: number; h: number };
const overlap = (a: LandscapeBox, b: LandscapeBox): boolean =>
  a.x < b.x + b.w + 6 &&
  a.x + a.w + 6 > b.x &&
  a.y < b.y + b.h + 5 &&
  a.y + a.h + 5 > b.y;
export function compileLandscape(ir: AtlasIR, layout: Layout) {
  const raw = [
    ...layout.states.values(),
    ...Array.from(layout.regions.values()).flatMap((r) => r.outline),
  ];
  const minX = Math.min(...raw.map((p) => p[0])),
    maxX = Math.max(...raw.map((p) => p[0])),
    minY = Math.min(...raw.map((p) => p[1])),
    maxY = Math.max(...raw.map((p) => p[1]));
  const factor = Math.max(
    ir.states.length > 30 ? 0.55 : 0,
    Math.min(
      920 / Math.max(1, maxX - minX),
      390 / Math.max(1, (maxY - minY) * 0.68),
    ),
  );
  const project = ([x, y]: Point): Point => [
    Math.round(
      (x - minX) * factor + 65 + (width - ((maxX - minX) * factor + 130)) / 2,
    ),
    Math.round((y - minY) * factor * 0.68 + 105),
  ];
  const width = Math.max(900, (maxX - minX) * factor + 130),
    height = (maxY - minY) * factor * 0.68 + 195;
  const points = new Map(
    Array.from(layout.states, ([id, p]) => [id, project(p)]),
  );
  const code = new Map<string, string>();
  const prefixes = new Set<string>();
  for (const region of ir.regions) {
    let prefix = region.label[0]!.toUpperCase();
    if (prefixes.has(prefix)) prefix += prefixes.size + 1;
    prefixes.add(prefix);
    ir.states
      .filter((s) => s.region === region.id)
      .forEach((s, i) => code.set(s.id, `${prefix}${i + 1}`));
  }
  const labels = new Map<string, { point: Point; lines: string[] }>();
  const boxes: LandscapeBox[] = Array.from(points.values(), ([x, y]) => ({
    x: x - 21,
    y: y - 24,
    w: 42,
    h: 48,
  }));
  for (const region of ir.regions) {
    const plane = layout.regions.get(region.id);
    if (!plane || !region.plane) continue;
    const [x, y] = project(plane.label);
    boxes.push({
      x: x - 5,
      y: y - 21,
      w: region.label.length * 11 + 10,
      h: 30,
    });
  }
  for (const state of ir.states) {
    const [x, y] = points.get(state.id)!;
    const words = state.label
        .split(/\s+/)
        .flatMap((word) => word.match(/.{1,20}/gu) ?? []),
      lines: string[] = [];
    for (const word of words) {
      if (!lines.length || lines.at(-1)!.length + word.length + 1 > 20) {
        if (lines.length === 3) {
          lines[2] = lines[2]!.slice(0, 19) + "…";
          break;
        }
        lines.push(word);
      } else lines[lines.length - 1] += ` ${word}`;
    }
    const w = Math.max(...lines.map((l) => l.length)) * 7.2,
      h = lines.length * 16;
    const candidates: Point[] = [
      [0, 39],
      [0, -34],
      [85, 5],
      [-85, 5],
      [0, 65],
      [0, -65],
      [110, 32],
      [-110, 32],
    ];
    let best: Point = [x, y + 39],
      score = Infinity;
    for (const [dx, dy] of candidates) {
      const p: Point = [
        Math.max(w / 2 + 5, Math.min(width - w / 2 - 5, x + dx)),
        Math.max(h + 5, Math.min(height - 12, y + dy)),
      ];
      const b = { x: p[0] - w / 2, y: p[1] - 12, w, h },
        cost =
          boxes.filter((o) => overlap(o, b)).length * 10000 +
          Math.abs(dx) +
          Math.abs(dy);
      if (cost < score) {
        score = cost;
        best = p;
      }
    }
    labels.set(state.id, { point: best, lines });
    boxes.push({ x: best[0] - w / 2, y: best[1] - 12, w, h });
  }
  const pairs = new Map<string, { a: string; b: string; ids: string[] }>();
  for (const edge of ir.transitions) {
    const ids = [edge.from, edge.to].sort(),
      key = ids.join("|");
    const group = pairs.get(key) ?? { a: ids[0]!, b: ids[1]!, ids: [] };
    group.ids.push(edge.id);
    pairs.set(key, group);
  }
  const routes = new Map<string, string>();
  for (const [key, pair] of pairs) {
    const a = points.get(pair.a)!,
      b = points.get(pair.b)!;
    if (pair.a === pair.b) {
      routes.set(
        key,
        `M${a[0] - 9},${a[1] - 8} C${a[0] - 56},${a[1] - 76} ${a[0] + 56},${a[1] - 76} ${a[0] + 9},${a[1] - 8}`,
      );
      continue;
    }
    const distance = Math.hypot(b[0] - a[0], b[1] - a[1]),
      cross =
        ir.states.find((s) => s.id === pair.a)!.region !==
        ir.states.find((s) => s.id === pair.b)!.region;
    const base = cross
      ? Math.min(150, 50 + distance * 0.18)
      : Math.min(90, 25 + distance * 0.15);
    let best: [Point, Point] = [
        [a[0], a[1] - base],
        [b[0], b[1] - base],
      ],
      cost = Infinity;
    for (const lift of [base, base + 55, base + 110, -base])
      for (const bow of [0, 70, -70, 145, -145]) {
        const c: Point = [a[0] + (b[0] - a[0]) * 0.28 + bow, a[1] - lift],
          d: Point = [b[0] - (b[0] - a[0]) * 0.28 + bow, b[1] - lift];
        let penalty = 0;
        for (let i = 1; i < 24; i++) {
          const t = i / 24,
            u = 1 - t,
            x =
              u * u * u * a[0] +
              3 * u * u * t * c[0] +
              3 * u * t * t * d[0] +
              t * t * t * b[0],
            y =
              u * u * u * a[1] +
              3 * u * u * t * c[1] +
              3 * u * t * t * d[1] +
              t * t * t * b[1];
          if (x < 15 || x > width - 15 || y < 18 || y > height - 15)
            penalty += 2000;
          for (const [id, p] of points)
            if (id !== pair.a && id !== pair.b) {
              const dist = Math.hypot(x - p[0], y - p[1]);
              if (dist < 23) penalty += (23 - dist) * 1000;
            }
        }
        const score = penalty + Math.abs(lift - base) + Math.abs(bow) * 0.35;
        if (score < cost) {
          best = [c, d];
          cost = score;
        }
        if (cost === 0) break;
      }
    const trim = (p: Point, c: Point): Point => {
      const d = Math.hypot(c[0] - p[0], c[1] - p[1]) || 1;
      return [p[0] + ((c[0] - p[0]) * 14) / d, p[1] + ((c[1] - p[1]) * 14) / d];
    };
    routes.set(
      key,
      `M${trim(a, best[0]).join(",")} C${best[0].join(",")} ${best[1].join(",")} ${trim(b, best[1]).join(",")}`,
    );
  }
  const outline = (source: Point[], offset = 0): string => {
    const p = source.map(project).map(([x, y]): Point => [x, y + offset]);
    const mid = (a: Point, b: Point): Point => [
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
    ];
    return `M${mid(p.at(-1)!, p[0]!).join(",")} ${p.map((q, i) => `Q${q.join(",")} ${mid(q, p[(i + 1) % p.length]!).join(",")}`).join(" ")} Z`;
  };
  return {
    points,
    code,
    routes,
    width,
    height,
    render(frame: Frame, options: ViewOptions): string {
      const prefix = options.idPrefix ?? "landscape",
        passive = options.passive ?? false,
        compact = options.compact ?? false;
      if (
        options.names !== undefined &&
        !["all", "nearby"].includes(options.names)
      )
        throw new Error("view.names: expected all or nearby");
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(prefix))
        throw new Error("view.idPrefix: invalid id");
      const current = ir.states.find((s) => s.id === frame.current)!,
        activeRegion = current.region;
      const active = new Set(frame.available.map((e) => e.id)),
        path = new Set([...frame.route, ...frame.taken].map((e) => e.id));
      const overrides = new Map(frame.available.map((edge) => [edge.id, edge]));
      const effective = ir.transitions.map(
        (edge) => overrides.get(edge.id) ?? edge,
      );
      for (const edge of frame.available)
        if (!effective.some((e) => e.id === edge.id)) effective.push(edge);
      const displayedPairs = new Map<
        string,
        { a: string; b: string; ids: string[] }
      >();
      for (const edge of effective) {
        if (edge.from === edge.to) continue; // Same-state events stay in the action list.
        const ids = [edge.from, edge.to].sort(),
          key = ids.join("|"),
          pair = displayedPairs.get(key) ?? { a: ids[0]!, b: ids[1]!, ids: [] };
        pair.ids.push(edge.id);
        displayedPairs.set(key, pair);
      }
      let svg = `<defs><marker id="${prefix}-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1L7 4L1 7" fill="none" stroke="context-stroke" stroke-width="1.4"/></marker></defs>`;
      for (const r of ir.regions) {
        const plane = layout.regions.get(r.id);
        if (!plane || !r.plane) continue;
        const p = project(plane.label);
        svg += `<g class="terrain ${r.id === activeRegion ? "active" : ""}" data-region="${r.id}"><path class="terrain-wall" d="${outline(plane.outline, 12)}"/><path class="terrain-top" d="${outline(plane.outline)}"/><text class="terrain-label" x="${p[0]}" y="${p[1]}">${escapeText(r.label)}</text></g>`;
      }
      for (const [key, pair] of displayedPairs) {
        const edges = effective.filter(
          (e) =>
            pair.ids.includes(e.id) &&
            (!e.proposed || path.has(e.id) || active.has(e.id)),
        );
        if (!edges.length) continue;
        const available = edges.filter((e) => active.has(e.id)),
          used = edges.some((e) => path.has(e.id)),
          arrows = available.length ? available : edges;
        const forward = arrows.some((e) => e.from === pair.a),
          backward = arrows.some((e) => e.from === pair.b),
          a = points.get(pair.a)!,
          b = points.get(pair.b)!,
          d =
            routes.get(key) ??
            `M${a.join(",")} Q${(a[0] + b[0]) / 2},${Math.min(a[1], b[1]) - 65} ${b.join(",")}`;
        svg += `<g class="landscape-edge ${available.length ? "available" : used ? "traveled" : "context"} ${available[0]?.from === pair.b ? "reverse" : ""} ${frame.selected === pair.a || frame.selected === pair.b ? "inspected" : ""}" data-from="${pair.a}" data-to="${pair.b}"><path class="hop-gap" d="${d}"/><path class="hop-stroke" d="${d}" ${forward ? `marker-end="url(#${prefix}-arrow)"` : ""} ${backward ? `marker-start="url(#${prefix}-arrow)"` : ""}/>${available.length ? `<path class="hop-flow" d="${d}"/>` : ""}</g>`;
      }
      for (const s of ir.states) {
        const [x, y] = points.get(s.id)!,
          isCurrent = s.id === frame.current,
          exits = frame.available.filter((e) => e.to === s.id);
        const action =
          !passive && exits.length === 1
            ? `data-atlas-action="${exits[0]!.id}"`
            : !passive
              ? `data-atlas-state="${s.id}"`
              : "";
        svg += `<g class="landscape-node ${isCurrent ? "current" : ""} ${exits.length ? "reachable" : ""} ${frame.selected === s.id ? "inspected" : ""}" data-node="${s.id}" data-x="${x}" data-y="${y}" ${action} ${passive ? "" : `role="button" tabindex="0" aria-label="${escapeText(s.label)}${isCurrent ? ", current state" : exits.length ? ", available next" : ", inspect only"}"`} ${isCurrent ? 'aria-current="location"' : ""}><title>${escapeText(s.label)}</title><ellipse class="marker-shadow" cx="${x}" cy="${y + 7}" rx="18" ry="7"/>${isCurrent ? `<circle class="location-halo" cx="${x}" cy="${y}" r="23"/>` : ""}<circle class="destination-ring" cx="${x}" cy="${y}" r="19"/><circle class="landmark-dot" cx="${x}" cy="${y}" r="13"/>${`<text class="landmark-code" x="${x}" y="${y + 3}" text-anchor="middle">${code.get(s.id)}</text>`}<circle class="landmark-hit" cx="${x}" cy="${y}" r="24"/>${s.terminal || s.outcome ? `<circle class="outcome-ring" cx="${x}" cy="${y}" r="17"/>` : ""}</g>`;
      }
      if (!compact)
        for (const s of ir.states) {
          const {
            point: [x, y],
            lines,
          } = labels.get(s.id)!;
          svg += `<text class="landmark-label ${s.id === frame.current || frame.available.some((e) => e.to === s.id) ? "needed" : ""} ${frame.selected === s.id ? "inspected" : ""}" data-label="${s.id}" x="${x}" y="${y}" text-anchor="middle">${lines.map((line, i) => `<tspan x="${x}" dy="${i ? 16 : 0}">${escapeText(line)}</tspan>`).join("")}</text>`;
        }
      if (!compact) {
        const [x, y] = points.get(frame.current)!;
        svg += `<text class="landscape-here" x="${x}" y="${y + (labels.get(frame.current)!.point[1] < y ? 31 : -29)}" text-anchor="middle">YOU ARE HERE</text>`;
      }
      return `<svg class="landscape ${compact ? "miniature" : ""}" data-names="${options.names ?? "all"}" style="--landscape-width:${ir.states.length > 30 ? Math.max(620, width) : 620}px" data-current="${frame.current}" data-current-region="${activeRegion}" data-motion="${options.motion === false ? "off" : "on"}" viewBox="0 0 ${width} ${height}" role="${passive ? "img" : "group"}" aria-label="${escapeText(ir.title)}; current: ${escapeText(current.label)}; ${ir.states.length} fixed states">${svg}</svg>`;
    },
  };
}
