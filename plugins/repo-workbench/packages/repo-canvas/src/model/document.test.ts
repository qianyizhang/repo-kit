import { describe, expect, it } from 'vitest';
import {
  parseChat,
  parseDocument,
  parseReply,
  visibleConnections,
  type Architecture,
} from './document';
const module = (id: string, parent: string | null) => ({
  id,
  parent,
  name: id,
  kind: 'module' as const,
  summary: '',
  sources: [],
  x: 0,
  y: 0,
});
const map: Architecture = {
  version: 3,
  title: 'Test',
  modules: [
    module('repo', null),
    module('app', 'repo'),
    module('store', 'repo'),
    module('ui', 'app'),
    module('db', 'store'),
  ],
  connections: [{ id: 'read', from: 'ui', to: 'db', label: 'reads' }],
  annotations: [],
};
describe('shared architecture document', () => {
  it('accepts a valid long reply as context for the next user message', () => {
    const response = parseReply({ reply: 'x'.repeat(50000), proposal: null });
    const request = parseChat({
      document: map,
      scope: 'repo',
      selection: null,
      messages: [
        { role: 'assistant', text: response.reply },
        { role: 'user', text: 'Continue' },
      ],
    });
    expect(request.messages[0].text).toBe(response.reply);
  });
  it('projects a deep dependency onto the current level without drawing an internal loop', () => {
    expect(visibleConnections(map, 'repo')).toEqual([
      { id: 'app:store', from: 'app', to: 'store', label: 'reads' },
    ]);
    expect(visibleConnections(map, 'app')).toEqual([]);
  });
  it('rejects cycles, dangling references, unsafe source paths and nonfinite layout before saving', () => {
    expect(() =>
      parseDocument({
        ...map,
        modules: map.modules.map((m) => (m.id === 'app' ? { ...m, parent: 'ui' } : m)),
      }),
    ).toThrow('cycle');
    expect(() =>
      parseDocument({
        ...map,
        annotations: [
          { id: 'note', target: { kind: 'node', id: 'missing' }, text: 'hello', author: 'human' },
        ],
      }),
    ).toThrow('annotation');
    expect(() =>
      parseDocument({
        ...map,
        modules: map.modules.map((m) => ({ ...m, sources: ['../outside'] })),
      }),
    ).toThrow('relative');
    expect(() =>
      parseDocument({ ...map, modules: map.modules.map((m) => ({ ...m, x: Infinity })) }),
    ).toThrow('position');
  });
});
it('round-trips semantic kinds, relationship evidence and review notes in the v3 format', () => {
  const enhanced = {
    ...map,
    modules: map.modules.map((m) => (m.id === 'app' ? { ...m, kind: 'process' } : m)),
    connections: [{ ...map.connections[0], kind: 'evidence', sources: ['src/evidence.py'] }],
    annotations: [
      {
        id: 'risk',
        target: { kind: 'node', id: 'app' },
        author: 'agent',
        kind: 'note',
        severity: 'risk',
        text: 'Reference under review',
      },
    ],
  };
  expect(parseDocument(enhanced)).toEqual({ ...enhanced, version: 3 });
  expect(parseDocument(map)).toEqual(map);
  expect(() =>
    parseDocument({ ...enhanced, connections: [{ ...enhanced.connections[0], kind: 'invented' }] }),
  ).toThrow('kind');
});
it('keeps multi-selection in requests and rejects unknown or repeated selections', () => {
  const request = {
    document: map,
    scope: 'repo',
    selection: 'store',
    selections: ['app', 'store'],
    messages: [{ role: 'user', text: 'Compare' }],
  };
  expect(parseChat(request).selections).toEqual(['app', 'store']);
  expect(() => parseChat({ ...request, selections: ['unknown'] })).toThrow('selections');
  expect(() => parseChat({ ...request, selections: ['app', 'app'] })).toThrow('selections');
});
it('accepts declarative surfaces and overlapping sibling groups but rejects legacy maps and incompatible values', () => {
  for (const version of [1, 2])
    expect(() => parseDocument({ ...map, version })).toThrow('requires v3');
  const extended = {
    ...map,
    nodeTypes: [
      {
        id: 'owner',
        label: 'Owner',
        description: 'Boundary',
        baseKind: 'module',
        fields: [{ id: 'count', label: 'Count', kind: 'number', surface: 'card' }],
      },
    ],
    modules: map.modules.map((m) =>
      m.id === 'app' ? { ...m, typeId: 'owner', fields: { count: 2, retained: 'unknown' } } : m,
    ),
    groups: [
      { id: 'one', scope: 'repo', name: 'One', description: '', members: ['app', 'store'] },
      { id: 'two', scope: 'repo', name: 'Two', description: '', members: ['app'] },
    ],
  };
  expect(parseDocument(extended)).toEqual(extended);
  expect(() =>
    parseDocument({ ...extended, groups: [{ ...extended.groups[0], members: ['app', 'ui'] }] }),
  ).toThrow('siblings');
  expect(() =>
    parseDocument({
      ...extended,
      modules: extended.modules.map((m) =>
        m.id === 'app' ? { ...m, fields: { count: 'two' } } : m,
      ),
    }),
  ).toThrow('migration');
});
