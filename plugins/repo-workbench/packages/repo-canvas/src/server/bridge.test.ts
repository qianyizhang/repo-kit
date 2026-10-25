import { describe, expect, it, vi } from 'vitest';
import { HostTestClient as Client } from '../../../../../mcp-app-runtime/tests/host-client.ts';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { CanvasBridge } from './bridge';
import { canvasMcp } from './mcp';
import { Repository } from './repository';
import type { ChatRequest } from '../model/document';
const context: ChatRequest = {
  document: {
    version: 3,
    title: 'Unsaved architecture',
    modules: [
      {
        id: 'root',
        parent: null,
        kind: 'system',
        name: 'Root',
        summary: 'Shared context',
        sources: [],
        x: 40,
        y: 20,
      },
    ],
    annotations: [],
    connections: [],
  },
  scope: 'root',
  selection: 'root',
  messages: [{ role: 'user', text: 'Explain this module' }],
};
describe('current-chat MCP bridge', () => {
  it('starts on demand over stdio and routes a discussion without a listening HTTP server', async () => {
    const root = mkdtempSync(join(tmpdir(), 'canvas-stdio-'));
    mkdirSync(join(root, '.repo-canvas'));
    const path = join(root, '.repo-canvas/architecture.json');
    const saved = JSON.stringify(context.document);
    writeFileSync(path, saved);
    const client = new Client({ name: 'stdio-host-test', version: '1' });
    try {
      execFileSync('git', ['init', '-q', root]);
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [fileURLToPath(new URL('./stdio.ts', import.meta.url)), '--repo', root],
          env: { ...process.env, XDG_CACHE_HOME: join(root, 'cache') },
        }),
      );
      const opened = await client.callTool({ name: 'canvas_open', arguments: {} });
      expect(opened.isError).not.toBe(true);
      const sent = await client.callTool({
        name: 'canvas_app',
        arguments: { request: { action: 'send', args: { canvasId: 'hosted', ...context } } },
      });
      const exchange = (sent.structuredContent as { value: { id: string } }).value;
      expect(exchange.id).toBeTruthy();
      const read = await client.callTool({
        name: 'canvas_request',
        arguments: { requestId: exchange.id },
      });
      expect(JSON.stringify(read.content)).toContain('Explain this module');
      const replied = await client.callTool({
        name: 'canvas_reply',
        arguments: { requestId: exchange.id, reply: 'Answered by the owning chat' },
      });
      expect(replied.isError).not.toBe(true);
      const received = await client.callTool({
        name: 'canvas_app',
        arguments: { request: { action: 'chat', args: { canvasId: 'hosted' } } },
      });
      expect((received.structuredContent as { value: unknown }).value).toMatchObject({
        status: 'answered',
        response: { reply: 'Answered by the owning chat' },
      });
      expect(readFileSync(path, 'utf8')).toBe(saved);
    } finally {
      await client.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('routes replies to the requesting tab and rejects late, duplicate and malformed proposals', async () => {
    const bridge = new CanvasBridge();
    const first = bridge.enqueue('tab-one', context);
    const second = bridge.enqueue('tab-two', context);
    const repository = {
      snapshot: () => ({ repo: '/test/repo', document: context.document }),
    } as Repository;
    const server = canvasMcp(bridge, repository);
    const client = new Client({ name: 'test-agent', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    await client.connect(b);
    try {
      const read = await client.callTool({
        name: 'canvas_request',
        arguments: { requestId: first.id },
      });
      expect(JSON.stringify(read.content)).toContain('Unsaved architecture');
      const malformed = await client.callTool({
        name: 'canvas_reply',
        arguments: { requestId: first.id, reply: 'Invalid proposal', proposal: { version: 0 } },
      });
      expect(malformed.isError).toBe(true);
      expect(bridge.current('tab-one')?.status).toBe('pending');
      bridge.cancel('tab-one', first.id);
      const late = await client.callTool({
        name: 'canvas_reply',
        arguments: { requestId: first.id, reply: 'Late' },
      });
      expect(late.isError).toBe(true);
      const answered = await client.callTool({
        name: 'canvas_reply',
        arguments: { requestId: second.id, reply: 'From the current chat' },
      });
      expect(answered.isError).not.toBe(true);
      expect(bridge.current('tab-two')?.response?.reply).toBe('From the current chat');
      expect(bridge.current('tab-one')?.response).toBeNull();
      const duplicate = await client.callTool({
        name: 'canvas_reply',
        arguments: { requestId: second.id, reply: 'Duplicate' },
      });
      expect(duplicate.isError).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });
});

it('keeps a fixed server target usable across stateless MCP connections', async () => {
  const root = mkdtempSync(join(tmpdir(), 'canvas-fixed-'));
  execFileSync('git', ['init', '-q', root]);
  const repository = new Repository(root);
  const bridge = new CanvasBridge();
  let contextId: string | undefined;
  try {
    for (let connection = 0; connection < 2; connection++) {
      const server = canvasMcp(bridge, repository);
      const client = new Client({ name: 'fixed-host-test', version: '1' });
      const [a, b] = InMemoryTransport.createLinkedPair();
      await server.connect(a);
      await client.connect(b);
      try {
        if (connection === 0) {
          const opened = await client.callTool({ name: 'canvas_open', arguments: { repo: root } });
          expect(opened.isError).not.toBe(true);
          contextId = (opened.structuredContent as { contextId: string }).contextId;
        } else {
          const state = await client.callTool({
            name: 'canvas_app',
            arguments: { contextId, request: { action: 'state', args: {} } },
          });
          expect(state.isError).not.toBe(true);
          expect((state.structuredContent as { value: { repo: string } }).value.repo).toBe(
            repository.root,
          );
          const other = await client.callTool({
            name: 'canvas_open',
            arguments: { repo: tmpdir() },
          });
          expect(other.isError).toBe(true);
          expect(JSON.stringify(other.content)).toContain('bound to');
        }
      } finally {
        await client.close();
        await server.close();
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('does not let a racing cancel overwrite an arriving answer', () => {
  const bridge = new CanvasBridge();
  const exchange = bridge.enqueue('race', context);
  const change = bridge.discussion.change.bind(bridge.discussion);
  vi.spyOn(bridge.discussion, 'change').mockImplementationOnce((update) => {
    change((value) => ({
      ...value,
      history: value.history.map((e) =>
        e.id === exchange.id
          ? { ...e, status: 'answered', response: { reply: 'Arrived', proposal: null } }
          : e,
      ),
    }));
    return change(update);
  });
  expect(() => bridge.cancel('race', exchange.id)).toThrow('no longer pending');
  expect(bridge.read(exchange.id)).toMatchObject({
    status: 'answered',
    response: { reply: 'Arrived' },
  });
});
