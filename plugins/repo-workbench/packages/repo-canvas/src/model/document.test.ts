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
  version: 1,
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
        annotations: [{ id: 'note', target: 'missing', text: 'hello', author: 'human' }],
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
it('round-trips semantic kinds, relationship evidence and review notes without changing legacy maps', () => {
  const enhanced = {
    ...map,
    modules: map.modules.map((m) => (m.id === 'app' ? { ...m, kind: 'process' } : m)),
    connections: [{ ...map.connections[0], kind: 'evidence', sources: ['src/evidence.py'] }],
    annotations: [
      { id: 'risk', target: 'app', author: 'agent', kind: 'risk', text: 'Reference under review' },
    ],
  };
  expect(parseDocument(enhanced)).toEqual({ ...enhanced, version: 2 });
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
