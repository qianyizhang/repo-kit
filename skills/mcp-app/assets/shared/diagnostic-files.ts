import {
  appendFileSync,
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { snapshot } from "./diagnostic-payload.ts";

const UUID = /^[a-f0-9-]{36}$/;
const MAX_FILE_MIB = 2;
export const MAX_FILE_BYTES = MAX_FILE_MIB * 1024 * 1024;
const MAX_CAPTURES = 8;
const INACTIVE_SESSIONS = 8;
const INACTIVE_DAYS = 7;

type DiagnosticEvent = {
  source: "app" | "server";
  payload: ReturnType<typeof snapshot>;
};
const LOG_FILES = new Set([
  "session.json",
  "app.jsonl",
  "app.jsonl.1",
  "server.jsonl",
  "server.jsonl.1",
]);
const CAPTURE_FILE = /^capture-[a-f0-9-]{36}\.json$/;
export function pruneSessions(root: string, appId: string, now = Date.now()) {
  const inactive: { path: string; started: number }[] = [];
  for (const name of readdirSync(root)) {
    if (!UUID.test(name)) continue;
    const path = join(root, name);
    try {
      if (!lstatSync(path).isDirectory()) continue;
      // Only remove recognized, flat session directories.
      const children = readdirSync(path);
      if (
        !children.includes("session.json") ||
        children.some(
          (child) =>
            (!LOG_FILES.has(child) && !CAPTURE_FILE.test(child)) ||
            !lstatSync(join(path, child)).isFile(),
        )
      )
        continue;
      const raw = readFileSync(join(path, "session.json"), "utf8");
      let info: { owner?: string; pid?: number; started?: number } | null;
      try {
        info = JSON.parse(raw);
      } catch {
        continue;
      }
      if (
        info?.owner !== appId ||
        typeof info.pid !== "number" ||
        !Number.isInteger(info.pid) ||
        info.pid <= 0 ||
        typeof info.started !== "number" ||
        !Number.isFinite(info.started)
      )
        continue;
      try {
        process.kill(info.pid, 0);
        continue;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") continue;
      }
      inactive.push({ path, started: info.started });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  inactive.sort((a, b) => b.started - a.started);
  inactive.forEach((entry, index) => {
    if (
      index >= INACTIVE_SESSIONS ||
      now - entry.started > INACTIVE_DAYS * 86400_000
    )
      rmSync(entry.path, { recursive: true, force: true });
  });
}
export class DiagnosticFiles {
  readonly instance = randomUUID();
  readonly directory: string;
  error: string | undefined;
  readonly retentionError?: string;
  constructor(
    appId: string,
    root = process.env.MCP_APP_LOG_ROOT ??
      join(
        process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"),
        "mcp-apps",
      ),
  ) {
    const appRoot = resolve(root, appId);
    this.directory = join(appRoot, this.instance);
    try {
      mkdirSync(appRoot, { recursive: true, mode: 0o700 });
      if (lstatSync(appRoot).isSymbolicLink())
        throw new Error("Log app root must not be a symlink");
      mkdirSync(this.directory, { mode: 0o700 });
      writeFileSync(
        join(this.directory, "session.json"),
        JSON.stringify({
          owner: appId,
          pid: process.pid,
          started: Date.now(),
        }),
        { mode: 0o600, flag: "wx" },
      );
    } catch (error) {
      this.error = String(error);
      return;
    }
    try {
      pruneSessions(appRoot, appId);
    } catch (error) {
      this.retentionError = String(error);
    }
  }
  protected writeMetadata(event: DiagnosticEvent) {
    if (this.error) return;
    try {
      const file = join(this.directory, `${event.source}.jsonl`);
      const line =
        JSON.stringify({
          ...event,
          payload: {
            ...event.payload,
            text: "[payload is live only; not persisted]",
            omitted: true,
          },
        }) + "\n";
      if (
        existsSync(file) &&
        statSync(file).size + Buffer.byteLength(line) > MAX_FILE_BYTES
      ) {
        renameSync(file, `${file}.1`);
      }
      appendFileSync(file, line, { mode: 0o600 });
      chmodSync(file, 0o600);
    } catch (error) {
      this.error = String(error);
    }
  }
  protected writeCapture(
    interaction: string,
    events: readonly DiagnosticEvent[],
    completeness?: object,
  ) {
    if (!events.length) throw new Error("Interaction unavailable or expired");
    if (this.error) throw new Error("Diagnostic storage unavailable");
    if (
      readdirSync(this.directory).filter((name) => CAPTURE_FILE.test(name))
        .length >= MAX_CAPTURES
    )
      throw new Error(
        `Capture limit reached: ${MAX_CAPTURES} per server session`,
      );
    const savedAt = new Date().toISOString();
    const body = JSON.stringify(
      {
        instance: this.instance,
        interaction,
        savedAt,
        events,
        completeness,
      },
      null,
      2,
    );
    if (Buffer.byteLength(body) > MAX_FILE_BYTES)
      throw new Error(
        `Interaction exceeds the ${MAX_FILE_MIB} MiB capture limit; no capture saved`,
      );
    const path = join(this.directory, `capture-${randomUUID()}.json`);
    writeFileSync(path, body, { mode: 0o600, flag: "wx" });
    return { path, savedAt, eventCount: events.length };
  }
  status() {
    return {
      directory: this.directory,
      health: this.error ? "memory-only" : "recording",
      error: this.error ?? null,
      retentionError: this.retentionError ?? null,
      payloads:
        "Metadata on disk; credential-masked payloads in bounded memory. Closing/restarting can lose payloads. Save diagnostic capture persists one interaction explicitly.",
      captures: `Up to ${MAX_CAPTURES} per session, ${MAX_FILE_MIB} MiB each; same session retention; no automatic capture`,
      retention: `${MAX_FILE_MIB} MiB/source + one rotated file; startup keeps ${INACTIVE_SESSIONS} inactive sessions for at most ${INACTIVE_DAYS} days; active sessions excluded`,
      coverage:
        "SDK/application boundaries only; host internals and assistant replies unobserved",
    };
  }
}
