import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { readFile } from "node:fs/promises";
import { createOperations, resourceUri } from "./operations.ts";

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
    (value) => operations.call(definition.name, value),
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
