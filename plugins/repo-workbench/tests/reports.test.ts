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
import { usageIndexPath } from '../packages/usage/scan.ts';
import { setTimeout as delay } from 'node:timers/promises';
import {
  bindingSchema,
  payloadSchema,
  snapshotSchema,
  documentSchema,
  textSchema,
  overviewSchema,
  recordsSchema,
  statusSchema,
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
      env: {
        ...(process.env as Record<string, string>),
        XDG_CACHE_HOME: resolve(temp, 'cache'),
        MCP_APP_LOG_ROOT: resolve(temp, 'diagnostics'),
      },
    }),
  );
  t.after(() => client.close());
  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map((t) => t.name).sort(), [
    'diagnostics_append',
    'diagnostics_capture',
    'diagnostics_event',
    'diagnostics_events',
    'diagnostics_info',
    'diagnostics_tools',
    'report_app',
    'report_provenance',
    'trace_event_text',
    'trace_events',
    'trace_open',
    'usage_open',
    'usage_records',
    'usage_summary',
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
  const selection = z.object({ selectionId: z.string() }).parse(
    unpack(
      await call(a.contextId, {
        action: 'select_usage',
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
      }),
    ),
  );
  const frozen = await client.callTool({
    name: 'usage_summary',
    arguments: { selectionId: selection.selectionId },
  });
  assert.doesNotMatch(JSON.stringify(frozen), /sources|sha256|PRIVATE_PROMPT_SENTINEL/);
  const provenance = await client.callTool({
    name: 'report_provenance',
    arguments: { selectionId: selection.selectionId, limit: 1 },
  });
  assert.match(JSON.stringify(provenance), /sha256/);
  assert.equal(
    (
      await client.callTool({
        name: 'usage_records',
        arguments: { selectionId: selection.selectionId, limit: 21 },
      })
    ).isError,
    true,
  );
  const thread = doc.threads.find((t) => t.id === event.threadId)!;
  const turn = thread.turns.find((t) => t.events.some((e) => e.key === event.key))!;
  const selectedTrace = z.object({ selectionId: z.string() }).parse(
    unpack(
      await call(a.contextId, {
        action: 'select_trace',
        session: 'parent',
        scope: { thread: thread.id, turn: turn.id, event: event.key, reviews: false },
      }),
    ),
  );
  const traceArgs = { selectionId: selectedTrace.selectionId };
  const traceEvents = await client.callTool({
    name: 'trace_events',
    arguments: { ...traceArgs, limit: 1 },
  });
  assert.doesNotMatch(JSON.stringify(traceEvents), /sha256|source/);
  assert.equal(
    (await client.callTool({ name: 'usage_summary', arguments: traceArgs })).isError,
    true,
  );
  assert.equal(
    (
      await client.callTool({
        name: 'trace_event_text',
        arguments: { ...traceArgs, eventId: 'outside', field: 'text' },
      })
    ).isError,
    true,
  );
  const exactText = await client.callTool({
    name: 'trace_event_text',
    arguments: { ...traceArgs, eventId: event.key, field: 'text' },
  });
  assert.equal(exactText.isError, undefined);
  const refreshed = z
    .object({ binding: bindingSchema })
    .parse(unpack(await call(a.contextId, { action: 'refresh' })));
  assert.equal(refreshed.binding.revision, 1);
  assert.equal((await call(a.contextId, { action: 'snapshot' })).isError, true);
  assert.deepEqual(
    await client.callTool({
      name: 'usage_summary',
      arguments: { selectionId: selection.selectionId },
    }),
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
  assert.equal(
    (
      await client.callTool({
        name: 'trace_event_text',
        arguments: { ...traceArgs, eventId: event.key, field: 'text' },
      })
    ).isError,
    true,
  );
  await appendFile(resolve(logs, 'parent.jsonl'), '\n');
  // Old trace capability is cleared by refresh; stale bodies cannot silently remap.
  assert.equal((await call(a.contextId, request, 1)).isError, true);
  assert.equal(
    (await client.callTool({ name: 'trace_open', arguments: { roots: [logs] } })).isError,
    true,
  );
});

void test('cached overview is usable during refresh failure, with explicit retry and revision-pinned lazy evidence', async (t) => {
  const temp = await mkdtemp(resolve(tmpdir(), 'reports-cache-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const logs = resolve(temp, 'logs'),
    cache = resolve(temp, 'cache');
  await mkdir(logs);
  await createFixture(logs);
  const client = new Client({ name: 'cache-test', version: '1' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve('dist/reports-server.mjs')],
      stderr: 'pipe',
      env: { ...(process.env as Record<string, string>), XDG_CACHE_HOME: cache },
    }),
  );
  t.after(() => client.close());
  const open = async () =>
    bindingSchema.parse(
      (await client.callTool({ name: 'usage_open', arguments: { roots: [logs] } }))
        .structuredContent,
    );
  const call = (id: string, request: object, expectedRevision = 0) =>
    client.callTool({
      name: 'report_app',
      arguments: { contextId: id, expectedRevision, request },
    });
  const seeded = await open();
  const original = z
    .object({ snapshot: overviewSchema, refreshing: z.boolean() })
    .parse(unpack(await call(seeded.contextId, { action: 'snapshot' })));
  assert.equal(original.refreshing, false);
  assert.ok(original.snapshot.records.every((r) => !('line' in r)));

  // A real persistence failure must preserve the prior summary, not become an endless spinner.
  const manifest = resolve(
    usageIndexPath([logs], resolve(cache, 'repo-workbench/usage')),
    'manifest.json',
  );
  const manifestBytes = await readFile(manifest);
  await rm(manifest);
  await mkdir(manifest);
  const warm = await open();
  const cached = z
    .object({ snapshot: overviewSchema, refreshing: z.boolean() })
    .parse(unpack(await call(warm.contextId, { action: 'snapshot' })));
  assert.equal(cached.refreshing, true);
  assert.deepEqual(cached.snapshot, original.snapshot);
  assert.equal(
    (
      await call(warm.contextId, {
        action: 'evidence',
        ids: cached.snapshot.records.map((r) => r.id),
      })
    ).isError,
    true,
  );
  let status = statusSchema.parse(unpack(await call(warm.contextId, { action: 'status' })));
  for (let i = 0; status.refreshing && i < 100; i++) {
    await delay(10);
    status = statusSchema.parse(unpack(await call(warm.contextId, { action: 'status' })));
  }
  assert.equal(status.refreshing, false);
  assert.match(status.error ?? '', /EISDIR|directory/);
  assert.equal((await call(warm.contextId, { action: 'refresh' })).isError, true);
  assert.deepEqual(
    z
      .object({ snapshot: overviewSchema })
      .parse(unpack(await call(warm.contextId, { action: 'snapshot' }))).snapshot,
    cached.snapshot,
  );

  await rm(manifest, { recursive: true });
  await writeFile(manifest, manifestBytes);
  const fresh = z
    .object({ binding: bindingSchema, snapshot: overviewSchema })
    .parse(unpack(await call(warm.contextId, { action: 'refresh' })));
  assert.equal(fresh.binding.revision, 1);
  assert.equal(
    (
      await call(warm.contextId, {
        action: 'evidence',
        ids: cached.snapshot.records.map((r) => r.id),
      })
    ).isError,
    true,
  );
  const evidence = z
    .object({ records: recordsSchema })
    .parse(
      unpack(
        await call(
          warm.contextId,
          { action: 'evidence', ids: fresh.snapshot.records.map((r) => r.id) },
          1,
        ),
      ),
    ).records;
  assert.ok(evidence.length > 0 && evidence.length <= 100);
  assert.ok(evidence.every((r) => typeof r.line === 'number'));
  const exported = z.object({ records: recordsSchema }).parse(
    unpack(
      await call(
        warm.contextId,
        {
          action: 'export',
          filters: {
            from: '',
            to: '',
            model: '',
            project: '',
            effort: '',
            search: '',
            timezone: 'Asia/Shanghai',
            ignoreAutoReview: false,
          },
        },
        1,
      ),
    ),
  ).records;
  assert.equal(
    exported.length,
    fresh.snapshot.records.reduce((n, r) => n + r.events, 0),
  );
});
