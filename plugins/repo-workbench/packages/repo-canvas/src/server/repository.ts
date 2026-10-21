import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, resolve, sep } from 'node:path';
import {
  parseDocument,
  sourcePath,
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
    version: 1,
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
    return {
      document: parseDocument(JSON.parse(raw) as unknown),
      revision: digest(raw),
      repo: this.root,
      saved,
    };
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
  source(value: unknown): { path: string; content: string; truncated: boolean } {
    const path = sourcePath(value);
    if (!repositoryFiles(this.root).includes(path))
      throw new Error('Source preview is limited to Git-visible files (tracked or non-ignored)');
    const absolute = realpathSync(resolve(this.root, path));
    if (!absolute.startsWith(this.root + sep))
      throw new Error('Source resolves outside the repository');
    if (statSync(absolute).size > 500_000) throw new Error('Source preview is limited to 500 KB');
    const content = readFileSync(absolute, 'utf8');
    if (content.includes('\0')) throw new Error('Binary source cannot be previewed');
    return { path, content: content.slice(0, 40000), truncated: content.length > 40000 };
  }
}
