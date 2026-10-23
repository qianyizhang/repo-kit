import { expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { realpathSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canvasMcp } from './mcp';

it('automatically binds per-call metadata, isolates panels and restores an explicit target after restart', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'canvas-connect-')));
  execFileSync('git', ['init', '-q', root]);
  const threadId = '11111111-1111-4111-8111-111111111111';
  const panelId = '22222222-2222-4222-8222-222222222222';
  async function start() {
    const server = canvasMcp(undefined, undefined, undefined, (id) =>
      id === threadId ? root : undefined,
    );
    const client = new Client({ name: 'connect-test', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    await client.connect(b);
    const connect = async (
      args: { panelId?: string; repo?: string; contextId?: string } = {},
      metadata: Record<string, unknown> = { threadId },
    ) => {
      const { contextId, ...selection } = args;
      const result = await client.callTool({
        name: 'canvas_app',
        arguments: { contextId, request: { action: 'connect', args: { panelId, ...selection } } },
        _meta: metadata,
      });
      expect(result.isError).not.toBe(true);
      return (
        result.structuredContent as {
          value: { target: { contextId: string; repo: string } | null };
        }
      ).value;
    };
    return { client, server, connect };
  }
  let host = await start();
  try {
    const first = await host.connect();
    expect(first.target?.repo).toBe(root);
    expect(await host.connect()).toEqual(expect.objectContaining({ target: first.target }));
    expect(
      (await host.connect({ panelId: '33333333-3333-4333-8333-333333333333' })).target?.contextId,
    ).not.toBe(first.target?.contextId);
    const missing = await host.client.callTool({
      name: 'canvas_app',
      arguments: { request: { action: 'connect', args: { panelId } } },
      _meta: {},
    });
    expect(missing.isError).toBe(true);
    expect(missing._meta?.['repo-kit/error']).toBe('forbidden');
    const crossed = await host.client.callTool({
      name: 'canvas_app',
      arguments: { contextId: first.target!.contextId, request: { action: 'state', args: {} } },
      _meta: { threadId: '44444444-4444-4444-8444-444444444444' },
    });
    expect(crossed.isError).toBe(true);
    await host.client.close();
    await host.server.close();
    host = await start();
    const recovered = await host.connect({ contextId: first.target!.contextId, repo: root });
    expect(recovered.target?.repo).toBe(root);
    expect(recovered.target?.contextId).not.toBe(first.target?.contextId);
  } finally {
    await host.client.close();
    await host.server.close();
    rmSync(root, { recursive: true, force: true });
  }
});
