import { createServer } from "node:http";
import { readFile, mkdtemp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
const client = new Client({ name: "test-host", version: "1" });
const nonce = randomUUID(),
  port = 4398;
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: [resolve("dist/server.mjs")],
    env: {
      PATH: process.env.PATH!,
      MCP_APP_LOG_ROOT: await mkdtemp(join(tmpdir(), "mcp-host-")),
    },
    stderr: "pipe",
  }),
);
const toolInput = z.object({
  name: z.string(),
  arguments: z.record(z.string(), z.unknown()).optional(),
});
createServer(async (request, response) => {
  try {
    if (request.headers.host !== `127.0.0.1:${port}`)
      throw new Error("Unexpected host");
    if (
      (request.method === "GET" && request.url?.startsWith("/?")) ||
      (request.method === "GET" && request.url === "/")
    ) {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(
        `<!doctype html><html><head><meta name="fixture-nonce" content="${nonce}"><title>Fixture host</title></head><body><h1>Fixture host · no model is called</h1><select id="mode"><option>accept</option><option>slow</option><option>reject</option><option>timeout</option></select><button id="teardown">Close panel locally</button><button id="theme">Dark theme</button><iframe title="App" sandbox="allow-scripts" style="width:100%;height:900px;border:1px solid"></iframe><pre id="messages">[]</pre><pre id="calls">[]</pre><script src="/host.js"></script></body></html>`,
      );
    } else if (request.method === "GET" && request.url === "/host.js") {
      response.setHeader("Content-Type", "application/javascript");
      response.end(await readFile("dist/test-host.js"));
    } else if (request.method === "GET" && request.url === "/app") {
      const opened = await client.callTool({ name: "app_open", arguments: {} });
      const identity = z
        .object({ resourceUri: z.string() })
        .parse(opened.structuredContent);
      const resource = await client.readResource({ uri: identity.resourceUri });
      const content = resource.contents[0];
      if (!content || !("text" in content))
        throw new Error("App resource must be text");
      response.end(content.text);
    } else if (
      request.method === "POST" &&
      request.url === "/tool" &&
      request.headers["x-fixture-nonce"] === nonce &&
      request.headers.origin === `http://127.0.0.1:${port}`
    ) {
      let text = "";
      for await (const chunk of request) {
        text += String(chunk);
        if (Buffer.byteLength(text) > 192 * 1024) throw new Error("Too large");
      }
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify(
          await client.callTool(toolInput.parse(JSON.parse(text))),
        ),
      );
    } else {
      response.statusCode = 404;
      response.end();
    }
  } catch (error) {
    response.statusCode = 400;
    response.end(String(error));
  }
}).listen(port, "127.0.0.1");
process.on("SIGTERM", () => {
  void client.close().finally(() => process.exit(0));
});
