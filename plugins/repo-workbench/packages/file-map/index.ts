import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, resolve } from 'node:path';
import { z } from 'zod';
import { asset } from '../runtime/assets.ts';

export interface FileRow {
  path: string;
  oid: string;
  mode: string;
  size: number | null;
  changes: string[];
  nature: string;
  basis: string;
  action: string;
  reason: string;
  evidence: string[];
  copies: number;
}
export interface Inventory {
  repo: string;
  head: string;
  created: string;
  files: FileRow[];
  staged_deletions: string[];
}

function git(root: string, args: string[], input?: string): string {
  const bytes = execFileSync('git', ['--no-optional-locks', '-C', root, ...args], {
    input,
    maxBuffer: 128 * 1024 * 1024,
    timeout: 60_000,
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  // Refuse lossy path decoding rather than joining unrelated Git identities.
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
const names = (value: string) => new Set(value.split('\0').filter(Boolean));
const hint = 'Path hint; content and consumers not reviewed';

function nature(path: string, mode: string): [string, string] {
  if (mode === '120000') return ['Symlink', 'Git mode; target not followed'];
  if (mode === '160000') return ['Submodule', 'Git mode; nested files excluded'];
  const parts = path.toLowerCase().split('/');
  const name = parts.at(-1)!;
  const extension = extname(name);
  const has = (...values: string[]) => values.some((value) => parts.includes(value));
  const rules: [string, boolean][] = [
    ['License', /^(license|copying|notice)/.test(name)],
    [
      'Dependency',
      /(lock\.(json|yaml|yml)|\.lock)$/.test(name) ||
        [
          'package.json',
          'pyproject.toml',
          'cargo.toml',
          'go.mod',
          'requirements.txt',
          'gemfile',
        ].includes(name),
    ],
    ['Fixture', has('fixtures', 'samples', 'testdata', '__fixtures__')],
    ['Test', has('tests', 'test', '__tests__') || /^test_|\.(test|spec)\./.test(name)],
    ['Evidence', has('evidence', 'findings', 'experiments', 'datasets', 'probes', 'results')],
    ['Decision', has('adr', 'decisions')],
    ['Process record', has('reviews', 'handoffs', '.artifacts') || extension === '.log'],
    [
      'Generated output',
      has('dist', 'build', 'generated', 'coverage') || name.includes('.generated.'),
    ],
    [
      'Asset',
      [
        '.png',
        '.jpg',
        '.jpeg',
        '.svg',
        '.gif',
        '.mp4',
        '.webm',
        '.pdf',
        '.woff2',
        '.blend',
        '.glb',
      ].includes(extension),
    ],
    ['Documentation', ['.md', '.mdx', '.rst', '.txt'].includes(extension)],
    [
      'Automation',
      has('.github', '.githooks', 'scripts') || ['makefile', 'dockerfile'].includes(name),
    ],
    [
      'Configuration',
      has('configs', 'config') ||
        name.includes('config.') ||
        ['.toml', '.yaml', '.yml', '.ini', '.cfg'].includes(extension) ||
        name.startsWith('.'),
    ],
    ['Structured data', ['.json', '.jsonl', '.csv', '.tsv', '.parquet'].includes(extension)],
    [
      'Source',
      [
        '.py',
        '.js',
        '.ts',
        '.tsx',
        '.astro',
        '.jsx',
        '.mts',
        '.cjs',
        '.swift',
        '.rs',
        '.go',
        '.c',
        '.h',
        '.cpp',
        '.css',
        '.html',
        '.sh',
        '.jinja',
      ].includes(extension),
    ],
  ];
  return [rules.find(([, matches]) => matches)?.[0] ?? 'Unknown', hint];
}

export function scan(repository: string): Inventory {
  const root = git(repository, ['rev-parse', '--show-toplevel']).replace(/\n$/, '');
  const snapshot = () => ({
    head: git(root, ['rev-parse', '--revs-only', 'HEAD']).trim(),
    index: git(root, ['ls-files', '--stage', '-z']),
    staged: git(root, [
      'diff',
      '--cached',
      '--no-ext-diff',
      '--name-only',
      '-z',
      '--no-renames',
      '--',
    ]),
    unstaged: git(root, ['diff', '--no-ext-diff', '--name-only', '-z', '--no-renames', '--']),
  });
  const before = snapshot();
  const staged = names(before.staged),
    unstaged = names(before.unstaged);
  const entries = new Map<string, { mode: string; oid: string; stage: string }[]>();
  for (const record of names(before.index)) {
    const tab = record.indexOf('\t');
    const [mode, oid, stage] = record.slice(0, tab).split(' ');
    const path = record.slice(tab + 1);
    const rows = entries.get(path) ?? [];
    rows.push({ mode, oid, stage });
    entries.set(path, rows);
  }
  const blobs = [
    ...new Set(
      [...entries.values()]
        .flat()
        .filter((row) => row.mode !== '160000')
        .map((row) => row.oid),
    ),
  ];
  const sizes = new Map<string, number>();
  if (blobs.length) {
    for (const line of git(
      root,
      ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
      blobs.join('\n') + '\n',
    )
      .trim()
      .split('\n')) {
      const [oid, kind, size] = line.split(' ');
      if (kind !== 'blob' || !size)
        throw new Error(
          `Indexed object unavailable: ${oid} (${kind}); fetch it explicitly before scanning`,
        );
      sizes.set(oid, Number(size));
    }
  }
  const files: FileRow[] = [...entries]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, rows]) => {
      const { mode, oid, stage } = rows[0];
      const conflict = rows.length !== 1 || stage !== '0';
      const [label, basis] = nature(path, mode);
      return {
        path,
        oid: conflict ? '' : oid,
        mode,
        size: conflict ? null : (sizes.get(oid) ?? null),
        changes: [
          ...(staged.has(path) ? ['staged'] : []),
          ...(unstaged.has(path) ? ['unstaged'] : []),
          ...(conflict ? ['conflict'] : []),
        ],
        nature: label,
        basis,
        action: 'unreviewed',
        reason: '',
        evidence: [],
        copies: 1,
      };
    });
  const counts = new Map<string, number>();
  for (const row of files)
    if (row.size && row.oid)
      counts.set(row.oid + row.mode, (counts.get(row.oid + row.mode) ?? 0) + 1);
  for (const row of files) row.copies = counts.get(row.oid + row.mode) ?? 1;
  if (JSON.stringify(before) !== JSON.stringify(snapshot()))
    throw new Error('Git state changed during scan; rerun after the active writer finishes');
  return {
    repo: root,
    head: before.head || 'unborn',
    created: new Date().toISOString(),
    files,
    staged_deletions: [...staged].filter((path) => !entries.has(path)).sort(),
  };
}

const text = z.string().trim().min(1);
const reviewSchema = z.record(
  z.string(),
  z.strictObject({
    oid: text,
    mode: text,
    nature: text,
    action: z.enum(['keep', 'inspect', 'consolidate', 'remove']),
    reason: text,
    evidence: z.array(text).min(1),
  }),
);
export function applyReviews(inventory: Inventory, input: unknown) {
  const reviews = reviewSchema.parse(input);
  const files = new Map(inventory.files.map((row) => [row.path, row]));
  for (const [path, review] of Object.entries(reviews)) {
    const row = files.get(path);
    if (!row) throw new Error(`Unknown indexed path: ${path}`);
    if (!row.oid || row.oid !== review.oid || row.mode !== review.mode)
      throw new Error(`Stale or conflicted file identity: ${path}`);
    if (row.changes.length && ['consolidate', 'remove'].includes(review.action))
      throw new Error(`Pending changes block a destructive proposal: ${path}`);
  }
  for (const [path, review] of Object.entries(reviews))
    Object.assign(files.get(path)!, review, {
      basis: 'Reviewed; evidence supplied by report author',
    });
}

const escape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
export async function render(inventory: Inventory): Promise<string> {
  const rows = inventory.files
    .map(
      (row) =>
        '<tr>' +
        [
          row.path,
          row.nature,
          row.size === null ? 'unknown' : row.size.toLocaleString('en-US'),
          row.action,
          [row.basis, ...row.changes, row.reason, ...row.evidence].join('; '),
        ]
          .map((value) => `<td>${escape(value)}</td>`)
          .join('') +
        '</tr>',
    )
    .join('');
  const data = JSON.stringify(inventory)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
  // Replacers keep literal $ sequences in filenames and review text intact.
  return (await asset('file-map.html'))
    .replace(/\/\*INVENTORY\*\/\s*null/, () => data)
    .replace('<!--STATIC_ROWS-->', () => rows);
}

export async function exportFileMap(options: { repo: string; out?: string; reviews?: string }) {
  const inventory = scan(options.repo);
  if (options.reviews) applyReviews(inventory, JSON.parse(await readFile(options.reviews, 'utf8')));
  const html = await render(inventory);
  const out = options.out
    ? resolve(options.out)
    : await mkdtemp(resolve(tmpdir(), 'workbench-file-map-'));
  if (options.out) {
    // Atomic final-directory creation rejects existing files, directories and symlinks.
    await mkdir(resolve(out, '..'), { recursive: true });
    await mkdir(out);
  }
  const reviewDate = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  await writeFile(resolve(out, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n', {
    flag: 'wx',
  });
  await writeFile(resolve(out, 'report.html'), html, { flag: 'wx' });
  await writeFile(
    resolve(out, 'README.md'),
    `# Repository file map\n\nSource: ${inventory.repo} at ${inventory.head}.\nCaptured: ${inventory.created}.\n\nResult: ${inventory.files.length} indexed paths; open [report](report.html).\nScope: indexed blob bytes, not working-tree or Git-history size. Untracked and ignored files excluded. LFS sizes describe indexed pointer blobs, not hydrated assets. Path classifications are hints; supplied reviews are author judgments. No source file contents are included.\n\nValidation: index and changed-path sets were stable during capture; supplied reviews passed path and identity checks. Content, consumers and browser behavior require separate review.\n\nRetention: active file review; review by ${reviewDate}. Retire after decisions reach their owners.\n`,
    { flag: 'wx' },
  );
  return {
    repo: inventory.repo,
    head: inventory.head,
    file: resolve(out, 'report.html'),
    inventory: resolve(out, 'inventory.json'),
    paths: inventory.files.length,
    indexedBytes: inventory.files.reduce((sum, row) => sum + (row.size ?? 0), 0),
    reviewed: inventory.files.filter((row) => row.action !== 'unreviewed').length,
    pending: inventory.files.filter((row) => row.changes.length).length,
  };
}

export async function runCli(args: string[]) {
  const options: { repo: string; out?: string; reviews?: string } = { repo: process.cwd() };
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!['--repo', '--out', '--reviews'].includes(key) || !args[i + 1])
      throw new Error('Use file-map [--repo DIR] [--out NEW_DIR] [--reviews FILE]');
    const value = resolve(args[++i]);
    if (key === '--repo') options.repo = value;
    else if (key === '--out') options.out = value;
    else options.reviews = value;
  }
  console.log(JSON.stringify(await exportFileMap(options)));
}
