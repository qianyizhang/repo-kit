import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import { Recorder } from "../src/observability.ts";

test("built stdio server publishes scoped schemas and a complete app resource", async () => {
  const client = new Client({ name: "protocol-test", version: "1" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve("dist/server.mjs")],
    env: {
      PATH: process.env.PATH!,
      MCP_APP_LOG_ROOT: await mkdtemp(join(tmpdir(), "mcp-protocol-")),
    },
    stderr: "pipe",
  });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.equal(
      tools.find((tool) => tool.name === "logs_capture")?.annotations
        ?.readOnlyHint,
      false,
      "Saving payloads to disk must advertise a write effect",
    );
    const info = await client.callTool({ name: "app_info", arguments: {} });
    const { tools: catalog } = z
      .object({
        tools: z.array(
          z.object({
            name: z.string(),
            inputSchema: z.record(z.string(), z.unknown()),
            outputSchema: z.record(z.string(), z.unknown()),
          }),
        ),
      })
      .parse(info.structuredContent);
    assert.deepEqual(
      tools.map((tool) => tool.name),
      catalog.map((tool) => tool.name),
    );
    for (const item of catalog) {
      const registered = tools.find((tool) => tool.name === item.name)!;
      assert.deepEqual(registered.inputSchema, item.inputSchema);
      assert.deepEqual(registered.outputSchema, item.outputSchema);
    }
    const opened = await client.callTool({ name: "app_open", arguments: {} });
    assert.doesNotMatch(JSON.stringify(opened), /Another note|notes/);
    const { resourceUri: uri } = z
      .object({ resourceUri: z.string() })
      .parse(opened.structuredContent);
    const resource = await client.readResource({ uri });
    const content = resource.contents[0];
    assert.ok(content && "text" in content);
    assert.match(content.text, /App info/);
    assert.match(uri, /app-[a-f0-9]{12}\.html$/);
    const bad = await client.callTool({
      name: "note_read",
      arguments: { id: "missing" },
    });
    assert.equal(bad.isError, true);
  } finally {
    await client.close();
  }
});

test("built stdio adapter scopes diagnostic writes, reads and captures to host callers", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "mcp-protocol-owners-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const client = new Client({ name: "diagnostic-owners", version: "1" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve("dist/server.mjs")],
      env: { PATH: process.env.PATH!, MCP_APP_LOG_ROOT: root },
      stderr: "pipe",
    }),
  );
  t.after(() => client.close());
  const a = crypto.randomUUID(),
    b = crypto.randomUUID();
  const interaction = crypto.randomUUID();
  const event = new Recorder("app").record(
    interaction,
    "ui/message",
    "App → Host",
    "request",
    "sending",
    "owned message",
  );
  const call = (
    name: string,
    args: Record<string, unknown>,
    meta?: Record<string, unknown>,
  ) =>
    client.callTool({
      name,
      arguments: args,
      ...(meta ? { _meta: meta } : {}),
    });
  const capture = z.object({ eventCount: z.number() });
  const appends = { event };
  const lists = { interaction };
  const reads = { id: event.id };

  for (const [name, args] of [
    ["logs_append", appends],
    ["logs_list", lists],
    ["logs_event", reads],
    ["logs_capture", lists],
  ] as const) {
    assert.equal((await call(name, args)).isError, true);
    assert.equal(
      (await call(name, args, { threadId: a, thread_id: b })).isError,
      true,
    );
  }
  assert.equal(
    (await call("logs_append", appends, { threadId: a })).isError,
    undefined,
  );
  assert.equal(
    (await call("note_read", { id: "welcome", interaction }, { threadId: a }))
      .isError,
    undefined,
  );
  assert.deepEqual(
    (await call("logs_list", lists, { threadId: b })).structuredContent,
    { events: [], next: null },
  );
  assert.equal(
    (await call("logs_event", reads, { threadId: b })).isError,
    true,
  );
  assert.equal(
    (await call("logs_capture", lists, { threadId: b })).isError,
    true,
  );
  assert.equal(
    (await call("logs_append", appends, { threadId: b })).isError,
    undefined,
  );
  assert.equal(
    capture.parse(
      (await call("logs_capture", lists, { threadId: b })).structuredContent,
    ).eventCount,
    1,
  );
  assert.match(
    JSON.stringify(await call("logs_event", reads, { thread_id: a })),
    /owned message/,
  );
  const summaries = z
    .object({ events: z.array(z.unknown()) })
    .parse((await call("logs_list", lists, { threadId: a })).structuredContent);
  assert.equal(summaries.events.length, 3);
  assert.equal(
    capture.parse(
      (await call("logs_capture", lists, { threadId: a })).structuredContent,
    ).eventCount,
    3,
  );
});
