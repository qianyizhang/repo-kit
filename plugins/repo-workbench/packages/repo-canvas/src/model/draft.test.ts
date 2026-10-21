import { expect, it } from 'vitest';
import { parseDocument } from './document';
import { initialDraft, transitionDraft } from './draft';

const document = parseDocument({
  version: 3,
  title: 'Draft',
  modules: [
    {
      id: 'root',
      parent: null,
      name: 'Root',
      kind: 'module',
      summary: '',
      sources: [],
      x: 0,
      y: 0,
    },
    { id: 'a', parent: 'root', name: 'A', kind: 'module', summary: '', sources: [], x: 0, y: 0 },
    { id: 'b', parent: 'root', name: 'B', kind: 'module', summary: '', sources: [], x: 0, y: 0 },
    {
      id: 'nested',
      parent: 'a',
      name: 'Nested',
      kind: 'module',
      summary: '',
      sources: [],
      x: 0,
      y: 0,
    },
  ],
  connections: [],
  annotations: [],
});

it('repairs removed selections at edit time so Undo cannot resurrect hidden selection state', () => {
  let state = transitionDraft(initialDraft, { type: 'load', document });
  state = transitionDraft(state, { type: 'selectMany', ids: ['a', 'b'] });
  const removed = { ...document, modules: document.modules.filter((m) => m.id !== 'b') };
  state = transitionDraft(state, { type: 'edit', document: removed });
  expect(state.selections).toEqual(['a']);
  expect(state.selection).toBeNull();
  state = transitionDraft(state, { type: 'undo' });
  expect(state.document).toBe(document);
  expect(state.selections).toEqual(['a']);
  expect(state.selection).toBeNull();
  expect(state.history).toEqual([]);
  expect(state.dirty).toBe(true);
});

it('Undo keeps current navigation when valid and repairs a removed scope to root', () => {
  let state = transitionDraft(initialDraft, { type: 'load', document });
  const added = parseDocument({
    ...document,
    modules: [
      ...document.modules,
      {
        id: 'new',
        parent: 'root',
        name: 'New',
        kind: 'module',
        summary: '',
        sources: [],
        x: 0,
        y: 0,
      },
    ],
  });
  state = transitionDraft(state, { type: 'edit', document: added });
  state = transitionDraft(state, { type: 'enter', id: 'new' });
  state = transitionDraft(state, { type: 'undo' });
  expect(state.scope).toBe('root');
  expect(state.selection).toBeNull();
  state = transitionDraft(state, { type: 'edit', document: added });
  state = transitionDraft(state, { type: 'locate', id: 'nested' });
  state = transitionDraft(state, { type: 'undo' });
  expect(state.scope).toBe('a');
  expect(state.selection).toBe('nested');
});

it('keeps root inspection distinct from selected children and filters agent/restored selections', () => {
  let state = transitionDraft(initialDraft, {
    type: 'load',
    document,
    view: { scope: 'root', selection: 'root', selections: ['a', 'a', 'nested', 'missing'] },
    dirty: true,
  });
  expect(state.selection).toBe('root');
  expect(state.selections).toEqual(['a']);
  state = transitionDraft(state, { type: 'select', id: 'b', additive: true });
  expect(state.selections).toEqual(['a', 'b']);
  expect(state.selection).toBe('b');
  state = transitionDraft(state, { type: 'selectMany', ids: ['a', 'nested', 'missing'] });
  expect(state.selection).toBe('a');
  expect(state.selections).toEqual(['a']);
  state = transitionDraft(state, { type: 'locate', id: 'root' });
  expect(state.selection).toBe('root');
  expect(state.selections).toEqual([]);
});

it('a late save cannot replace a newer edit; clean refresh clears obsolete history and view IDs', () => {
  let state = transitionDraft(initialDraft, { type: 'load', document });
  const edited = { ...document, title: 'Edited' };
  state = transitionDraft(state, { type: 'edit', document: edited });
  state = transitionDraft(state, {
    type: 'saved',
    expected: document,
    document: { ...document, title: 'Saved earlier' },
  });
  expect(state.document).toBe(edited);
  expect(state.dirty).toBe(true);
  state = transitionDraft(state, { type: 'selectMany', ids: ['a', 'b'] });
  state = transitionDraft(state, {
    type: 'refresh',
    document: { ...document, modules: document.modules.filter((m) => m.id !== 'b') },
  });
  expect(state.selections).toEqual(['a']);
  expect(state.selection).toBeNull();
  expect(state.history).toEqual([]);
  expect(state.dirty).toBe(false);
});
