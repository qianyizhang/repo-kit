import { expect, it, vi } from 'vitest';
import { CanvasSession } from './session';
import type { CanvasView } from '../model/session';
const view: CanvasView = {
  document: {
    version: 3,
    title: 'Test',
    modules: [
      {
        id: 'repo',
        parent: null,
        name: 'Test',
        kind: 'system',
        summary: '',
        sources: [],
        x: 0,
        y: 0,
      },
      {
        id: 'child',
        parent: 'repo',
        name: 'Child',
        kind: 'module',
        summary: '',
        sources: [],
        x: 40,
        y: 40,
      },
    ],
    connections: [],
    annotations: [],
  },
  baseRevision: 'disk',
  scope: 'repo',
  selections: [],
  panel: null,
  navigation: false,
  viewport: { x: 0, y: 0, zoom: 1, width: 400, height: 800 },
  dirty: false,
  conflict: false,
};
it('requires fresh exact state, validates targets and returns command acknowledgments', () => {
  const session = new CanvasSession();
  expect(session.snapshot()).toMatchObject({ available: false });
  const { revision } = session.observe(view);
  expect(() => session.enqueue('stale', { action: 'fit' })).toThrow('Conflict');
  expect(() => session.enqueue(revision, { action: 'focus', target: 'missing' })).toThrow('target');
  const command = session.enqueue(revision, { action: 'select', targets: ['child'] });
  expect(() => session.enqueue(revision, { action: 'fit' })).toThrow('pending');
  session.acknowledge(command.id, 'applied', 'Selected');
  expect(session.snapshot()).toMatchObject({ available: true, command: { status: 'applied' } });
  expect(() => session.observe({ ...view, selections: ['missing'] })).toThrow('selection');
  expect(() => session.observe({ ...view, viewport: { ...view.viewport, zoom: NaN } })).toThrow();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 16000);
  try {
    expect(session.snapshot()).toMatchObject({ stale: true });
    expect(() => session.enqueue(revision, { action: 'fit' })).toThrow('stale');
  } finally {
    clock.mockRestore();
  }
});
it('isolates state and keeps proposals out of the current draft until review', () => {
  const one = new CanvasSession(),
    two = new CanvasSession();
  const { revision } = one.observe(view);
  const proposed = { ...view.document, title: 'Reviewed candidate' };
  const result = one.propose(revision, proposed, 'A better title');
  expect(one.snapshot(true)).toMatchObject({ document: { title: 'Test' }, proposalId: result.id });
  expect(two.snapshot()).toMatchObject({ available: false });
  expect(() => one.propose(revision, proposed, 'duplicate')).toThrow('existing proposal');
  one.dismiss(result.id);
  expect(one.snapshot()).toMatchObject({ proposalId: null });
});
