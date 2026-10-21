import { expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { realpathSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { callerThread, repositoryForThread } from './thread-repository';

it('resolves only the exact native caller from the newest schema and canonicalizes its Git checkout', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'canvas-thread-')));
  const id = '11111111-1111-4111-8111-111111111111';
  try {
    const repo = join(root, 'repo');
    mkdirSync(join(repo, 'nested'), { recursive: true });
    execFileSync('git', ['init', '-q', repo]);
    const db = new DatabaseSync(join(root, 'state_5.sqlite'));
    db.exec('CREATE TABLE threads (id TEXT PRIMARY KEY, cwd TEXT)');
    db.prepare('INSERT INTO threads VALUES (?, ?)').run(id, join(repo, 'nested'));
    db.close();
    expect(repositoryForThread(id, root)).toBe(repo);
    expect(repositoryForThread(id.replace('1111-', '2222-'), root)).toBeUndefined();
    expect(repositoryForThread('../private', root)).toBeUndefined();
    expect(callerThread({ threadId: id, thread_id: 'different' })).toBeUndefined();
    expect(callerThread({ 'openai/session': id })).toBeUndefined();
    expect(callerThread({ threadId: id })).toBe(id);
    const next = new DatabaseSync(join(root, 'state_6.sqlite'));
    next.exec('CREATE TABLE incompatible (id TEXT)');
    next.close();
    expect(repositoryForThread(id, root)).toBeUndefined();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
