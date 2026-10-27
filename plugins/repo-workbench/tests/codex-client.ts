import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export async function codex(binary: string, cwd: string, codexHome: string) {
  const child = spawn(binary, ['app-server', '--stdio'], {
    cwd,
    env: { ...process.env, CODEX_HOME: codexHome },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stderr.resume(); // No personal config or parser excerpts in test output.
  const pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  let sequence = 0;
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    const message = JSON.parse(line) as {
      id?: number;
      result?: unknown;
      error?: { message: string };
    };
    if (message.id === undefined) return;
    const item = pending.get(message.id);
    if (!item) return;
    clearTimeout(item.timer);
    pending.delete(message.id);
    if (message.error) item.reject(new Error(message.error.message));
    else item.resolve(message.result);
  });
  const stopped = new Promise<void>((done) =>
    child.once('close', () => {
      for (const item of pending.values()) {
        clearTimeout(item.timer);
        item.reject(new Error('Codex exited'));
      }
      pending.clear();
      done();
    }),
  );
  child.on('error', () => {
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error('Cannot launch the supplied Codex binary'));
    }
    pending.clear();
  });
  async function request<T>(method: string, params: object): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Codex request timed out: ${method}`));
      }, 15000);
      pending.set(id, { resolve: (value) => resolve(value as T), reject, timer });
      child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }
  await request('initialize', {
    clientInfo: { name: 'repo_workbench_test', version: '1' },
    capabilities: { experimentalApi: true },
  });
  child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
  return {
    request,
    async close() {
      child.stdin.end();
      child.kill('SIGTERM');
      await stopped;
      lines.close();
    },
  };
}
