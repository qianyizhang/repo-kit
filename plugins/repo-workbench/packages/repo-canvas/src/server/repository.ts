import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  lstatSync,
  chmodSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, resolve, sep } from 'node:path';
import {
  parseDocument,
  parseSourceReference,
  type Architecture,
  type Module,
  type Snapshot,
} from '../model/document.ts';

export const documentName = '.repo-canvas/architecture.json';
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
export function repositoryFiles(root: string): string[] {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    maxBuffer: 20_000_000,
  })
    .toString()
    .split('\0')
    .filter(Boolean);
}
/** A directory map is only a starting point, never a claim about semantic architecture. */
export function discover(root: string): Architecture {
  const files = repositoryFiles(root).filter(
    (p) =>
      !p.startsWith('.') &&
      /\.(tsx?|[cm]?[jt]s|py|rs|go|json|md|toml|ya?ml|css|html|swift|sql|sh)$/.test(p),
  );
  const modules: Module[] = [
    {
      id: 'repo',
      parent: null,
      name: basename(root),
      kind: 'system',
      summary:
        'A shared map of this repository. The initial grouping follows repository directories; refine responsibilities and relationships together.',
      sources: files.includes('README.md') ? ['README.md'] : [],
      x: 0,
      y: 0,
    },
  ];
  const dirs = new Set<string>();
  for (const file of files) {
    const parts = file.split('/').slice(0, -1);
    for (let depth = 1; depth <= Math.min(parts.length, 4); depth++)
      dirs.add(parts.slice(0, depth).join('/'));
  }
  // Breadth first: a large early subtree must not hide later top-level owners.
  const ordered = [...dirs].sort(
    (a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b),
  );
  const selected = ordered.slice(0, 480);
  // Filesystem names are not document identifiers (e.g. Astro's [project]).
  // Preserve existing valid IDs; reserve them before allocating stable opaque IDs.
  const validId = (path: string) =>
    path !== 'repo' && path.length <= 180 && /^[a-zA-Z0-9_./-]+$/.test(path);
  const used = new Set(['repo', ...selected.filter(validId)]);
  const directoryIds = new Map(
    selected.map((path) => {
      if (validId(path)) return [path, path];
      const base = `dir-${digest(path)}`;
      let identifier = base;
      for (let suffix = 1; used.has(identifier); suffix++) identifier = `${base}-${suffix}`;
      used.add(identifier);
      return [path, identifier];
    }),
  );
  if (dirs.size > selected.length)
    modules[0].summary += ` Showing ${selected.length} of ${dirs.size} directories (up to four levels); use search or curate a semantic map.`;
  for (const path of selected) {
    const parentPath = dirname(path);
    const parent = parentPath === '.' ? 'repo' : directoryIds.get(parentPath)!;
    if (!modules.some((m) => m.id === parent)) continue;
    const index = modules.filter((m) => m.parent === parent).length;
    const matches = files.filter((f) => f.startsWith(`${path}/`));
    modules.push({
      id: directoryIds.get(path)!,
      parent,
      name: basename(path),
      kind: parentPath === 'packages' ? 'package' : path === 'docs' ? 'data' : 'module',
      summary: `Directory grouping · ${matches.length} Git-visible text files. Responsibilities have not yet been interpreted.`,
      sources: matches.slice(0, 12),
      x: 70 + (index % 3) * 300,
      y: 85 + Math.floor(index / 3) * 190,
    });
  }
  return parseDocument({
    version: 3,
    title: basename(root),
    modules,
    connections: [],
    annotations: [],
  });
}
export class Repository {
  readonly root: string;
  constructor(root: string) {
    this.root = realpathSync(root);
  }
  private documentPath(): string {
    const folder = resolve(this.root, '.repo-canvas');
    if (existsSync(folder) && realpathSync(folder) !== folder)
      throw new Error('Architecture folder must not be a symlink');
    const path = resolve(this.root, documentName);
    if (existsSync(path) && realpathSync(path) !== path)
      throw new Error('Architecture document must not be a symlink');
    return path;
  }
  snapshot(): Snapshot {
    const path = this.documentPath();
    const saved = existsSync(path);
    if (saved && statSync(path).size > 2_000_000)
      throw new Error('Architecture document exceeds 2 MB');
    const raw = saved ? readFileSync(path, 'utf8') : JSON.stringify(discover(this.root));
    const metadata = { revision: digest(raw), repo: this.root, saved };
    try {
      return { ...metadata, document: parseDocument(JSON.parse(raw) as unknown) };
    } catch (error) {
      return { ...metadata, document: discover(this.root), problem: String(error) };
    }
  }
  save(value: unknown, revision: string): Snapshot {
    const document = parseDocument(value);
    const serialized = `${JSON.stringify(document, null, 2)}\n`;
    if (Buffer.byteLength(serialized) > 2_000_000)
      throw new Error('Architecture document exceeds 2 MB');
    if (this.snapshot().revision !== revision)
      throw new Error(
        'Conflict: the architecture changed on disk. Export your draft, then reload.',
      );
    const path = this.documentPath();
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    writeFileSync(temporary, serialized, { flag: 'wx' });
    renameSync(temporary, path);
    return this.snapshot();
  }
  private readSource(reference: string) {
    const { path, startLine, endLine } = parseSourceReference(reference);
    if (
      path.startsWith('.git/') ||
      path === documentName ||
      !repositoryFiles(this.root).includes(path)
    )
      throw new Error('Source access is limited to existing Git-visible repository text files');
    const absolute = resolve(this.root, path);
    let part = this.root;
    for (const segment of path.split('/')) {
      part = resolve(part, segment);
      if (lstatSync(part).isSymbolicLink())
        throw new Error('Source paths must not contain symlinks');
    }
    if (!absolute.startsWith(this.root + sep))
      throw new Error('Source resolves outside the repository');
    const stat = statSync(absolute);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 500_000)
      throw new Error('Source must be a regular text file under 500 KB');
    const bytes = readFileSync(absolute);
    const raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    if (raw.includes('\0')) throw new Error('Binary source cannot be previewed');
    const lines = raw.split(/(?<=\n)/);
    if (lines.at(-1) === '') lines.pop();
    const first = startLine ?? 1,
      last = endLine ?? Math.max(1, lines.length);
    if (first > Math.max(1, lines.length) || last > Math.max(1, lines.length))
      throw new Error('Source line range is outside the current file');
    return { path, absolute, stat, raw, lines, first, last, revision: digest(raw) };
  }
  source(value: unknown) {
    if (typeof value !== 'string') throw new Error('Invalid source reference');
    const file = this.readSource(value);
    const content = file.lines.slice(file.first - 1, file.last).join('');
    return {
      path: file.path,
      reference: value,
      content: content.slice(0, 40000),
      truncated: content.length > 40000,
      startLine: file.first,
      endLine: file.last,
      totalLines: Math.max(1, file.lines.length),
      revision: file.revision,
    };
  }
  saveSource(reference: string, revision: string, content: string, value: unknown) {
    const document = parseDocument(value);
    const references = [
      ...document.modules.flatMap((m) => [
        ...m.sources,
        ...(document.nodeTypes
          ?.find((t) => t.id === m.typeId)
          ?.fields.filter((f) => f.kind === 'source')
          .map((f) => String(m.fields?.[f.id] ?? '')) ?? []),
      ]),
      ...document.connections.flatMap((c) => c.sources ?? []),
    ];
    if (!references.includes(reference))
      throw new Error('Only an explicitly referenced source block can be saved');
    const file = this.readSource(reference);
    if (file.revision !== revision)
      throw new Error('Conflict: Source changed on disk. Reload and review a fresh diff.');
    if (content.includes('\0') || content.length > 40000)
      throw new Error('Source block must be text under 40,000 characters');
    const replacement = file.raw.includes('\r\n')
      ? content.replace(/\r?\n/g, '\r\n')
      : content.replace(/\r\n/g, '\n');
    if (file.last < file.lines.length && replacement && !replacement.endsWith('\n'))
      throw new Error('A block before following lines must end with a newline');
    const next =
      file.lines.slice(0, file.first - 1).join('') +
      replacement +
      file.lines.slice(file.last).join('');
    const temporary = file.absolute + '.' + randomUUID() + '.tmp';
    try {
      writeFileSync(temporary, next, { flag: 'wx', mode: file.stat.mode });
      chmodSync(temporary, file.stat.mode); // Creation umask must not change the source permissions.
      const current = this.readSource(reference);
      if (current.revision !== revision || current.stat.ino !== file.stat.ino)
        throw new Error('Conflict: Source changed during save');
      renameSync(temporary, file.absolute);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
    // A block can change its length; return its new bounds without silently changing the map.
    const count = replacement ? replacement.split(/(?<=\n)/).filter(Boolean).length : 0;
    const updated =
      count === 0 || parseSourceReference(reference).startLine === undefined
        ? file.path
        : `${file.path}#L${file.first}-L${file.first + Math.max(1, count) - 1}`;
    return { revision: digest(next), reference: updated };
  }
}
