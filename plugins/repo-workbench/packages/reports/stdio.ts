import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { reportsMcp } from './server.ts';
const server = reportsMcp();
await server.connect(new StdioServerTransport());
process.stdin.once('end', () => {
  void server.close();
});
