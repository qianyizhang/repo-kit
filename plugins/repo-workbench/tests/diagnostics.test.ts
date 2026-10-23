import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import { ObservableServer } from '../packages/diagnostics/server.ts';
import { LogStore } from '../packages/diagnostics/store.ts';
import { Recorder, eventSchema, snapshot } from '../packages/diagnostics/events.ts';

void test('credential masking preserves token metrics and flags actual credential fields', () => {
  const value = snapshot({
    input_tokens: 3,
    totalTokens: 4,
    token: 'secret-value',
    accessToken: 'secret-value',
    api_key: 'secret-value',
  });
  assert.equal(value.redacted, true);
  assert.doesNotMatch(value.text, /secret-value/);
  assert.match(value.text, /"input_tokens": 3/);
  assert.match(value.text, /"totalTokens": 4/);
});

void test('actual MCP registrations, wire capture and explicit payload storage share scoped operations', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'workbench-observability-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new LogStore('test-app', root);
  const server = new ObservableServer(
    'test-app',
    { name: 'fixture', version: '1', build: 'fixture' },
    undefined,
    store,
  );
  server.registerTool(
    'echo',
    {
      description: 'Echo a synthetic selection',
      inputSchema: { text: z.string(), token: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    ({ text }) => ({ content: [{ type: 'text', text }] }),
  );
  const client = new Client({ name: 'test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  t.after(async () => {
    await client.close();
    await server.close();
  });
  const tools = (await client.listTools()).tools;
  const catalog = z
    .object({ tools: z.array(z.object({ name: z.string() })) })
    .parse((await client.callTool({ name: 'diagnostics_tools', arguments: {} })).structuredContent);
  assert.deepEqual(
    catalog.tools.map((tool) => tool.name),
    tools.map((tool) => tool.name),
  );
  assert.equal(
    tools.find((tool) => tool.name === 'diagnostics_capture')?.annotations?.readOnlyHint,
    false,
  );
  await client.callTool({
    name: 'echo',
    arguments: { text: 'selected-private-prose', token: 'never-retain-credential' },
  });
  const event = store.events.find(
    (event) => event.method === 'tools/call:echo' && event.phase === 'request',
  )!;
  assert.match(event.payload.text, /selected-private-prose/);
  assert.doesNotMatch(event.payload.text, /never-retain-credential/);
  assert.equal(event.payload.redacted, true);
  const disk = await readFile(join(store.directory, 'server.jsonl'), 'utf8');
  assert.doesNotMatch(disk, /selected-private-prose|never-retain-credential/);
  assert.equal(
    (await readdir(store.directory)).some((name) => name.startsWith('capture-')),
    false,
  );
  const summaries = await client.callTool({ name: 'diagnostics_events', arguments: { limit: 20 } });
  assert.doesNotMatch(JSON.stringify(summaries), /selected-private-prose/);
  const exact = await client.callTool({ name: 'diagnostics_event', arguments: { id: event.id } });
  assert.deepEqual(z.object({ event: eventSchema }).parse(exact.structuredContent).event, event);
  assert.equal(
    (await client.callTool({ name: 'diagnostics_events', arguments: { limit: 21 } })).isError,
    true,
  );
  const app = new Recorder('app');
  const unrelated = app.record(
    crypto.randomUUID(),
    'ui/message',
    'App → Host',
    'request',
    'sending',
    'unrelated-private-prose',
  );
  await client.callTool({ name: 'diagnostics_append', arguments: { event: unrelated } });
  const before = store.events.length;
  const saved = server.callDiagnostics('diagnostics_capture', { interaction: event.interaction });
  const capture = await readFile(String(saved.path), 'utf8');
  assert.match(capture, /selected-private-prose/);
  assert.doesNotMatch(capture, /unrelated-private-prose|never-retain-credential/);
  assert.equal(store.events.length, before); // Observer endpoints never record themselves.
  assert.throws(
    () => server.callDiagnostics('echo', { text: 'not a diagnostics API' }),
    /Unknown diagnostic/,
  );
  assert.throws(
    () => server.callDiagnostics('diagnostics_event', { id: crypto.randomUUID() }),
    /expired/,
  );
});
