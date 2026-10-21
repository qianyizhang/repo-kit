import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  chmodSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { Repository, documentName } from './repository';
import { createHash } from 'node:crypto';
const roots: string[] = [];
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'repo-canvas-test-'));
  roots.push(root);
  execFileSync('git', ['init', '-q', root]);
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/main.ts'), 'export const answer = 42;');
  execFileSync('git', ['add', 'src/main.ts'], { cwd: root });
  return { root, repo: new Repository(root) };
}
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
it('discovers dynamic routes, Unicode, spaces, long paths and root-name collisions with stable IDs', () => {
  const { root, repo } = setup();
  const paths = [
    'src/pages/exhibits/[project]',
    '中文/child',
    'with space/child',
    'repo/child',
    'x'.repeat(181),
  ];
  // A literal directory can look like one of our generated identifiers.
  paths.push(`dir-${createHash('sha256').update('中文').digest('hex')}`);
  for (const path of paths) {
    mkdirSync(join(root, path), { recursive: true });
    writeFileSync(join(root, path, 'index.ts'), 'export const value = 1;');
  }
  const first = repo.snapshot();
  expect(repo.snapshot()).toEqual(first);
  for (const path of paths) {
    const module = first.document.modules.find(
      (m) => m.name === path.split('/').at(-1) && m.sources.includes(`${path}/index.ts`),
    );
    expect(module?.sources).toContain(`${path}/index.ts`);
    expect(repo.source(`${path}/index.ts`).content).toContain('value');
  }
  const unicode = first.document.modules.find((m) => m.name === '中文')!;
  expect(
    first.document.modules.find(
      (m) => m.sources.includes('中文/child/index.ts') && m.name === 'child',
    )?.parent,
  ).toBe(unicode.id);
  const saved = repo.save(first.document, first.revision);
  expect(repo.snapshot()).toEqual(saved);
  expect(new Set(saved.document.modules.map((m) => m.id)).size).toBe(saved.document.modules.length);
});
it('saves annotations, reloads agent edits and rejects a stale user draft without overwriting them', () => {
  const { root, repo } = setup(),
    first = repo.snapshot();
  const saved = repo.save(
    {
      ...first.document,
      annotations: [
        { id: 'one', target: { kind: 'node', id: 'src' }, text: 'Who owns this?', author: 'human' },
      ],
    },
    first.revision,
  );
  expect(saved.saved).toBe(true);
  const external = { ...saved.document, title: 'Agent revision' };
  writeFileSync(join(root, documentName), JSON.stringify(external));
  expect(repo.snapshot().document.title).toBe('Agent revision');
  expect(() => repo.save(first.document, saved.revision)).toThrow('Conflict');
  expect(JSON.parse(readFileSync(join(root, documentName), 'utf8'))).toEqual(external);
  expect(repo.snapshot().document.annotations[0].text).toBe('Who owns this?');
});
it('limits source inspection and refuses architecture symlink writes outside the repo', () => {
  const { root, repo } = setup();
  expect(repo.source('src/main.ts').content).toContain('42');
  expect(() => repo.source('../private')).toThrow('relative');
  writeFileSync(join(root, '.gitignore'), 'private.txt\n');
  writeFileSync(join(root, 'private.txt'), 'private');
  expect(() => repo.source('private.txt')).toThrow('Git-visible');
  symlinkSync(tmpdir(), join(root, '.repo-canvas'));
  expect(() => repo.snapshot()).toThrow('symlink');
});
it('rejects an oversized encoded document before replacing a readable save', () => {
  const { repo } = setup();
  const initial = repo.snapshot();
  const saved = repo.save(initial.document, initial.revision);
  const oversized = {
    ...saved.document,
    annotations: Array.from({ length: 100 }, (_, i) => ({
      id: `note-${i}`,
      target: { kind: 'node', id: 'repo' },
      author: 'human' as const,
      text: '界'.repeat(12000),
    })),
  };
  expect(() => repo.save(oversized, saved.revision)).toThrow('2 MB');
  expect(repo.snapshot()).toEqual(saved);
});
it('refreshes unsaved directory discovery while preserving drafts and curated maps', () => {
  const { root, repo } = setup();
  const first = repo.snapshot();
  mkdirSync(join(root, 'new-module'));
  writeFileSync(join(root, 'new-module/current.ts'), 'export const current = 1;');
  const fresh = repo.snapshot();
  expect(fresh.document.modules.find((m) => m.id === 'new-module')?.sources).toEqual([
    'new-module/current.ts',
  ]);
  expect(() => repo.save(first.document, first.revision)).toThrow('Conflict');
  const saved = repo.save(fresh.document, fresh.revision);
  rmSync(join(root, 'new-module'), { recursive: true });
  expect(repo.snapshot()).toEqual(saved);
});
it('keeps later top-level owners visible when early directories exhaust discovery', () => {
  const { root, repo } = setup();
  for (let i = 0; i < 520; i++) {
    mkdirSync(join(root, 'archive', `old-${i}`), { recursive: true });
    writeFileSync(join(root, 'archive', `old-${i}`, 'record.md'), 'old');
  }
  mkdirSync(join(root, 'presentation'));
  writeFileSync(join(root, 'presentation', 'view.tsx'), 'view');
  mkdirSync(join(root, 'tests'));
  writeFileSync(join(root, 'tests', 'check.py'), '# check');
  const map = repo.snapshot().document;
  expect(map.modules.filter((m) => m.parent === 'repo').map((m) => m.id)).toEqual([
    'archive',
    'presentation',
    'src',
    'tests',
  ]);
  expect(map.modules[0].summary).toContain('Showing 480 of 524');
  expect(map.modules.length).toBeLessThanOrEqual(500);
});
it('returns repair metadata for old or malformed maps and replaces only on explicit revision-checked save', () => {
  const { root, repo } = setup();
  mkdirSync(join(root, '.repo-canvas'));
  const path = join(root, documentName);
  writeFileSync(path, '{"version":2,"keep":"authored"}');
  const old = readFileSync(path, 'utf8');
  const state = repo.snapshot();
  expect(state.problem).toContain('requires v3');
  expect(state.document.version).toBe(3);
  expect(readFileSync(path, 'utf8')).toBe(old);
  writeFileSync(path, 'broken external revision');
  expect(() => repo.save(state.document, state.revision)).toThrow('Conflict');
  const broken = repo.snapshot();
  expect(broken.problem).toBeTruthy();
  const saved = repo.save(broken.document, broken.revision);
  expect(saved.problem).toBeUndefined();
  expect(saved.saved).toBe(true);
});
it('edits only referenced line blocks, preserves surrounding CRLF text, and rejects stale or unsafe writes', () => {
  const { root, repo } = setup();
  const path = join(root, 'src/main.ts');
  writeFileSync(path, '// before\r\nconst value = 1;\r\n// after\r\n');
  chmodSync(path, 0o664);
  const reference = 'src/main.ts#L2-L2';
  const state = repo.snapshot();
  const document = {
    ...state.document,
    modules: state.document.modules.map((m) => ({ ...m, sources: [reference] })),
  };
  const block = repo.source(reference);
  expect(block.content).toBe('const value = 1;\r\n');
  expect(block.startLine).toBe(2);
  expect(() =>
    repo.saveSource(reference, block.revision, 'const value = 2;\n', state.document),
  ).toThrow('explicitly referenced');
  repo.saveSource(reference, block.revision, 'const value = 2;\n', document);
  expect(statSync(path).mode & 0o777).toBe(0o664);
  expect(readFileSync(path, 'utf8')).toBe('// before\r\nconst value = 2;\r\n// after\r\n');
  expect(() => repo.saveSource(reference, block.revision, 'bad\n', document)).toThrow('Conflict');
  expect(() => repo.source('src/main.ts#L99-L100')).toThrow('outside');
  symlinkSync(path, join(root, 'src/link.ts'));
  expect(() => repo.source('src/link.ts')).toThrow('symlink');
  writeFileSync(join(root, 'src/binary.ts'), Buffer.from([0xff, 0]));
  expect(() => repo.source('src/binary.ts')).toThrow();
});
