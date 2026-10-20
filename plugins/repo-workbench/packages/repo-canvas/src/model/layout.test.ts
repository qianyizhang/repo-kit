import { expect, it } from 'vitest';
import { arrangeNodes, cardSize, fitView, connectionPath, placeLabels } from './layout';
import type { Module } from './document';
const nodes: Module[] = Array.from({ length: 6 }, (_, i) => ({
  id: String(i),
  parent: 'repo',
  name: String(i),
  kind: 'module',
  summary: '',
  sources: [],
  x: (i % 3) * 300 - 200,
  y: Math.floor(i / 3) * 190 - 100,
}));
it('centers all content inside a narrow tall viewport with space for controls', () => {
  const view = fitView(nodes, 380, 800);
  const xs = nodes.map((n) => n.x * view.zoom + view.x);
  expect(Math.min(...xs)).toBeCloseTo(24);
  expect(Math.max(...xs) + cardSize.width * view.zoom).toBeCloseTo(356);
  expect(Math.min(...nodes.map((n) => n.y * view.zoom + view.y))).toBeGreaterThan(24);
  expect(Math.max(...nodes.map((n) => (n.y + cardSize.height) * view.zoom + view.y))).toBeLessThan(
    724,
  );
});
it('arranges for available aspect ratio without mutating authored coordinates', () => {
  const before = structuredClone(nodes);
  const narrow = arrangeNodes(nodes, 350, 1500);
  const wide = arrangeNodes(nodes, 1600, 400);
  expect(new Set(narrow.map((n) => n.x)).size).toBe(1);
  expect(new Set(wide.map((n) => n.x)).size).toBeGreaterThan(1);
  expect(fitView(narrow, 350, 1500).zoom).toBeGreaterThan(fitView(nodes, 350, 1500).zoom);
  expect(nodes).toEqual(before);
});
it('fits a selection independently and stays finite for empty or hidden scopes', () => {
  expect(fitView([nodes[0]], 500, 500).zoom).toBe(1.15);
  expect(fitView([], 0, 0)).toEqual({ x: 0, y: 0, zoom: 1 });
});

it('routes a long vertical relationship around an intervening card', () => {
  const a = { x: 360, y: 0 },
    b = { x: 360, y: 460 };
  const path = connectionPath(a, b, [a, { x: 360, y: 230 }, b]);
  expect(path.path).toContain('H632');
  expect(path.x).toBeGreaterThan(360 + cardSize.width);
});

it('separates colliding labels and omits text when no clear position exists', () => {
  const labels = placeLabels(
    [
      { id: 'a', text: 'Long relationship description', x: 300, y: 180 },
      { id: 'b', text: 'Another relationship', x: 300, y: 180 },
    ],
    [],
  );
  expect(labels.size).toBe(2);
  expect(Math.abs(labels.get('a')!.y - labels.get('b')!.y)).toBeGreaterThanOrEqual(28);
  expect(
    placeLabels(
      [{ id: 'a', text: 'Blocked', x: 120, y: 70 }],
      [
        { x: 0, y: 0 },
        { x: 0, y: -200 },
        { x: 0, y: 160 },
      ],
    ).size,
  ).toBe(0);
});
