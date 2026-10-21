import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, mkdir, writeFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
const binary = process.env.REPO_WORKBENCH_CODEX_BIN;
if (!binary)
  throw new Error('Set REPO_WORKBENCH_CODEX_BIN to the desktop-bundled Codex executable.');
async function codex(cwd: string, codexHome: string) {
  const child = spawn(binary!, ['app-server', '--stdio'], {
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

const root = await mkdtemp('/private/tmp/canvas-native-metadata-');
const home = resolve(root, 'codex-home'),
  repo = resolve(root, 'repository');
await mkdir(home);
await mkdir(repo);
execFileSync('git', ['init', '-q', repo]);
const probe = resolve(root, 'probe.mjs');
await writeFile(
  probe,
  `import {McpServer} from ${JSON.stringify(resolve('node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js'))};
import {StdioServerTransport} from ${JSON.stringify(resolve('node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js'))};
const server=new McpServer({name:'metadata-probe',version:'1'});
server.registerTool('probe',{inputSchema:{},annotations:{readOnlyHint:true}},(_,extra)=>({content:[{type:'text',text:JSON.stringify({meta:extra._meta,serverCwd:process.cwd(),clientCapabilities:server.server.getClientCapabilities()})}]}));
await server.connect(new StdioServerTransport());`,
);
await writeFile(
  resolve(home, 'config.toml'),
  `[projects.${JSON.stringify(repo)}]\ntrust_level = "trusted"\n[mcp_servers.metadata_probe]\ncommand = ${JSON.stringify(process.execPath)}\nargs = [${JSON.stringify(probe)}]\ncwd = ${JSON.stringify(root)}\n`,
);
const host = await codex(root, home);
try {
  const started = await host.request<{ thread: { id: string } }>('thread/start', {
    cwd: repo,
    ephemeral: false,
  });
  const result = await host.request('mcpServer/tool/call', {
    threadId: started.thread.id,
    server: 'metadata_probe',
    tool: 'probe',
    arguments: {},
  });
  const thread = await host.request<{ thread: { cwd: string } }>('thread/read', {
    threadId: started.thread.id,
    includeTurns: false,
  });
  const records = [];
  for (const name of (await readdir(home)).filter((name) => /^state_\d+\.sqlite$/.test(name))) {
    const database = new DatabaseSync(resolve(home, name), { readOnly: true });
    try {
      records.push({
        database: name,
        row:
          database.prepare('SELECT cwd FROM threads WHERE id = ?').get(started.thread.id) ?? null,
      });
    } finally {
      database.close();
    }
  }
  const receipt = {
    threadId: started.thread.id,
    expectedCwd: repo,
    hostCwd: thread.thread.cwd,
    persistedWorkspace: records,
    result,
  };
  console.log(JSON.stringify(receipt, null, 2));
  await writeFile(resolve(root, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log('Receipt: ' + resolve(root, 'receipt.json'));
} finally {
  await host.close();
}
