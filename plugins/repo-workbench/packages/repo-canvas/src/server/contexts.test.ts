import { test, expect, vi } from 'vitest';
import { HostTestClient as Client } from '../../../../../mcp-app-runtime/tests/host-client.ts';
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
  vi.stubEnv('XDG_STATE_HOME', roots[0] + '/.state');
  const server = canvasMcp(),
    client = new Client({ name: 'multi-repo-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  async function app(contextId: string, action: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({
      name: 'canvas_app',
      arguments: { contextId, request: { action, args: { ...args } } },
    });
    expect(result.isError).not.toBe(true);
    return (result.structuredContent as { value: unknown }).value;
  }
  try {
    const unbound = await client.callTool({
      name: 'canvas_app',
      arguments: { request: { action: 'state', args: {} } },
    });
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
        response: { reply: `Reply ${index === 0 ? 2 : index}` },
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
          arguments: { contextId: 'missing', request: { action: 'state', args: {} } },
        })
      ).isError,
    ).toBe(true);
  } finally {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await client.close();
    await server.close();
    roots.forEach((root) => rmSync(root, { recursive: true, force: true }));
  }
});

test('caller-bound release reclaims capacity and idle expiry clears stale panel bindings', async () => {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'canvas-release-')));
  execFileSync('git', ['init', '-q', repo]);
  vi.stubEnv('XDG_STATE_HOME', join(repo, 'state'));
  const now = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
  const threadId = crypto.randomUUID();
  const other = crypto.randomUUID();
  const panelId = crypto.randomUUID();
  const [a, b] = InMemoryTransport.createLinkedPair();
  const server = canvasMcp(undefined, undefined, undefined, () => repo);
  const client = new Client({ name: 'release-test', version: '1' });
  await server.connect(a);
  await client.connect(b);
  const call = (name: string, args: Record<string, unknown>, id = threadId) =>
    client.callTool({ name, arguments: args, _meta: { threadId: id } });
  const app = (contextId: string | undefined, action: string, args: Record<string, unknown> = {}) =>
    call('canvas_app', { contextId, request: { action, args } });
  const open = () => call('canvas_open', { repo });
  const openedId = async () => {
    const result = await open();
    expect(result.isError).not.toBe(true);
    return (result.structuredContent as { contextId: string }).contextId;
  };
  const connect = async (contextId?: string) => {
    const result = await app(contextId, 'connect', { panelId, repo });
    expect(result.isError).not.toBe(true);
    return (result.structuredContent as { value: { target: { contextId: string } } }).value.target
      .contextId;
  };
  const release = (contextId: string, panel?: string, owner = threadId) =>
    call('canvas_release', { contextId, ...(panel ? { panelId: panel } : {}) }, owner);
  try {
    const dirty = await openedId();
    const stateBeforeSend = (await app(dirty, 'state')).structuredContent as { value: Snapshot };
    const pending = await app(dirty, 'send', {
      canvasId: 'closing-panel',
      document: stateBeforeSend.value.document,
      scope: 'repo',
      selection: null,
      messages: [{ role: 'user', text: 'Please review this map' }],
    });
    expect(pending.isError).not.toBe(true);
    const requestId = (pending.structuredContent as { value: { id: string } }).value.id;
    expect(await connect(dirty)).toBe(dirty);
    expect(await release(dirty, panelId)).toMatchObject({ structuredContent: { released: false } });
    const spare = await openedId();
    expect(await release(spare)).toMatchObject({ structuredContent: { released: true } });
    expect((await call('canvas_reply', { requestId, reply: 'Reviewed' })).isError).not.toBe(true);
    const clean = await openedId();
    const draft = {
      document: { ...stateBeforeSend.value.document, title: 'Preserve this draft' },
      revision: stateBeforeSend.value.revision,
      scope: 'repo',
      selection: null,
    };
    expect(await app(dirty, 'draft_write', { draft })).toMatchObject({
      structuredContent: { value: { stored: true } },
    });
    expect(await connect(clean)).toBe(clean);
    for (let i = 0; i < 30; i++) await openedId();
    expect(await open()).toMatchObject({ isError: true, _meta: { 'repo-kit/error': 'limit' } });
    expect(await release(clean, panelId, other)).toMatchObject({ isError: true });
    expect(await release(clean, crypto.randomUUID())).toMatchObject({ isError: true });
    expect(await release(clean)).toMatchObject({ structuredContent: { released: false } });
    expect(await release(dirty)).toMatchObject({ structuredContent: { released: false } });
    expect(await release(clean, panelId)).toMatchObject({ structuredContent: { released: true } });
    expect(await app(clean, 'state')).toMatchObject({ isError: true });
    const replacement = await connect(clean);
    expect(replacement).not.toBe(clean);
    expect(await connect(clean)).toBe(replacement);
    expect((await app(dirty, 'draft_read')).structuredContent).toEqual({ value: draft });

    clock.mockReturnValue(now + 24 * 3600_000);
    expect(await connect(replacement)).not.toBe(replacement);
    await openedId(); // Abandoned contexts no longer hold capacity.
  } finally {
    await client.close();
    await server.close();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    rmSync(repo, { recursive: true, force: true });
  }
});
