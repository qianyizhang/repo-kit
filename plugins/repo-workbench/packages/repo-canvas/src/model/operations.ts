/** Existing HTTP routes and MCP action names describe the same canvas operations. */
export const operations = {
  view_write: { method: 'PUT', path: 'view' },
  agent_read: { method: 'GET', path: 'agent' },
  command_ack: { method: 'POST', path: 'command/ack' },
  proposal_dismiss: { method: 'POST', path: 'proposal/dismiss' },
  state: { method: 'GET', path: 'state' },
  source: { method: 'GET', path: 'source' },
  save: { method: 'PUT', path: 'state' },
  send: { method: 'POST', path: 'chat' },
  chat: { method: 'GET', path: 'chat' },
  cancel: { method: 'POST', path: 'chat/cancel' },
  draft_read: { method: 'GET', path: 'draft' },
  draft_write: { method: 'PUT', path: 'draft' },
} as const;
export type Operation = keyof typeof operations;

export function httpOperation(method: string | undefined, pathname: string): Operation | undefined {
  // The local draft route historically reads on any method other than PUT.
  if (pathname === '/api/draft') return method === 'PUT' ? 'draft_write' : 'draft_read';
  return (Object.keys(operations) as Operation[]).find(
    (action) =>
      operations[action].method === method && `/api/${operations[action].path}` === pathname,
  );
}
