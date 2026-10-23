import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  statSync,
} from 'node:fs';
import { fileTransaction } from '../../../runtime/file-transaction.ts';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { discussionSchema } from '../model/contracts.ts';
import { parseComments } from '../model/document.ts';
import type { z } from 'zod';
type Discussion = z.output<typeof discussionSchema>;
const empty = (): Discussion => ({ revision: 0, composer: '', comments: [], history: [] });
/** Local private state, partitioned by canonical repository and trusted host chat identity. */
export class DiscussionStore {
  private memory = empty();
  private file?: string;
  constructor(identity?: { repo: string; chat: string; directory?: string }) {
    if (identity)
      this.file = join(
        identity.directory ?? process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'),
        'repo-workbench',
        'discussions',
        createHash('sha256')
          .update(JSON.stringify([identity.repo, identity.chat]))
          .digest('hex') + '.json',
      );
  }
  read(): Discussion {
    if (!this.file) return structuredClone(this.memory);
    if (!existsSync(this.file)) return empty();
    if (statSync(this.file).size > 50_000_000)
      throw new Error('Local discussion storage is too large; repair it offline');
    const raw = readFileSync(this.file, 'utf8');
    return discussionSchema.parse(JSON.parse(raw));
  }
  change(change: (value: Discussion) => Discussion): Discussion {
    if (!this.file) {
      this.memory = { ...change(this.read()), revision: this.memory.revision + 1 };
      return this.read();
    }
    mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 });
    const file = this.file;
    return fileTransaction(file + '.sqlite', () => {
      const temporary = file + '.' + randomUUID() + '.tmp';
      try {
        const before = this.read();
        const next = discussionSchema.parse({ ...change(before), revision: before.revision + 1 });
        const serialized = JSON.stringify(next);
        if (Buffer.byteLength(serialized) > 50_000_000)
          throw new Error('Local discussion storage is full. Clear history before adding more.');
        writeFileSync(temporary, serialized, { mode: 0o600, flag: 'wx' });
        renameSync(temporary, file);
        return next;
      } finally {
        rmSync(temporary, { force: true });
      }
    });
  }
  write(revision: number, composer: string, comments: unknown) {
    return this.change((value) => {
      if (value.revision !== revision)
        throw new Error('Conflict: Discussion changed in another panel. Reload before editing.');
      return { ...value, composer, comments: parseComments(comments) };
    });
  }
  clear(revision: number) {
    return this.change((value) => {
      if (value.revision !== revision)
        throw new Error('Conflict: Discussion changed. Reload before clearing.');
      if (value.history.some((e) => e.status === 'pending'))
        throw new Error('Close pending requests before clearing history');
      return empty();
    });
  }
}
