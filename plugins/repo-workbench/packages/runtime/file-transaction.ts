import { DatabaseSync } from 'node:sqlite';
import { closeSync, openSync, lstatSync } from 'node:fs';

/** SQLite owns crash recovery and writer exclusion; the callback owns its atomic file replacement. */
export function fileTransaction<T>(path: string, run: () => T): T {
  try {
    closeSync(openSync(path, 'wx', 0o600));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  if (lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile())
    throw new Error('Refusing an unsafe discussion transaction file');
  const database = new DatabaseSync(path);
  let acquired = false;
  try {
    database.exec('PRAGMA busy_timeout=0');
    try {
      database.exec('BEGIN IMMEDIATE');
      acquired = true;
    } catch {
      throw new Error(
        'Conflict: Another panel is updating this discussion. Retry after it finishes.',
      );
    }
    // No domain data is stored in this sidecar. An OS-released SQLite lock cannot orphan.
    return run();
  } finally {
    if (acquired) database.exec('ROLLBACK');
    database.close();
  }
}
