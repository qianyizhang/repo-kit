import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { BUILD, VERSION } from '../model/build.ts';

type Details = {
  repo?: string;
  contextId?: string;
  bindingId?: string;
  error?: string;
  threadId?: string;
  metadataKeys?: string[];
  panelId?: string;
  reason?: string;
};
export function connectionLogPath() {
  return resolve(
    process.env.XDG_CACHE_HOME ?? process.env.XDG_CONFIG_HOME ?? resolve(homedir(), '.cache'),
    'repo-workbench/canvas/connection.jsonl',
  );
}

/** Bounded metadata only: never record source, map, draft, or chat payloads. */
export class ConnectionDiagnostics {
  readonly serverId = randomUUID();
  readonly startedAt = new Date().toISOString();
  private events: Array<Details & { time: string; event: string }> = [];
  private fileError: string | undefined;
  private file: string | undefined;
  constructor(file?: string) {
    this.file = file;
  }
  record(event: string, details: Details = {}) {
    const entry = { time: new Date().toISOString(), event, ...details };
    if (entry.error) entry.error = entry.error.slice(0, 2000);
    this.events.push(entry);
    this.events = this.events.slice(-200);
    if (!this.file) return;
    try {
      mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 });
      // One current file and one previous file, shared by local server instances.
      if ((statSync(this.file, { throwIfNoEntry: false })?.size ?? 0) > 512 * 1024)
        renameSync(this.file, this.file + '.1');
      appendFileSync(
        this.file,
        JSON.stringify({
          version: VERSION,
          build: BUILD,
          serverId: this.serverId,
          pid: process.pid,
          ...entry,
        }) + '\n',
        { mode: 0o600 },
      );
      this.fileError = undefined;
    } catch (error) {
      // Diagnostics must never prevent a repository from opening.
      this.fileError = String(error);
    }
  }
  snapshot() {
    return {
      version: VERSION,
      build: BUILD,
      startedAt: this.startedAt,
      serverId: this.serverId,
      pid: process.pid,
      file: this.file ?? null,
      fileError: this.fileError ?? null,
      events: [...this.events],
    };
  }
}
