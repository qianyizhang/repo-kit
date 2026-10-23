/** TEST ONLY: loopback integration host. The browser host forwards to a real stdio client. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { HostTestClient as Client } from './host-client.ts';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  CallToolRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
const client = new Client({ name: 'Example test host', version: '0.2.0' });
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../dist/server.mjs', import.meta.url))],
    stderr: 'inherit',
  }),
);
const token = randomUUID(),
  port = Number(process.env.PORT ?? 4390);
const requestSchema = z.discriminatedUnion('method', [
  CallToolRequestSchema,
  ReadResourceRequestSchema,
]);
const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="preview-token" content="${token}"><title>Example MCP App · Test host</title><style>
body{margin:0;background:#e4eae6;font:13px/1.5 system-ui;color:#173d37}header{padding:12px 20px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}header b{margin-right:auto}button,select{font:inherit;border:1px solid #9bafa6;background:#fff;border-radius:5px;padding:6px 10px}iframe{display:block;border:0;width:100%;height:calc(100vh - 150px);background:#f4f5f2}#host-status{padding:8px 20px;margin:0;background:#fff;white-space:pre-wrap;overflow-wrap:anywhere;max-height:160px;overflow:auto}label{display:flex;align-items:center;gap:5px}
</style></head><body><header><b>Test host · Real MCP server · Simulated conversation</b><button id="theme">Toggle theme</button><button id="teardown">Teardown</button><button id="reopen">Reopen</button><label>Messages<select id="message-mode"><option value="accept">Accept</option><option value="reject">Reject</option><option value="timeout">No reply (timeout)</option></select></label></header><p id="host-status" role="status">Starting MCP client…</p><div id="mount"></div><script src="/preview-host.js"></script></body></html>`;
const server = createServer((request, response) => {
  void (async () => {
    // Reject DNS rebinding and cross-origin calls to the local development service.
    if (request.headers.host !== `127.0.0.1:${port}`) {
      response.writeHead(403).end();
      return;
    }
    const path = new URL(request.url ?? '/', `http://127.0.0.1:${port}`).pathname;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method === 'GET' && path === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end(html);
      return;
    }
    if (request.method === 'GET' && path === '/fixtures') {
      response.setHeader('Content-Type', 'text/html');
      response.end(await readFile(new URL('../dist/app.html', import.meta.url)));
      return;
    }
    if (request.method === 'GET' && path === '/preview-host.js') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(await readFile(new URL('../.cache/browser-host.js', import.meta.url)));
      return;
    }
    if (
      request.method !== 'POST' ||
      request.headers['x-preview-token'] !== token ||
      (request.headers.origin && request.headers.origin !== `http://127.0.0.1:${port}`)
    ) {
      response.writeHead(403).end();
      return;
    }
    let raw = '';
    for await (const chunk of request) {
      raw += String(chunk);
      if (raw.length > 4000000) {
        response.writeHead(413).end();
        return;
      }
    }
    response.setHeader('Content-Type', 'application/json');
    if (path === '/bootstrap') {
      const tools = await client.listTools();
      await client.listResources();
      const entry = tools.tools.find((tool) => tool.name === 'example_open');
      const meta = z.object({ ui: z.object({ resourceUri: z.string() }) }).parse(entry?._meta);
      const resource = await client.readResource({ uri: meta.ui.resourceUri });
      const content = resource.contents.find(
        (c) => 'text' in c && c.mimeType === 'text/html;profile=mcp-app',
      );
      if (!content || !('text' in content)) throw new Error('Missing HTML resource');
      const result = await client.callTool({ name: 'example_open', arguments: {} });
      response.end(JSON.stringify({ html: content.text, result }));
      return;
    }
    if (path === '/rpc') {
      const message = requestSchema.parse(JSON.parse(raw));
      const result =
        message.method === 'tools/call'
          ? await client.callTool({
              ...message.params,
              _meta: { ...message.params._meta, threadId: '11111111-1111-4111-8111-111111111111' },
            })
          : await client.readResource(message.params);
      response.end(JSON.stringify(result));
      return;
    }
    response.writeHead(404).end();
  })().catch((error: unknown) => {
    response
      .writeHead(400, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: String(error) }));
  });
});
server.listen(port, '127.0.0.1', () =>
  console.log(`Example MCP App preview: http://127.0.0.1:${port}`),
);
const close = () => {
  server.close();
  void client.close().finally(() => process.exit(0));
};
process.on('SIGINT', close);
process.on('SIGTERM', close);
