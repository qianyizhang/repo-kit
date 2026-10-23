import { describe, it, expect } from 'vitest';
import { compareArchitecture, comparisonConnections, scopeForChange } from './comparison';
import { parseDocument, type Architecture } from './document';
const node = (id: string, parent: string | null) => ({
  id,
  parent,
  name: id,
  kind: 'module' as const,
  summary: '',
  sources: [],
  x: 0,
  y: 0,
});
const base: Architecture = {
  version: 3,
  title: 'Board',
  modules: [node('root', null), node('a', 'root'), node('b', 'root'), node('child', 'a')],
  connections: [
    { id: 'one', from: 'child', to: 'b', label: 'reads' },
    { id: 'two', from: 'a', to: 'b', label: 'writes' },
  ],
  annotations: [],
};
describe('proposal comparison', () => {
  it('ignores record order without changing the documents', () => {
    const next = structuredClone(base);
    next.modules.reverse();
    next.connections.reverse();
    const bytes = JSON.stringify([base, next]);
    expect(compareArchitecture(base, next).changes).toEqual([]);
    expect(JSON.stringify([base, next])).toBe(bytes);
  });
  it('separates position, meaning, evidence and structure without guessing renamed IDs', () => {
    const next = structuredClone(base);
    next.modules[1].x = 80;
    next.modules[3] = {
      ...next.modules[3],
      parent: 'b',
      summary: 'New responsibility',
      sources: ['README.md#L1-L2'],
    };
    next.connections[0] = { ...next.connections[0], id: 'renamed' };
    const { changes } = compareArchitecture(base, next);
    expect(changes.find((c) => c.id === 'a')?.status).toBe('moved');
    expect(
      changes
        .find((c) => c.id === 'child')
        ?.fields.map((f) => f.classification)
        .sort(),
    ).toEqual(['evidence', 'meaning', 'structure']);
    expect(changes.find((c) => c.id === 'one')?.status).toBe('removed');
    expect(changes.find((c) => c.id === 'renamed')?.status).toBe('added');
    expect(
      scopeForChange(
        base,
        changes.find((c) => c.id === 'child')!,
      ),
    ).toBe('a');
    expect(
      scopeForChange(
        next,
        changes.find((c) => c.id === 'child')!,
      ),
    ).toBe('b');
  });
  it('retains individual edges that share a displayed route', () => {
    const next = structuredClone(base);
    next.connections[1].label = 'owns';
    expect(comparisonConnections(base, 'root').map((c) => [c.id, c.from, c.to])).toEqual([
      ['one', 'a', 'b'],
      ['two', 'a', 'b'],
    ]);
    expect(compareArchitecture(base, next).changes.map((c) => c.id)).toEqual(['two']);
  });
  it('covers notes, groups, custom type contracts and title; retains field display order', () => {
    const next = parseDocument({
      ...base,
      title: 'New board',
      annotations: [
        {
          id: 'note',
          target: { kind: 'connection', id: 'one' },
          text: 'Human intent',
          author: 'human',
        },
      ],
      groups: [{ id: 'group', name: 'Group', description: '', scope: 'root', members: ['a'] }],
      nodeTypes: [
        {
          id: 'service',
          label: 'Service',
          description: '',
          baseKind: 'module',
          fields: [
            { id: 'first', label: 'First', kind: 'text', surface: 'card' },
            { id: 'second', label: 'Second', kind: 'text', surface: 'card' },
          ],
        },
      ],
    });
    expect(compareArchitecture(base, next).changes.map((c) => c.kind)).toEqual([
      'annotation',
      'group',
      'nodeType',
      'document',
    ]);
    const reordered = structuredClone(next);
    reordered.nodeTypes![0].fields.reverse();
    expect(compareArchitecture(next, reordered).changes[0].fields[0].field).toBe('fields');
    const noteChange = compareArchitecture(base, next).changes[0];
    expect(scopeForChange(next, noteChange)).toBe('root');
    expect(scopeForChange(base, noteChange)).toBeNull();
  });
  it('keeps removals and different roots inspectable without merging documents', () => {
    const next = parseDocument({
      version: 3,
      title: 'New',
      modules: [node('other', null)],
      connections: [],
      annotations: [],
    });
    const removed = compareArchitecture(base, next).changes.find((c) => c.id === 'child')!;
    expect(scopeForChange(base, removed)).toBe('a');
    expect(scopeForChange(next, removed)).toBeNull();
  });
});
