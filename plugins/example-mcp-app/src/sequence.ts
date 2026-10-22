import type { Run } from './contracts.ts';
import type { Observation } from './observability.ts';
export const actors = [
  {
    id: 'conversation',
    name: 'Main conversation',
    detail:
      'You and the assistant exchange messages here. The model generates assistant responses; the conversation is the visible surface.',
  },
  {
    id: 'app',
    name: 'App panel',
    detail: 'Interactive UI beside the conversation. It is not inherently a second chat or model.',
  },
  {
    id: 'host',
    name: 'Host',
    detail:
      'The runtime managing the panel and conversation. It routes requests and controls capabilities and lifecycle.',
  },
  {
    id: 'server',
    name: 'MCP server',
    detail:
      'The backend providing tools and resources. It does not automatically see the conversation.',
  },
] as const;
export type Actor = (typeof actors)[number]['id'];
export type Phase = 'all' | 'resource' | 'tool' | 'context' | 'message';
export type SequenceRow = {
  key: string;
  inferredOrder?: boolean;
  from: Actor;
  to: Actor;
  label: string;
  phase: Phase;
  event: Observation;
  stream: readonly Observation[];
};
export function phase(event: Observation): Phase {
  return event.method === 'resources/read'
    ? 'resource'
    : event.method === 'tools/call'
      ? 'tool'
      : event.method === 'ui/message'
        ? 'message'
        : event.method === 'ui/update-model-context'
          ? 'context'
          : 'all';
}
function direction(event: Observation): [Actor, Actor] {
  const names: Record<string, Actor> = {
    App: 'app',
    Host: 'host',
    Server: 'server',
    app: 'app',
    server: 'server',
  };
  const [from, to] = event.direction.split(' → ');
  return [names[from ?? ''] ?? event.source, names[to ?? from ?? ''] ?? event.source];
}
export function sequence(events: readonly Observation[], run: Run): SequenceRow[] {
  const rows: SequenceRow[] = [];
  let stream: SequenceRow | undefined;
  for (const event of events.filter((e) => e.runId === run.id && !e.observer)) {
    const [from, to] = direction(event);
    const label = event.status.includes('error')
      ? event.status
      : event.kind === 'response'
        ? 'Response'
        : event.method;
    if (
      event.method === 'ui/notifications/tool-input-partial' ||
      event.method === 'ui/notifications/tool-input'
    ) {
      if (!stream) {
        stream = {
          key: event.key,
          from,
          to,
          label: 'Tool input · streaming',
          phase: 'all',
          event,
          stream: [],
        };
        rows.push(stream);
      }
      stream.event = event;
      stream.stream = [...stream.stream, event];
      if (event.method === 'ui/notifications/tool-input') {
        stream.label = 'Tool input · complete';
        stream = undefined;
      }
    } else rows.push({ key: event.key, from, to, label, phase: phase(event), event, stream: [] });
  }
  // Reconstruct only a unique fully captured RPC path. All four arrows are real
  // observations; the ordering across host boundaries is explicitly inferred.
  // Ambiguous/repeated calls retain receipt order rather than guessing.
  for (const method of ['tools/call', 'resources/read']) {
    const group = rows.filter((r) => r.event.method === method);
    const appRequests = group.filter((r) => r.from === 'app' && r.event.kind === 'request');
    const serverRequests = group.filter(
      (r) => r.from === 'host' && r.to === 'server' && r.event.kind === 'request',
    );
    if (appRequests.length !== 1 || serverRequests.length !== 1) continue;
    const a = appRequests[0]!,
      b = serverRequests[0]!;
    const replies = (request: SequenceRow) =>
      group.filter(
        (r) =>
          r.event.kind === 'response' &&
          r.event.source === request.event.source &&
          r.event.connectionId === request.event.connectionId &&
          r.event.requestId === request.event.requestId,
      );
    const appReplies = replies(a),
      serverReplies = replies(b);
    if (appReplies.length !== 1 || serverReplies.length !== 1) continue;
    const path = [a, b, serverReplies[0]!, appReplies[0]!];
    const indices = path.map((r) => rows.indexOf(r)).sort((x, y) => x - y);
    if (indices.some((index, i) => index !== indices[0]! + i)) continue;
    for (const row of path) row.inferredOrder = true;
    rows.splice(indices[0]!, 4, ...path);
  }
  return rows;
}
export function unseenDestination(run: Run | undefined): string | undefined {
  if (
    !run ||
    !['message', 'context', 'investigate'].includes(run.journey) ||
    run.status === 'error'
  )
    return;
  if (run.journey === 'investigate' && run.status !== 'success' && run.status !== 'uncertain')
    return;
  return run.journey === 'context'
    ? 'Available to a later turn · use not observed'
    : 'Main conversation · arrival and model response not observed';
}
