/** Real Codex app-server → configured MCP process. No browser fixture or model turn.
 * Uses the installed plugin configuration; no direct MCP override is injected. */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { z } from 'zod';
import { snapshotSchema } from '../src/contracts.ts';

const binary = process.env.EXAMPLE_CODEX_BIN;
if (!binary) throw new Error('Set EXAMPLE_CODEX_BIN to the desktop-bundled Codex binary.');
const repo = resolve(import.meta.dirname, '../../..');
const child = spawn(binary, ['app-server', '--stdio'], {
  cwd: repo,
  env: process.env,
  stdio: ['pipe', 'pipe', 'pipe'],
});
child.stderr.resume();
const pending = new Map<
  number,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
let sequence = 0;
const envelope = z.object({
  id: z.number().optional(),
  result: z.unknown().optional(),
  error: z.object({ message: z.string() }).optional(),
});
const lines = createInterface({ input: child.stdout });
function fail(error: Error) {
  for (const item of pending.values()) {
    clearTimeout(item.timer);
    item.reject(error);
  }
  pending.clear();
}
lines.on('line', (line) => {
  try {
    const message = envelope.parse(JSON.parse(line));
    if (message.id === undefined) return;
    const item = pending.get(message.id);
    if (!item) return;
    clearTimeout(item.timer);
    pending.delete(message.id);
    if (message.error) item.reject(new Error(message.error.message));
    else item.resolve(message.result);
  } catch (error) {
    fail(new Error(`Invalid native protocol output: ${String(error)}`));
  }
});
child.on('error', (error) => fail(error));
const stopped = new Promise<void>((done) =>
  child.once('close', () => {
    fail(new Error('Codex exited'));
    done();
  }),
);
function request(method: string, params: object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out: ${method}`));
    }, 20000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
}
const toolResult = z.object({ isError: z.boolean().nullish(), structuredContent: z.unknown() });
try {
  await request('initialize', {
    clientInfo: { name: 'example_mcp_native_probe', version: '1' },
    capabilities: { experimentalApi: true },
  });
  child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
  const started = z
    .object({ thread: z.object({ id: z.string() }) })
    .parse(await request('thread/start', { cwd: repo, ephemeral: true }));
  const threadId = started.thread.id;
  const inventory = z
    .object({ data: z.array(z.object({ name: z.string(), pluginId: z.string().nullish() })) })
    .parse(
      await request('mcpServerStatus/list', { threadId, detail: 'toolsAndAuthOnly', limit: 100 }),
    );
  const installed = inventory.data.find((item) => item.pluginId === 'example-mcp-app@personal');
  if (!installed) throw new Error('Example MCP App not discovered as an installed personal plugin');
  const server = installed.name;
  const call = async (tool: string, args: object = {}) =>
    toolResult.parse(
      await request('mcpServer/tool/call', { threadId, server, tool, arguments: args }),
    );
  const opened = await call('example_open');
  const identity = z
    .object({ uri: z.string(), build: z.string(), instance: z.string() })
    .parse(opened.structuredContent);
  const resource = z
    .object({
      contents: z.array(
        z.object({ uri: z.string(), mimeType: z.string().nullish(), text: z.string() }),
      ),
    })
    .parse(await request('mcpServer/resource/read', { threadId, server, uri: identity.uri }));
  if (
    !resource.contents.some(
      (item) =>
        item.uri === identity.uri &&
        item.mimeType === 'text/html;profile=mcp-app' &&
        item.text.includes('Follow one interaction'),
    )
  )
    throw new Error('Native host did not read the expected app resource');
  const value = `native-probe-${Date.now()}`;
  const echo = await call('example_echo', { text: value });
  if (z.object({ echo: z.string() }).parse(echo.structuredContent).echo !== value)
    throw new Error('Echo did not round-trip');
  const trace = snapshotSchema.parse((await call('example_trace')).structuredContent);
  if (trace.instance !== identity.instance) throw new Error('Server instance changed during probe');
  console.log(
    JSON.stringify(
      {
        verified: 'Real desktop-bundled Codex app-server → installed personal plugin',
        plugin: installed,
        binary,
        identity,
        checks: [
          'native tool invocation',
          'native HTML resource read',
          'unique echo round-trip',
          'same-instance live server trace',
        ],
        methods: [...new Set(trace.events.map((event) => event.method))],
        notVerified: [
          'active desktop iframe',
          'ui/message delivery to a real conversation',
          'model response',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  child.stdin.end();
  child.kill('SIGTERM');
  await stopped;
  lines.close();
}
