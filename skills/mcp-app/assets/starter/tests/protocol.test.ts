import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";

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
