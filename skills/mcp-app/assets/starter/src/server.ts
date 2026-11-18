import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { readFile } from "node:fs/promises";
import { createOperations, resourceUri } from "./operations.ts";

// This stdio adapter trusts the host's out-of-band chat metadata. A user-facing
// transport must have its host insert the identity and reject client overrides.
function callerOwner(meta: Record<string, unknown> | undefined) {
  const id = meta?.threadId ?? meta?.thread_id;
  if (
    (meta?.threadId != null &&
      meta.thread_id != null &&
      meta.threadId !== meta.thread_id) ||
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)
  )
    return undefined;
  return `chat:${id.toLowerCase()}`;
}
const operations = createOperations();
const server = new McpServer({ name: "__APP_ID__", version: "0.1.0" });
for (const definition of operations.definitions) {
  registerAppTool(
    server,
    definition.name,
    {
      description: `${definition.purpose}. ${definition.scope}. ${definition.effect}.`,
      inputSchema: definition.input,
      outputSchema: definition.output,
      annotations: {
        readOnlyHint:
          definition.name !== "logs_append" &&
          definition.name !== "logs_capture",
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          visibility: definition.visibility,
          ...(definition.name === "app_open" ? { resourceUri } : {}),
        },
      },
    },
    (value, extra) =>
      operations.call(definition.name, value, callerOwner(extra._meta)),
  );
}
registerAppResource(server, "App", resourceUri, {}, async () => ({
  contents: [
    {
      uri: resourceUri,
      mimeType: RESOURCE_MIME_TYPE,
      text: await readFile(new URL("./app.html", import.meta.url), "utf8"),
      _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } },
    },
  ],
}));
const transport = new StdioServerTransport();
server.server.onclose = () => process.exit(0);
await server.connect(transport);
