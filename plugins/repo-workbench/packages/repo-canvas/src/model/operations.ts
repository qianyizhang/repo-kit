/** Existing HTTP routes and MCP action names describe the same canvas operations. */
export const operations = {
  view_touch: { method: 'POST', path: 'view/touch' },
  view_write: { method: 'PUT', path: 'view' },
  agent_read: { method: 'GET', path: 'agent' },
  command_ack: { method: 'POST', path: 'command/ack' },
  proposal_dismiss: { method: 'POST', path: 'proposal/dismiss' },
  state: { method: 'GET', path: 'state' },
  source: { method: 'GET', path: 'source' },
  source_save: { method: 'PUT', path: 'source' },
  discussion_read: { method: 'GET', path: 'discussion' },
  discussion_write: { method: 'PUT', path: 'discussion' },
  discussion_clear: { method: 'POST', path: 'discussion/clear' },
  save: { method: 'PUT', path: 'state' },
  send: { method: 'POST', path: 'chat' },
  chat: { method: 'GET', path: 'chat' },
  cancel: { method: 'POST', path: 'chat/cancel' },
  draft_read: { method: 'GET', path: 'draft' },
  draft_write: { method: 'PUT', path: 'draft' },
} as const;
export type Operation = keyof typeof operations;

export function httpOperation(method: string | undefined, pathname: string): Operation | undefined {
  return (Object.keys(operations) as Operation[]).find(
    (action) =>
      operations[action].method === method && `/api/${operations[action].path}` === pathname,
  );
}

/** Product-declared automatic work; transports and diagnostics project this policy. */
export const backgroundActions = Object.freeze([
  'agent_read',
  'view_write',
  'view_touch',
  'state',
  'discussion_read',
  'discussion_write',
  'connect',
  'catalog',
  'remember',
  'draft_write',
  'command_ack',
]);
