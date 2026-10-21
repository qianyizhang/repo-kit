/** The shared document is data, independent of its renderer and agent adapter. */
export const moduleKinds = [
  'system',
  'package',
  'module',
  'data',
  'external',
  'process',
  'interface',
  'concept',
] as const;
export type ModuleKind = (typeof moduleKinds)[number];
export const connectionKinds = [
  'dependency',
  'data-flow',
  'control-flow',
  'evidence',
  'ownership',
] as const;
export type ConnectionKind = (typeof connectionKinds)[number];
export const annotationKinds = ['note', 'question', 'decision'] as const;
export const severities = ['info', 'warning', 'risk'] as const;
export const fieldKinds = ['text', 'number', 'boolean', 'enum', 'source'] as const;
export const surfaces = ['card', 'peek', 'details'] as const;
export interface FieldDefinition {
  id: string;
  label: string;
  kind: (typeof fieldKinds)[number];
  surface: (typeof surfaces)[number];
  options?: string[];
}
export interface NodeType {
  id: string;
  label: string;
  description: string;
  baseKind: ModuleKind;
  fields: FieldDefinition[];
}
export interface Group {
  id: string;
  scope: string;
  name: string;
  description: string;
  members: string[];
}
export interface Target {
  kind: 'node' | 'connection' | 'annotation';
  id: string;
}
export interface ContextComment {
  id: string;
  instruction: string;
  target: Target;
  label: string;
  scope: string;
  documentRevision: string;
  captured: string;
  sources: string[];
}
export const kindDescriptions: Record<ModuleKind, string> = {
  system: 'A whole system and its enclosing scope.',
  package: 'An independently delivered code product.',
  module: 'An implementation responsibility.',
  data: 'Stored or exchanged information.',
  external: 'An owner or dependency outside this system.',
  process: 'An ordered transformation or workflow.',
  interface: 'A surface through which actors interact.',
  concept: 'Domain meaning, policy or an invariant.',
};
export interface Module {
  id: string;
  parent: string | null;
  name: string;
  kind: ModuleKind;
  summary: string;
  sources: string[];
  typeId?: string;
  fields?: Record<string, string | number | boolean>;
  x: number;
  y: number;
}
export interface Connection {
  id: string;
  from: string;
  to: string;
  label: string;
  description?: string;
  kind?: ConnectionKind;
  sources?: string[];
}
export interface Annotation {
  id: string;
  target: Target;
  severity?: (typeof severities)[number];
  text: string;
  author: 'human' | 'agent';
  kind?: (typeof annotationKinds)[number];
}
export interface Architecture {
  version: 3;
  nodeTypes?: NodeType[];
  groups?: Group[];
  title: string;
  modules: Module[];
  connections: Connection[];
  annotations: Annotation[];
}
export interface Snapshot {
  document: Architecture;
  revision: string;
  repo: string;
  saved: boolean;
  problem?: string;
}
export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}
export interface ChatRequest {
  document: Architecture;
  scope: string;
  selection: string | null;
  selections?: string[];
  messages: ChatMessage[];
  comments?: ContextComment[];
}
export interface ChatReply {
  reply: string;
  proposal: Architecture | null;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an object');
  return value as Record<string, unknown>;
}
function text(value: unknown, limit = 12000): string {
  if (typeof value !== 'string' || value.length > limit)
    throw new Error('Invalid or oversized text');
  return value;
}
function id(value: unknown): string {
  const result = text(value, 180);
  if (!/^[a-zA-Z0-9_./-]+$/.test(result))
    throw new Error(
      `Invalid identifier ${JSON.stringify(result)}: use letters, digits, underscores, dots, slashes, or hyphens`,
    );
  return result;
}
function list(value: unknown, limit: number): unknown[] {
  if (!Array.isArray(value) || value.length > limit) throw new Error('Invalid or oversized list');
  return value as unknown[];
}
export function sourcePath(value: unknown): string {
  const path = text(value, 500);
  if (
    !path ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.split('/').some((part) => part === '..' || part === '.' || !part)
  )
    throw new Error('Source must be a relative repository path');
  return path;
}
export function parseDocument(value: unknown): Architecture {
  const data = object(value);
  if (data.version !== 3)
    throw new Error(
      'Unsupported architecture version. This app requires v3. Ask the agent to repair .repo-canvas/architecture.json offline, or start a new draft.',
    );
  const nodeTypes = data.nodeTypes === undefined ? undefined : parseNodeTypes(data.nodeTypes);
  const groups =
    data.groups === undefined
      ? undefined
      : list(data.groups, 100).map((entry): Group => {
          const g = object(entry);
          return {
            id: id(g.id),
            scope: id(g.scope),
            name: text(g.name, 200),
            description: text(g.description),
            members: list(g.members, 500).map(id),
          };
        });
  const modules = list(data.modules, 500).map((entry): Module => {
    const m = object(entry);
    if (!(moduleKinds as readonly string[]).includes(String(m.kind)))
      throw new Error('Unknown module kind');
    if (
      typeof m.x !== 'number' ||
      typeof m.y !== 'number' ||
      !Number.isFinite(m.x) ||
      !Number.isFinite(m.y) ||
      Math.abs(m.x) > 50000 ||
      Math.abs(m.y) > 50000
    )
      throw new Error('Invalid module position');
    return {
      id: id(m.id),
      parent: m.parent === null ? null : id(m.parent),
      name: text(m.name, 200),
      kind: m.kind as ModuleKind,
      summary: text(m.summary),
      sources: list(m.sources, 100).map(sourceReference),
      ...(m.typeId === undefined ? {} : { typeId: id(m.typeId) }),
      ...(m.fields === undefined ? {} : { fields: parseFields(m.fields) }),
      x: m.x,
      y: m.y,
    };
  });
  const ids = new Set(modules.map((m) => m.id));
  if (ids.size !== modules.length || modules.filter((m) => m.parent === null).length !== 1)
    throw new Error('The document needs unique modules and exactly one root');
  const byId = new Map(modules.map((m) => [m.id, m]));
  for (const m of modules) {
    const visited = new Set([m.id]);
    let parent = m.parent;
    while (parent !== null) {
      if (!ids.has(parent) || visited.has(parent))
        throw new Error('Missing parent or hierarchy cycle');
      visited.add(parent);
      parent = byId.get(parent)!.parent;
    }
  }
  const connections = list(data.connections, 2000).map((entry): Connection => {
    const c = object(entry);
    const from = id(c.from),
      to = id(c.to);
    if (!ids.has(from) || !ids.has(to) || from === to)
      throw new Error('Invalid connection endpoints');
    if (c.kind !== undefined && !(connectionKinds as readonly string[]).includes(text(c.kind)))
      throw new Error('Unknown relationship kind');
    return {
      ...(c.kind === undefined ? {} : { kind: c.kind as ConnectionKind }),
      ...(c.sources === undefined ? {} : { sources: list(c.sources, 100).map(sourceReference) }),
      id: id(c.id),
      from,
      to,
      label: text(c.label, 200),
      ...(c.description === undefined ? {} : { description: text(c.description) }),
    };
  });
  const annotations = list(data.annotations, 1000).map((entry): Annotation => {
    const a = object(entry);
    const target = parseTarget(a.target);
    if (
      target.kind === 'annotation' ||
      !(target.kind === 'node'
        ? ids.has(target.id)
        : connections.some((c) => c.id === target.id)) ||
      !['human', 'agent'].includes(String(a.author))
    )
      throw new Error('Invalid annotation target or author');
    if (a.kind !== undefined && !(annotationKinds as readonly string[]).includes(text(a.kind)))
      throw new Error('Unknown annotation kind');
    return {
      ...(a.kind === undefined ? {} : { kind: a.kind as Annotation['kind'] }),
      id: id(a.id),
      target,
      ...(a.severity === undefined ? {} : { severity: oneOf(a.severity, severities) }),
      text: text(a.text),
      author: a.author as Annotation['author'],
    };
  });
  for (const entries of [connections, annotations])
    if (new Set(entries.map((e) => e.id)).size !== entries.length)
      throw new Error('Duplicate identifier');
  for (const entries of [nodeTypes ?? [], groups ?? []])
    if (new Set(entries.map((e) => e.id)).size !== entries.length)
      throw new Error('Duplicate definition ID');
  for (const g of groups ?? []) {
    if (
      !ids.has(g.scope) ||
      !g.members.length ||
      new Set(g.members).size !== g.members.length ||
      g.members.some((key) => byId.get(key)?.parent !== g.scope)
    )
      throw new Error('Group members must be unique existing siblings in its scope');
  }
  for (const m of modules) {
    const type = nodeTypes?.find((t) => t.id === m.typeId);
    if (type && type.baseKind !== m.kind)
      throw new Error(`Node ${m.name} does not match its type base kind`);
    for (const f of type?.fields ?? []) {
      const value = m.fields?.[f.id];
      if (value !== undefined && !fieldAccepts(f, value))
        throw new Error(`Field ${m.name}.${f.id} requires an explicit value migration`);
    }
  }
  return {
    version: 3,
    title: text(data.title, 200),
    modules,
    connections,
    annotations,
    ...(nodeTypes === undefined ? {} : { nodeTypes }),
    ...(groups === undefined ? {} : { groups }),
  };
}
export function parseTarget(value: unknown): Target {
  const t = object(value);
  return { kind: oneOf(t.kind, ['node', 'connection', 'annotation'] as const), id: id(t.id) };
}
function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) throw new Error('Unknown value: ' + String(value));
  return value as T;
}
function parseFields(value: unknown): Record<string, string | number | boolean> {
  const fields = object(value);
  if (Object.keys(fields).length > 100) throw new Error('Too many fields');
  return Object.fromEntries(
    Object.entries(fields).map(([key, v]) => {
      id(key);
      if (
        !['string', 'number', 'boolean'].includes(typeof v) ||
        (typeof v === 'number' && !Number.isFinite(v))
      )
        throw new Error('Invalid field value');
      if (typeof v === 'string') text(v);
      return [key, v as string | number | boolean];
    }),
  );
}
export function parseNodeTypes(value: unknown): NodeType[] {
  return list(value, 100).map((entry) => {
    const t = object(entry);
    const fields = list(t.fields, 40).map((entry) => {
      const f = object(entry);
      return {
        id: id(f.id),
        label: text(f.label, 100),
        kind: oneOf(f.kind, fieldKinds),
        surface: oneOf(f.surface, surfaces),
        ...(f.options === undefined
          ? {}
          : { options: list(f.options, 100).map((v) => text(v, 200)) }),
      };
    });
    if (new Set(fields.map((f) => f.id)).size !== fields.length)
      throw new Error('Duplicate field ID');
    if (
      fields.some(
        (f) =>
          f.kind === 'enum' && (!f.options?.length || new Set(f.options).size !== f.options.length),
      )
    )
      throw new Error('Enum fields need unique options');
    if (fields.filter((f) => f.surface === 'card').length > 2)
      throw new Error('Cards support at most two short fields');
    return {
      id: id(t.id),
      label: text(t.label, 100),
      description: text(t.description),
      baseKind: oneOf(t.baseKind, moduleKinds),
      fields,
    };
  });
}
export function fieldAccepts(field: FieldDefinition, value: unknown): boolean {
  if (field.kind === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (field.kind === 'boolean') return typeof value === 'boolean';
  if (typeof value !== 'string') return false;
  if (field.kind === 'enum') return field.options!.includes(value);
  if (field.kind === 'source') {
    try {
      sourceReference(value);
      return true;
    } catch {
      return false;
    }
  }
  return true;
}
export function sourceReference(value: unknown): string {
  const result = text(value, 550);
  parseSourceReference(result);
  return result;
}
export function parseSourceReference(value: string): {
  path: string;
  startLine?: number;
  endLine?: number;
} {
  const match = /^(.*)#L([1-9]\d*)(?:-L?([1-9]\d*))?$/.exec(value);
  if (!match) return { path: sourcePath(value) };
  const startLine = Number(match[2]),
    endLine = Number(match[3] ?? match[2]);
  if (!Number.isSafeInteger(startLine) || !Number.isSafeInteger(endLine) || endLine < startLine)
    throw new Error('Invalid source line range');
  return { path: sourcePath(match[1]), startLine, endLine };
}
export function parseComments(value: unknown): ContextComment[] {
  return list(value, 50).map((entry) => {
    const c = object(entry);
    return {
      id: id(c.id),
      instruction: text(c.instruction),
      target: parseTarget(c.target),
      label: text(c.label, 200),
      scope: id(c.scope),
      documentRevision: text(c.documentRevision, 100),
      captured: text(c.captured, 50000),
      sources: list(c.sources, 100).map(sourceReference),
    };
  });
}
export function targetValue(document: Architecture, target: Target) {
  return target.kind === 'node'
    ? document.modules.find((m) => m.id === target.id)
    : target.kind === 'connection'
      ? document.connections.find((c) => c.id === target.id)
      : document.annotations.find((a) => a.id === target.id);
}
export function sameTarget(a: Target, b: Target) {
  return a.kind === b.kind && a.id === b.id;
}

export function parseChat(value: unknown): ChatRequest {
  const data = object(value);
  const document = parseDocument(data.document);
  const scope = id(data.scope),
    selection = data.selection === null ? null : id(data.selection);
  if (
    ![scope, ...(selection ? [selection] : [])].every((key) =>
      document.modules.some((m) => m.id === key),
    )
  )
    throw new Error('Unknown chat context');
  const messages = list(data.messages, 30).map((entry): ChatMessage => {
    const m = object(entry);
    if (m.role !== 'user' && m.role !== 'assistant') throw new Error('Invalid chat role');
    return { role: m.role, text: text(m.text, m.role === 'assistant' ? 50000 : 12000) };
  });
  if (!messages.length || messages.at(-1)?.role !== 'user')
    throw new Error('A user message is required');
  const selections = data.selections === undefined ? undefined : list(data.selections, 500).map(id);
  if (
    selections?.some((key) => !document.modules.some((m) => m.id === key)) ||
    (selections && new Set(selections).size !== selections.length)
  )
    throw new Error('Invalid selections');
  return {
    document,
    scope,
    selection,
    ...(selections ? { selections } : {}),
    messages,
    ...(data.comments === undefined ? {} : { comments: parseComments(data.comments) }),
  };
}
export function parseReply(value: unknown): ChatReply {
  const data = object(value);
  return {
    reply: text(data.reply, 50000),
    proposal: data.proposal === null ? null : parseDocument(data.proposal),
  };
}
export function rootOf(document: Architecture): Module {
  return document.modules.find((m) => m.parent === null)!;
}
export function ancestors(document: Architecture, target: string): Module[] {
  const result: Module[] = [];
  let node = document.modules.find((m) => m.id === target);
  while (node) {
    result.unshift(node);
    node = document.modules.find((m) => m.id === node!.parent);
  }
  return result;
}
/** Project connections onto the visible children, preserving cross-layer meaning. */
export function visibleConnections(document: Architecture, scope: string): Connection[] {
  const project = (target: string) =>
    ancestors(document, target).find((m) => m.parent === scope)?.id;
  const grouped = new Map<string, Connection>();
  for (const c of document.connections) {
    const from = project(c.from),
      to = project(c.to);
    if (!from || !to || from === to) continue;
    const key = `${from}:${to}`;
    const previous = grouped.get(key);
    grouped.set(key, {
      ...(previous && previous.kind !== c.kind ? {} : c.kind ? { kind: c.kind } : {}),
      id: key,
      from,
      to,
      label: previous && previous.label !== c.label ? 'Multiple relationships' : c.label,
    });
  }
  return [...grouped.values()];
}
