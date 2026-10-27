import { execFileSync } from 'node:child_process';
import { codex } from './codex-client.ts';
import { mkdtemp, mkdir, writeFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
const binary = process.env.REPO_WORKBENCH_CODEX_BIN;
if (!binary)
  throw new Error('Set REPO_WORKBENCH_CODEX_BIN to the desktop-bundled Codex executable.');

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
const host = await codex(binary, root, home);
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
