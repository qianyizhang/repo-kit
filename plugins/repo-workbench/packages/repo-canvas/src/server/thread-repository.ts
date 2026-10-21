import { DatabaseSync } from 'node:sqlite';
import { readdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { execFileSync } from 'node:child_process';

/** Native per-call identity only; never infer the caller from process environment. */
export function callerThread(meta: Record<string, unknown> | undefined): string | undefined {
  const id = meta?.threadId ?? meta?.thread_id;
  if (meta?.threadId && meta.thread_id && meta.threadId !== meta.thread_id) return undefined;
  return typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id
    : undefined;
}

/** Codex-specific adapter. Unknown schemas, missing metadata and non-Git tasks use the picker. */
export function repositoryForThread(
  id: string,
  home = process.env.CODEX_HOME ?? join(homedir(), '.codex'),
): string | undefined {
  if (!callerThread({ threadId: id })) return undefined;
  try {
    const databases = readdirSync(home)
      .filter((name) => /^state_\d+\.sqlite$/.test(name))
      .sort((a, b) => Number(b.match(/\d+/)![0]) - Number(a.match(/\d+/)![0]));
    // Only the newest schema is authoritative. Do not revive a stale row from an older database.
    if (!databases.length) return undefined;
    const database = new DatabaseSync(join(home, databases[0]), { readOnly: true });
    let row;
    try {
      row = database.prepare('SELECT cwd FROM threads WHERE id = ?').get(id);
    } finally {
      database.close();
    }
    if (typeof row?.cwd !== 'string' || !isAbsolute(row.cwd)) return undefined;
    const cwd = realpathSync(row.cwd);
    return realpathSync(
      execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 2000,
      }).trim(),
    );
  } catch {
    return undefined;
  }
}
