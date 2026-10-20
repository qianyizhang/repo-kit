import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { Repository, documentName } from './repository';
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
it('saves annotations, reloads agent edits and rejects a stale user draft without overwriting them', () => {
  const { root, repo } = setup(),
    first = repo.snapshot();
  const saved = repo.save(
    {
      ...first.document,
      annotations: [{ id: 'one', target: 'src', text: 'Who owns this?', author: 'human' }],
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
      target: 'repo',
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
