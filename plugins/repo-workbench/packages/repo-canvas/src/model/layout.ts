import type { Module } from './document';
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
}
export const cardSize = { width: 240, height: 154 };
export function fitView(
  nodes: Pick<Module, 'x' | 'y'>[],
  width: number,
  height: number,
  zoomAt?: number,
) {
  if (!nodes.length || width <= 0 || height <= 0) return { x: 0, y: 0, zoom: 1 };
  const left = Math.min(...nodes.map((m) => m.x)),
    top = Math.min(...nodes.map((m) => m.y));
  const w = Math.max(...nodes.map((m) => m.x)) + cardSize.width - left;
  const h = Math.max(...nodes.map((m) => m.y)) + cardSize.height - top;
  const usableW = Math.max(1, width - 48),
    usableH = Math.max(1, height - 100);
  const zoom = zoomAt ?? Math.min(1.15, usableW / w, usableH / h);
  return {
    x: (width - w * zoom) / 2 - left * zoom,
    y: 24 + (usableH - h * zoom) / 2 - top * zoom,
    zoom,
  };
}
/** Choose columns from the actual drawing area, not the outer window. */
export function arrangeNodes(nodes: Module[], width: number, height: number): Module[] {
  let best: Module[] = [],
    score = -Infinity;
  for (let columns = 1; columns <= nodes.length; columns++) {
    const candidate = nodes.map((m, i) => ({
      ...m,
      x: (i % columns) * 320,
      y: Math.floor(i / columns) * 230,
    }));
    const { zoom } = fitView(candidate, width, height);
    // Prefer fuller rows when several arrangements reach the readable zoom ceiling.
    const value = zoom - (Math.ceil(nodes.length / columns) * columns - nodes.length) * 0.0001;
    if (value > score) {
      best = candidate;
      score = value;
    }
  }
  return best;
}

/** Join the nearest card faces so vertical flows do not loop through their cards. */
export function connectionPath(
  a: Pick<Module, 'x' | 'y'>,
  b: Pick<Module, 'x' | 'y'>,
  obstacles: Pick<Module, 'x' | 'y'>[] = [],
) {
  const vertical = Math.abs(b.y - a.y) > Math.abs(b.x - a.x);
  const forward = vertical ? b.y > a.y : b.x > a.x;
  if (vertical && Math.abs(a.x - b.x) < cardSize.width) {
    const low = Math.min(a.y, b.y) + cardSize.height,
      high = Math.max(a.y, b.y);
    const blockers = obstacles.filter(
      (n) =>
        n.y >= low &&
        n.y < high &&
        n.x < Math.max(a.x, b.x) + cardSize.width &&
        n.x + cardSize.width > Math.min(a.x, b.x),
    );
    if (blockers.length) {
      const side = Math.max(a.x, b.x, ...blockers.map((n) => n.x)) + cardSize.width + 32;
      const x1 = a.x + cardSize.width,
        x2 = b.x + cardSize.width,
        y1 = a.y + 66,
        y2 = b.y + 66;
      return { path: `M${x1},${y1} H${side} V${y2} H${x2}`, x: side, y: (y1 + y2) / 2 };
    }
  }
  const x1 = vertical ? a.x + cardSize.width / 2 : a.x + (forward ? cardSize.width : 0);
  const x2 = vertical ? b.x + cardSize.width / 2 : b.x + (forward ? 0 : cardSize.width);
  const y1 = vertical ? a.y + (forward ? cardSize.height : 0) : a.y + 66;
  const y2 = vertical ? b.y + (forward ? 0 : cardSize.height) : b.y + 66;
  const bend =
    (forward ? 1 : -1) * Math.min(65, Math.max(24, Math.abs(vertical ? y2 - y1 : x2 - x1) / 2));
  return {
    path: vertical
      ? `M${x1},${y1} C${x1},${y1 + bend} ${x2},${y2 - bend} ${x2},${y2}`
      : `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`,
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2 - 9,
  };
}

export interface LabelPosition {
  x: number;
  y: number;
  width: number;
  text: string;
}
/** Conservative text bounds; never place a label on a card or another label. */
export function placeLabels(
  labels: { id: string; text: string; x: number; y: number }[],
  nodes: Pick<Module, 'x' | 'y'>[],
) {
  const occupied = nodes.map((n) => ({
    x: n.x - 10,
    y: n.y - 10,
    width: cardSize.width + 20,
    height: cardSize.height + 20,
  }));
  const bounds = nodes.length
    ? {
        left: Math.min(...nodes.map((n) => n.x)) - 8,
        right: Math.max(...nodes.map((n) => n.x)) + cardSize.width + 8,
        top: Math.min(...nodes.map((n) => n.y)) - 8,
        bottom: Math.max(...nodes.map((n) => n.y)) + cardSize.height + 8,
      }
    : null;
  const result = new Map<string, LabelPosition>();
  for (const label of labels) {
    const text = label.text;
    const width = Math.min(240, text.length * 8 + 18),
      height = 28;
    for (const [dx, dy] of [
      [0, 0],
      [0, -32],
      [0, 32],
      [0, -64],
      [0, 64],
      [-80, 0],
      [80, 0],
      [0, -96],
      [0, 96],
    ]) {
      const x = label.x + dx,
        y = label.y + dy;
      const box = { x: x - width / 2, y: y - 18, width, height };
      if (
        bounds &&
        (box.x < bounds.left ||
          box.x + width > bounds.right ||
          box.y < bounds.top ||
          box.y + height > bounds.bottom)
      )
        continue;
      if (
        occupied.some(
          (o) =>
            box.x < o.x + o.width &&
            box.x + box.width > o.x &&
            box.y < o.y + o.height &&
            box.y + box.height > o.y,
        )
      )
        continue;
      occupied.push(box);
      result.set(label.id, { x, y, width, text });
      break;
    }
  }
  return result;
}
