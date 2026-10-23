import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { snapshotSchema } from '../src/contracts.ts';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import { mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

void test('delivered server: discovery, resource, tool errors and correlated trace without source dependencies', async () => {
  const root = await mkdtemp(join(tmpdir(), 'example-mcp-package-'));
  // Run only bundled assets outside the checkout. No sibling node_modules.
  await cp(fileURLToPath(new URL('../dist', import.meta.url)), root, { recursive: true });
  const client = new Client({ name: 'protocol-test', version: '1.0.0' });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [join(root, 'server.mjs')],
        cwd: root,
        stderr: 'inherit',
      }),
    );
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [
      'diagnostics_capture',
      'diagnostics_info',
      'diagnostics_tools',
      'example_echo',
      'example_event',
      'example_events',
      'example_open',
      'example_report',
      'example_status',
      'example_trace',
    ]);
    const entry = tools.find((t) => t.name === 'example_open');
    const { ui } = z.object({ ui: z.object({ resourceUri: z.string() }) }).parse(entry?._meta);
    assert.match(ui.resourceUri, /^ui:\/\/example-mcp-app\/app-[a-f0-9]{12}\.html$/);
    const { resources } = await client.listResources();
    assert.equal(resources.length, 2);
    const html = await client.readResource({ uri: ui.resourceUri });
    assert.equal(html.contents[0]?.mimeType, 'text/html;profile=mcp-app');
    assert.match(
      z.object({ text: z.string() }).parse(html.contents[0]).text,
      /Explain the 4 roles/,
    );
    const opened = await client.callTool({ name: 'example_open', arguments: {} });
    assert.equal(z.object({ uri: z.string() }).parse(opened.structuredContent).uri, ui.resourceUri);
    assert.deepEqual(opened._meta, { ui: { resourceUri: ui.resourceUri } });
    const runId = '11111111-1111-4111-8111-111111111111';
    const echo = await client.callTool({
      name: 'example_echo',
      arguments: { text: 'hello', runId },
    });
    assert.equal(z.object({ echo: z.string() }).parse(echo.structuredContent).echo, 'hello');
    assert.equal(
      (await client.callTool({ name: 'example_echo', arguments: { text: 'demo', fail: true } }))
        .isError,
      true,
    );
    assert.equal(
      (await client.callTool({ name: 'example_echo', arguments: { text: 42 } })).isError,
      true,
    );
    const data = await client.readResource({ uri: 'example://sample/welcome' });
    assert.equal(data.contents[0]?.mimeType, 'application/json');
    await assert.rejects(client.readResource({ uri: 'example://missing' }), /not found/i);
    const trace = await client.callTool({ name: 'example_trace', arguments: {} });
    const snapshot = snapshotSchema.parse(trace.structuredContent);
    for (const method of [
      'initialize',
      'notifications/initialized',
      'tools/list',
      'resources/list',
      'resources/read',
      'tools/call',
    ])
      assert.ok(
        snapshot.events.some((e) => e.method === method),
        `Missing ${method}`,
      );
    assert.ok(snapshot.events.some((e) => e.status === 'tool error'));
    assert.ok(snapshot.events.some((e) => e.status === 'RPC error'));
    assert.ok(
      snapshot.events.some(
        (e) => e.method === 'tools/call' && e.kind === 'response' && e.elapsedMs !== undefined,
      ),
    );
    const next = snapshotSchema.parse(
      (await client.callTool({ name: 'example_trace', arguments: {} })).structuredContent,
    );
    assert.ok(
      next.events.some((e) => e.observer && e.kind === 'response' && e.payload.includes('omitted')),
    );
    assert.ok(next.events.some((e) => e.payload.includes('HTML omitted')));
    assert.equal(snapshot.uri, ui.resourceUri);
    assert.equal(snapshot.events.filter((e) => e.runId === runId).length, 2);
    const status = await client.callTool({ name: 'example_status', arguments: {} });
    assert.doesNotMatch(JSON.stringify(status), /"events"|"payload"/);
    const summaries = await client.callTool({
      name: 'example_events',
      arguments: { runId, limit: 20 },
    });
    assert.doesNotMatch(JSON.stringify(summaries), /"payload"|hello/);
    const summary = z
      .object({ events: z.array(z.object({ sequence: z.number() })) })
      .parse(summaries.structuredContent).events[0]!;
    const exact = await client.callTool({
      name: 'example_event',
      arguments: { expectedInstance: snapshot.instance, sequence: summary.sequence },
    });
    assert.match(JSON.stringify(exact), /hello/);
    assert.equal(
      (await client.callTool({ name: 'example_events', arguments: { limit: 21 } })).isError,
      true,
    );
    const catalog = z
      .object({ tools: z.array(z.object({ name: z.string() })) })
      .parse(
        (await client.callTool({ name: 'diagnostics_tools', arguments: {} })).structuredContent,
      );
    assert.deepEqual(
      catalog.tools.map((tool) => tool.name),
      tools.map((tool) => tool.name),
    );
    assert.deepEqual(
      z
        .object({ ui: z.object({ visibility: z.array(z.string()) }) })
        .parse(tools.find((tool) => tool.name === 'example_trace')?._meta).ui.visibility,
      ['app'],
    );
    const resourceRun = '22222222-2222-4222-8222-222222222222';
    const correlated = await client.readResource({ uri: `example://sample/run/${resourceRun}` });
    assert.match(
      z.object({ text: z.string() }).parse(correlated.contents[0]).text,
      new RegExp(resourceRun),
    );
    const panelId = '33333333-3333-4333-8333-333333333333';
    const report = {
      panelId,
      build: snapshot.build,
      host: { name: 'test', version: '1' },
      connection: 'Connected',
      mode: 'live',
      runs: [],
      events: [],
      dropped: 0,
    };
    const rejected = await client.callTool({
      name: 'example_report',
      arguments: { report: { ...report, build: 'wrong' } },
    });
    assert.equal(rejected.isError, true);
    assert.ok(!(await client.callTool({ name: 'example_report', arguments: { report } })).isError);
    const reported = snapshotSchema.parse(
      (await client.callTool({ name: 'example_trace', arguments: { panelId } })).structuredContent,
    );
    assert.equal(reported.panels[0]?.panelId, panelId);
    assert.equal(reported.events.filter((e) => e.runId === resourceRun).length, 2);
    assert.ok(
      reported.events.filter((e) => e.observer).every((e) => !e.payload.includes('"events"')),
    );
    // Bad user IDs must not poison the trace snapshot schema.
    await client.callTool({
      name: 'example_echo',
      arguments: { text: 'bad ID', runId: 'x'.repeat(1000) },
    });
    snapshotSchema.parse(
      (await client.callTool({ name: 'example_trace', arguments: {} })).structuredContent,
    );
  } finally {
    await client.close();
    await rm(root, { recursive: true, force: true });
  }
});
