import { it, expect } from 'vitest';
import { typeChanges, migrateTypes } from './type-changes';
import { parseDocument, type Architecture } from './document';
it('previews field removal and incompatible type changes while retaining unknown fields', () => {
  const before: Architecture = {
    version: 3,
    title: 'test',
    modules: [
      {
        id: 'root',
        parent: null,
        name: 'Owner',
        kind: 'module',
        summary: '',
        sources: [],
        typeId: 'service',
        fields: { capacity: 3, retained: 'legacy' },
        x: 0,
        y: 0,
      },
    ],
    connections: [],
    annotations: [],
    nodeTypes: [
      {
        id: 'service',
        label: 'Service',
        baseKind: 'module',
        description: '',
        fields: [{ id: 'capacity', label: 'Capacity', kind: 'number', surface: 'card' }],
      },
    ],
  };
  const removed = { ...before, nodeTypes: before.nodeTypes!.map((t) => ({ ...t, fields: [] })) };
  expect(typeChanges(before, removed)).toEqual(['Owner · Capacity: 3 → remove value']);
  expect(parseDocument(migrateTypes(before, removed)).modules[0].fields).toEqual({
    retained: 'legacy',
  });
  const changed: Architecture = {
    ...before,
    nodeTypes: before.nodeTypes!.map((t) => ({
      ...t,
      fields: t.fields.map((f) => ({ ...f, kind: 'boolean' })),
    })),
  };
  expect(typeChanges(before, changed)).toHaveLength(1);
  expect(parseDocument(migrateTypes(before, changed)).modules[0].fields).toEqual({
    retained: 'legacy',
  });
  expect(migrateTypes(before, { ...before, nodeTypes: [] }).modules[0].fields).toEqual(
    before.modules[0].fields,
  );
});
