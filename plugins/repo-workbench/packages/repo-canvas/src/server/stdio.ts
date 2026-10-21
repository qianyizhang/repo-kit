import { resolve } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CanvasBridge } from './bridge.ts';
import { canvasMcp } from './mcp.ts';
import { Repository } from './repository.ts';
import { ConnectionDiagnostics, connectionLogPath } from './diagnostics.ts';

// Codex owns this process; stdout is exclusively the MCP protocol.
const args = process.argv.slice(2);
const index = args.indexOf('--repo');
if (index >= 0 && !args[index + 1]) throw new Error('Provide --repo /absolute/repository/path');
const server = canvasMcp(
  new CanvasBridge(),
  index >= 0 ? new Repository(resolve(args[index + 1])) : undefined,
  new ConnectionDiagnostics(connectionLogPath()),
);
await server.connect(new StdioServerTransport());
process.stdin.once('end', () => {
  void server.close();
});
