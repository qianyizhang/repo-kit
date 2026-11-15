import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { buildPage } from "./build.ts";
const { values } = parseArgs({
  options: {
    input: { type: "string", default: "example.json" },
    port: { type: "string", default: "0" },
  },
});
const port = Number(values.port);
if (!Number.isInteger(port) || port < 0 || port > 65535)
  throw new Error("Port must be 0–65535");
// Validate once before listening. Every refresh re-reads only this named local model.
await buildPage(JSON.parse(await readFile(values.input!, "utf8")));
const server = createServer(async (req, res) => {
  if (
    req.method !== "GET" ||
    !["/", "/index.html"].includes(
      new URL(req.url ?? "/", "http://127.0.0.1").pathname,
    )
  ) {
    res.writeHead(404).end("Not found");
    return;
  }
  try {
    const html = await buildPage(
      JSON.parse(await readFile(values.input!, "utf8")),
    );
    res
      .writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      })
      .end(html);
  } catch (error) {
    res
      .writeHead(500, { "Content-Type": "text/plain; charset=utf-8" })
      .end(
        `Workbench unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
  }
});
server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  if (address && typeof address === "object")
    console.log(
      `Behavior workbench: http://127.0.0.1:${address.port}/\nLocal preview only. Stop with Ctrl+C.`,
    );
});
process.on("SIGINT", () => server.close());
