import { Client } from "@modelcontextprotocol/sdk/client/index.js";
export const TEST_CHAT = "11111111-1111-4111-8111-111111111111";
/** Native host identity is supplied by this fixture, never by app arguments. Pass _meta:{} to test absence. */
export class HostTestClient extends Client {
  override callTool(
    ...[params, schema, options]: Parameters<Client["callTool"]>
  ) {
    return super.callTool(
      {
        ...params,
        _meta:
          params._meta && Object.keys(params._meta).length === 0
            ? {}
            : { threadId: TEST_CHAT, ...params._meta },
      },
      schema,
      options,
    );
  }
}
