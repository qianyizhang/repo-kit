import { ancestors, rootOf, type Architecture, type Connection } from './document';

export type EntityKind = 'module' | 'connection' | 'annotation' | 'group' | 'nodeType' | 'document';
export type ChangeClass = 'meaning' | 'structure' | 'evidence' | 'position';
export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
  classification: ChangeClass;
}
export interface ArchitectureChange {
  key: string;
  kind: EntityKind;
  id: string;
  label: string;
  status: 'added' | 'removed' | 'changed' | 'moved';
  fields: FieldChange[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}
export interface ArchitectureChangeSet {
  changes: ArchitectureChange[];
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]: [string, unknown]) => JSON.stringify(key) + ':' + canonical(child))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value) ?? 'undefined';
}
function comparable(value: unknown, field: string): string {
  // Evidence references and memberships are sets; definitions retain display order.
  return canonical(
    Array.isArray(value) && (field === 'sources' || field === 'members')
      ? value.map((item: unknown) => canonical(item)).sort()
      : value,
  );
}
function classification(kind: EntityKind, field: string): ChangeClass {
  if (field === 'sources') return 'evidence';
  if (kind === 'module' && (field === 'x' || field === 'y')) return 'position';
  if (['parent', 'from', 'to', 'scope', 'members', 'target'].includes(field)) return 'structure';
  return 'meaning';
}

/** Compare validated v3 documents by original identities, never projected display edges. */
export function compareArchitecture(
  before: Architecture,
  after: Architecture,
): ArchitectureChangeSet {
  const changes: ArchitectureChange[] = [];
  function compare<T extends { id: string }>(kind: EntityKind, left: T[], right: T[]) {
    const a = new Map<string, Record<string, unknown>>(left.map((item) => [item.id, { ...item }]));
    const b = new Map<string, Record<string, unknown>>(right.map((item) => [item.id, { ...item }]));
    for (const id of [...new Set([...a.keys(), ...b.keys()])].sort()) {
      const old = a.get(id) ?? null,
        next = b.get(id) ?? null;
      const fields = [...new Set([...Object.keys(old ?? {}), ...Object.keys(next ?? {})])]
        .sort()
        .filter(
          (field) =>
            field !== 'id' && comparable(old?.[field], field) !== comparable(next?.[field], field),
        )
        .map((field): FieldChange => ({
          field,
          before: old?.[field],
          after: next?.[field],
          classification: classification(kind, field),
        }));
      if (old && next && !fields.length) continue;
      const value = next ?? old!;
      const label =
        value.name ?? value.label ?? (kind === 'document' ? value.title : undefined) ?? id;
      changes.push({
        key: `${kind}:${id}`,
        kind,
        id,
        label: typeof label === 'string' ? label : id,
        fields,
        before: old,
        after: next,
        status: !old
          ? 'added'
          : !next
            ? 'removed'
            : fields.every((field) => field.classification === 'position')
              ? 'moved'
              : 'changed',
      });
    }
  }
  compare('module', before.modules, after.modules);
  compare('connection', before.connections, after.connections);
  compare('annotation', before.annotations, after.annotations);
  compare('group', before.groups ?? [], after.groups ?? []);
  compare('nodeType', before.nodeTypes ?? [], after.nodeTypes ?? []);
  compare(
    'document',
    [{ id: 'document', title: before.title }],
    [{ id: 'document', title: after.title }],
  );
  return { changes };
}

function connectionScope(document: Architecture, connection: Connection): string {
  const from = ancestors(document, connection.from),
    to = ancestors(document, connection.to);
  return (
    from.filter((node) => to.some((other) => other.id === node.id)).at(-1)?.id ??
    rootOf(document).id
  );
}
export function scopeForChange(document: Architecture, change: ArchitectureChange): string | null {
  if (change.kind === 'module') {
    const node = document.modules.find((node) => node.id === change.id);
    return node ? (node.parent ?? node.id) : null;
  }
  if (change.kind === 'connection') {
    const edge = document.connections.find((edge) => edge.id === change.id);
    return edge ? connectionScope(document, edge) : null;
  }
  if (change.kind === 'group')
    return document.groups?.find((group) => group.id === change.id)?.scope ?? null;
  if (change.kind === 'annotation') {
    const note = document.annotations.find((note) => note.id === change.id);
    return note
      ? scopeForChange(document, {
          ...change,
          kind: note.target.kind === 'node' ? 'module' : 'connection',
          id: note.target.id,
        })
      : null;
  }
  if (change.kind === 'nodeType' && !document.nodeTypes?.some((type) => type.id === change.id))
    return null;
  return rootOf(document).id;
}

/** Keep exact relationship IDs even when several lines project to the same pair. */
export function comparisonConnections(document: Architecture, scope: string) {
  const project = (id: string) => ancestors(document, id).find((node) => node.parent === scope)?.id;
  return document.connections.flatMap((connection) => {
    const from = project(connection.from),
      to = project(connection.to);
    return from && to && from !== to ? [{ ...connection, from, to }] : [];
  });
}
