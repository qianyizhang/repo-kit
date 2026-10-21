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
export const annotationKinds = ['note', 'question', 'risk', 'decision'] as const;
export interface Module {
  id: string;
  parent: string | null;
  name: string;
  kind: ModuleKind;
  summary: string;
  sources: string[];
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
  target: string;
  text: string;
  author: 'human' | 'agent';
  kind?: (typeof annotationKinds)[number];
}
export interface Architecture {
  version: 1 | 2;
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
  if (data.version !== 1 && data.version !== 2) throw new Error('Unsupported architecture version');
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
      sources: list(m.sources, 100).map(sourcePath),
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
      ...(c.sources === undefined ? {} : { sources: list(c.sources, 100).map(sourcePath) }),
      id: id(c.id),
      from,
      to,
      label: text(c.label, 200),
      ...(c.description === undefined ? {} : { description: text(c.description) }),
    };
  });
  const annotations = list(data.annotations, 1000).map((entry): Annotation => {
    const a = object(entry);
    if (!ids.has(String(a.target)) || !['human', 'agent'].includes(String(a.author)))
      throw new Error('Invalid annotation target or author');
    if (a.kind !== undefined && !(annotationKinds as readonly string[]).includes(text(a.kind)))
      throw new Error('Unknown annotation kind');
    return {
      ...(a.kind === undefined ? {} : { kind: a.kind as Annotation['kind'] }),
      id: id(a.id),
      target: id(a.target),
      text: text(a.text),
      author: a.author as Annotation['author'],
    };
  });
  for (const entries of [connections, annotations])
    if (new Set(entries.map((e) => e.id)).size !== entries.length)
      throw new Error('Duplicate identifier');
  const extended =
    modules.some((m) => ['process', 'interface', 'concept'].includes(m.kind)) ||
    connections.some((c) => c.kind || c.sources) ||
    annotations.some((a) => a.kind);
  return {
    version: data.version === 2 || extended ? 2 : 1,
    title: text(data.title, 200),
    modules,
    connections,
    annotations,
  };
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
  return { document, scope, selection, ...(selections ? { selections } : {}), messages };
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
