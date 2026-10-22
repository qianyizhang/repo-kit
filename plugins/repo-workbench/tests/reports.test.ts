import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile, appendFile, cp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { createFixture } from '../packages/usage/fixture.ts';
import {
  bindingSchema,
  payloadSchema,
  snapshotSchema,
  documentSchema,
  textSchema,
} from '../packages/reports/contracts.ts';
const unpack = (result: { _meta?: Record<string, unknown> }): unknown =>
  JSON.parse(
    gunzipSync(Buffer.from(payloadSchema.parse(result._meta).payload, 'base64')).toString(),
  );
void test('delivered reports: discovery, isolation, frozen discussion, pinned lazy reads and refresh', async (t) => {
  const temp = await mkdtemp(resolve(tmpdir(), 'reports-protocol-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const logs = resolve(temp, 'logs'),
    empty = resolve(temp, 'empty');
  await mkdir(logs);
  await mkdir(empty);
  await createFixture(logs);
  const before = await readFile(resolve(logs, 'parent.jsonl'));
  const delivered = resolve(temp, 'delivered');
  await cp('dist', delivered, { recursive: true });
  const client = new Client({ name: 'reports-test', version: '1' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve(delivered, 'reports-server.mjs')],
      stderr: 'pipe',
      env: { ...(process.env as Record<string, string>), XDG_CACHE_HOME: resolve(temp, 'cache') },
    }),
  );
  t.after(() => client.close());
  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map((t) => t.name).sort(), [
    'report_app',
    'report_read',
    'trace_open',
    'usage_open',
  ]);
  const meta = z
    .object({ ui: z.object({ resourceUri: z.string() }) })
    .parse(tools.tools.find((t) => t.name === 'usage_open')?._meta);
  const resource = await client.readResource({ uri: meta.ui.resourceUri });
  assert.equal(resource.contents[0].mimeType, 'text/html;profile=mcp-app');
  assert.match('text' in resource.contents[0] ? resource.contents[0].text : '', /report-toolbar/);
  const a = bindingSchema.parse(
    (await client.callTool({ name: 'usage_open', arguments: { roots: [logs] } })).structuredContent,
  );
  const b = bindingSchema.parse(
    (await client.callTool({ name: 'usage_open', arguments: { roots: [empty] } }))
      .structuredContent,
  );
  const call = (contextId: string, request: object, expectedRevision = 0) =>
    client.callTool({ name: 'report_app', arguments: { contextId, expectedRevision, request } });
  const result = await call(a.contextId, { action: 'snapshot' });
  assert.deepEqual(result.content, []);
  assert.equal(result.structuredContent, undefined);
  const snapshot = z.object({ snapshot: snapshotSchema }).parse(unpack(result)).snapshot;
  assert.ok(snapshot.records.length);
  assert.equal(
    z
      .object({ snapshot: snapshotSchema })
      .parse(unpack(await call(b.contextId, { action: 'snapshot' }))).snapshot.records.length,
    0,
  );
  assert.equal((await call(b.contextId, { action: 'trace', session: 'parent' })).isError, true);
  const doc = z
    .object({ document: documentSchema })
    .parse(unpack(await call(a.contextId, { action: 'trace', session: 'parent' }))).document;
  const event = doc.threads.flatMap((t) => t.turns.flatMap((t) => t.events)).find((e) => e.body)!;
  assert.ok(event);
  const request = {
    action: 'text',
    session: 'parent',
    event: event.key,
    revision: event.body!.sources.map((s) => s.sha256).join('.'),
    field: 'text',
    offset: 0,
  };
  const reads = await Promise.all([call(a.contextId, request), call(a.contextId, request)]);
  assert.ok(reads.every((r) => !r.isError));
  assert.equal(typeof textSchema.parse(unpack(reads[0])).text, 'string');
  assert.equal((await call(a.contextId, { ...request, revision: 'stale' })).isError, true);
  assert.equal((await call(a.contextId, { ...request, offset: -1 })).isError, true);
  const capture = z.object({ requestId: z.string() }).parse(
    unpack(
      await call(a.contextId, {
        action: 'capture',
        question: 'Why these totals?',
        filters: {
          from: '',
          to: '',
          model: '',
          project: '',
          effort: '',
          search: '',
          timezone: 'UTC',
          ignoreAutoReview: false,
        },
        selection: 'all',
      }),
    ),
  );
  const frozen = await client.callTool({
    name: 'report_read',
    arguments: { requestId: capture.requestId },
  });
  const refreshed = z
    .object({ binding: bindingSchema })
    .parse(unpack(await call(a.contextId, { action: 'refresh' })));
  assert.equal(refreshed.binding.revision, 1);
  assert.equal((await call(a.contextId, { action: 'snapshot' })).isError, true);
  assert.deepEqual(
    await client.callTool({ name: 'report_read', arguments: { requestId: capture.requestId } }),
    frozen,
  );
  assert.deepEqual(await readFile(resolve(logs, 'parent.jsonl')), before);
  const reopened = bindingSchema.parse(
    (await client.callTool({ name: 'trace_open', arguments: { roots: [logs], session: 'parent' } }))
      .structuredContent,
  );
  const pinnedSource = doc.threads.find((t) => t.id === event.threadId)!.source.path!;
  const pinnedBytes = await readFile(pinnedSource, 'utf8');
  assert.ok(pinnedBytes.includes('PRIVATE_PROMPT_SENTINEL'));
  await writeFile(
    pinnedSource,
    pinnedBytes.replace('PRIVATE_PROMPT_SENTINEL', 'MUTATED_PROMPT_SENTINEL'),
  );
  assert.equal((await call(reopened.contextId, request)).isError, true);
  await appendFile(resolve(logs, 'parent.jsonl'), '\n');
  // Old trace capability is cleared by refresh; stale bodies cannot silently remap.
  assert.equal((await call(a.contextId, request, 1)).isError, true);
  assert.equal(
    (await client.callTool({ name: 'trace_open', arguments: { roots: [logs] } })).isError,
    true,
  );
});
