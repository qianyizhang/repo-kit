import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { canvasMcp } from '../packages/repo-canvas/src/server/mcp.ts';
import { parseOutput } from '../packages/repo-canvas/src/model/contracts.ts';
import { LogStore } from '../../mcp-app-runtime/src/store.ts';
import { ReportSelections } from '../packages/reports/selections.ts';
import { hostedPrincipal } from '../../mcp-app-runtime/src/registry.ts';
import { scan } from '../packages/usage/scan.ts';
import { createFixture } from '../packages/usage/fixture.ts';

void test('every Canvas context/request tool checks caller before reading or enqueuing', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'canvas-owner-'));
  const before = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = join(root, 'state');
  t.after(async () => {
    if (before === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = before;
    await rm(root, { recursive: true, force: true });
  });
  execFileSync('git', ['init', '-q', root]);
  const a = crypto.randomUUID(),
    b = crypto.randomUUID();
  const server = canvasMcp(
    undefined,
    undefined,
    undefined,
    undefined,
    new LogStore('owner-test', join(root, 'diagnostics')),
  );
  const client = new Client({ name: 'ownership', version: '1' }),
    [left, right] = InMemoryTransport.createLinkedPair();
  await server.connect(left);
  await client.connect(right);
  t.after(async () => {
    await client.close();
    await server.close();
  });
  const call = (name: string, args: Record<string, unknown>, thread: string | undefined = a) =>
    client.callTool({ name, arguments: args, _meta: thread ? { threadId: thread } : {} });
  const opened = await call('canvas_open', { repo: root });
  const { contextId } = z.object({ contextId: z.string() }).parse(opened.structuredContent);
  const stateResult = await call('canvas_app', {
    contextId,
    request: { action: 'state', args: {} },
  });
  const state = parseOutput(
    'state',
    z.object({ value: z.unknown() }).parse(stateResult.structuredContent).value,
  );
  if ('needsRepository' in state) throw new Error('Expected an opened repository');
  const send = await call('canvas_app', {
    contextId,
    request: {
      action: 'send',
      args: {
        canvasId: 'discussion',
        document: state.document,
        scope: 'repo',
        selection: null,
        messages: [{ role: 'user', text: 'private question' }],
      },
    },
  });
  const exchange = z
    .object({ value: z.object({ id: z.string() }) })
    .parse(send.structuredContent).value;
  const reads: Array<[string, Record<string, unknown>]> = [
    ['canvas_request', { requestId: exchange.id }],
    ['canvas_map', { requestId: exchange.id }],
    ['canvas_comments', { requestId: exchange.id }],
    ['canvas_comment_text', { requestId: exchange.id, commentId: 'note', field: 'captured' }],
    ['canvas_provenance', { requestId: exchange.id, targetId: 'repo' }],
    ['canvas_snapshot', { contextId, includeDocument: true }],
    ['canvas_app', { contextId, request: { action: 'state', args: {} } }],
    ['canvas_command', { contextId, expectedRevision: 'not-used', command: { action: 'fit' } }],
    [
      'canvas_propose',
      { contextId, expectedRevision: 'not-used', document: state.document, explanation: 'foreign' },
    ],
    ['canvas_reply', { requestId: exchange.id, reply: 'foreign' }],
  ];
  for (const [name, args] of reads) {
    assert.equal((await call(name, args, b)).isError, true, name);
    assert.equal(
      (await client.callTool({ name, arguments: args, _meta: {} }))._meta?.['repo-kit/error'],
      'forbidden',
      name,
    );
  }
  const discovered = await call('canvas_requests', {}, b);
  assert.deepEqual(JSON.parse((discovered.content as Array<{ text: string }>)[0].text), {
    canvases: [],
  });
  const inbox = await call('canvas_app', {
    contextId,
    request: { action: 'agent_read', args: {} },
  });
  assert.equal(
    z.object({ value: z.object({ command: z.unknown() }) }).parse(inbox.structuredContent).value
      .command,
    null,
  );
  const exact = await call('canvas_request', { requestId: exchange.id });
  assert.match(JSON.stringify(exact), /private question/);
  assert.equal(
    (await call('canvas_reply', { requestId: exchange.id, reply: 'owner answer' })).isError,
    undefined,
  );
});

void test('frozen report selections have immutable owners and survive refresh without sharing authority', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'selection-owner-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await createFixture(root);
  const snapshot = await scan([root]);
  const selections = new ReportSelections();
  t.after(() => selections.dispose());
  const a = selections.forOwner(hostedPrincipal({ threadId: crypto.randomUUID() }));
  const b = selections.forOwner(hostedPrincipal({ threadId: crypto.randomUUID() }));
  const selected = a.usage(snapshot, {
    from: '',
    to: '',
    model: '',
    project: '',
    effort: '',
    search: '',
    timezone: 'UTC',
  });
  const summary = a.usageSummary(selected.selectionId);
  snapshot.records.splice(0);
  assert.deepEqual(a.usageSummary(selected.selectionId), summary);
  for (const read of [
    () => b.usageSummary(selected.selectionId),
    () => b.usageRecords(selected.selectionId, 0, 10),
    () => b.provenance(selected.selectionId, 0, 10),
  ])
    assert.throws(read, /unavailable for this caller/);
});
