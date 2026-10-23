import { createServer, type IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createOperations } from "./operations.ts";

const operations = createOperations(),
  nonce = randomUUID();
const port = Number(process.env.PORT ?? 4397);
const origin = `http://127.0.0.1:${port}`;
async function body(request: IncomingMessage) {
  let text = "";
  for await (const chunk of request) {
    text += String(chunk);
    if (Buffer.byteLength(text) > 192 * 1024)
      throw new Error("Request too large");
  }
  return JSON.parse(text) as unknown;
}
createServer(async (request, response) => {
  try {
    if (request.headers.host !== `127.0.0.1:${port}`)
      throw new Error("Unexpected host");
    if (request.method === "GET" && request.url === "/") {
      const html = await readFile(
        new URL("./app.html", import.meta.url),
        "utf8",
      );
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
      );
      response.end(
        html.replace(
          "<head>",
          `<head><meta name="app-nonce" content="${nonce}">`,
        ),
      );
      return;
    }
    if (
      request.method !== "POST" ||
      !request.url?.startsWith("/api/") ||
      request.headers["x-app-nonce"] !== nonce ||
      request.headers.origin !== origin ||
      !request.headers["content-type"]?.startsWith("application/json")
    )
      throw new Error("Same-origin JSON request required");
    const name = request.url.slice("/api/".length);
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(operations.call(name, await body(request))));
  } catch (error) {
    response.statusCode = 400;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ error: String(error) }));
  }
}).listen(port, "127.0.0.1", () => console.error(`Standalone app: ${origin}`));
