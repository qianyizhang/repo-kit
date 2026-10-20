import { test, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canvasMcp } from './mcp.ts';
import type { Architecture, Snapshot } from '../model/document.ts';
test('two repositories and two canvases in the same repository keep targets, drafts and requests isolated', async () => {
  const roots = ['one', 'two'].map((name) => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), `canvas-${name}-`)));
    execFileSync('git', ['init', '-q', root]);
    writeFileSync(join(root, 'README.md'), name);
    return root;
  });
  const server = canvasMcp(),
    client = new Client({ name: 'multi-repo-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  async function app(contextId: string, action: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({
      name: 'canvas_app',
      arguments: { contextId, action, ...args },
    });
    expect(result.isError).not.toBe(true);
    return (result.structuredContent as { value: unknown }).value;
  }
  try {
    const unbound = await client.callTool({ name: 'canvas_app', arguments: { action: 'state' } });
    expect(unbound.isError).toBe(true);
    const ids: string[] = [];
    for (const repo of [...roots, roots[0]]) {
      const result = await client.callTool({ name: 'canvas_open', arguments: { repo } });
      expect(result.structuredContent).toMatchObject({ repo });
      ids.push((result.structuredContent as { contextId: string }).contextId);
    }
    expect(new Set(ids).size).toBe(3);
    for (const [index, id] of ids.entries()) {
      const state = (await app(id, 'state')) as Snapshot;
      expect(state.repo).toBe(roots[index % 2]);
      const document: Architecture = { ...state.document, title: `Map ${index}` };
      if (index < 2) await app(id, 'save', { document, revision: state.revision });
      await app(id, 'draft_write', {
        draft: { document, revision: state.revision, scope: 'repo', selection: null },
      });
      const exchange = (await app(id, 'send', {
        canvasId: 'same-tab-id',
        document,
        scope: 'repo',
        selection: null,
        messages: [{ role: 'user', text: `Question ${index}` }],
      })) as { id: string };
      await client.callTool({
        name: 'canvas_reply',
        arguments: { requestId: exchange.id, reply: `Reply ${index}` },
      });
    }
    for (const [index, id] of ids.entries()) {
      expect(await app(id, 'draft_read')).toMatchObject({ document: { title: `Map ${index}` } });
      expect(await app(id, 'chat', { canvasId: 'same-tab-id' })).toMatchObject({
        response: { reply: `Reply ${index}` },
      });
      expect(await app(id, 'source', { path: 'README.md' })).toMatchObject({
        content: index === 1 ? 'two' : 'one',
      });
    }
    expect(
      (
        JSON.parse(
          readFileSync(join(roots[0], '.repo-canvas/architecture.json'), 'utf8'),
        ) as Architecture
      ).title,
    ).toBe('Map 0');
    expect(
      (
        JSON.parse(
          readFileSync(join(roots[1], '.repo-canvas/architecture.json'), 'utf8'),
        ) as Architecture
      ).title,
    ).toBe('Map 1');
    expect(
      (
        await client.callTool({
          name: 'canvas_app',
          arguments: { contextId: 'missing', action: 'state' },
        })
      ).isError,
    ).toBe(true);
  } finally {
    await client.close();
    await server.close();
    roots.forEach((root) => rmSync(root, { recursive: true, force: true }));
  }
});

test('repository handoffs bind one waiting panel and reject cancelled or repeated replies', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'canvas-bind-')));
  execFileSync('git', ['init', '-q', root]);
  writeFileSync(join(root, 'README.md'), 'handoff');
  const server = canvasMcp(),
    client = new Client({ name: 'handoff-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  const action = (action: string, args: object = {}) =>
    client.callTool({ name: 'canvas_app', arguments: { action, ...args } });
  try {
    const first = (await action('binding_create')).structuredContent as {
      value: { bindingId: string };
    };
    const second = (await action('binding_create')).structuredContent as {
      value: { bindingId: string };
    };
    const bind = await client.callTool({
      name: 'canvas_bind',
      arguments: { bindingId: first.value.bindingId, repo: root },
    });
    expect(bind.isError).not.toBe(true);
    const selected = (await action('binding_read', first.value)).structuredContent as {
      value: { contextId: string; repo: string };
    };
    expect(selected.value.repo).toBe(root);
    expect((await action('binding_read', second.value)).structuredContent).toMatchObject({
      value: null,
    });
    expect(
      (
        await client.callTool({
          name: 'canvas_bind',
          arguments: { bindingId: first.value.bindingId, repo: root },
        })
      ).isError,
    ).toBe(true);
    await action('binding_cancel', second.value);
    expect(
      (
        await client.callTool({
          name: 'canvas_bind',
          arguments: { bindingId: second.value.bindingId, repo: root },
        })
      ).isError,
    ).toBe(true);
    expect(
      (await action('state', { contextId: selected.value.contextId })).structuredContent,
    ).toMatchObject({ value: { repo: root } });
  } finally {
    await client.close();
    await server.close();
    rmSync(root, { recursive: true, force: true });
  }
});
