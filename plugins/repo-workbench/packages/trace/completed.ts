import { readQuestions } from './native-tools.ts';
import { threadReadResult } from './thread-read.ts';
import type { TraceEvent } from './contracts.ts';
type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Obj) : {};
const str = (value: unknown) => (typeof value === 'string' ? value : '');
const printable = (value: unknown) => str(value) || JSON.stringify(value ?? '', null, 2);
const text = (value: unknown) =>
  typeof value === 'string'
    ? value
    : Array.isArray(value)
      ? value
          .map((part) => str(obj(part).text))
          .filter(Boolean)
          .join('\n')
      : '';
export type CompletedEvent = Pick<TraceEvent, 'kind' | 'title' | 'text'> & Partial<TraceEvent>;
/** Public completed-item variants only. Private reasoning is handled as an omission by callers. */
export function completedEvent(payload: Obj, role: string): CompletedEvent | undefined {
  const item = obj(payload.item),
    type = str(item.type);
  const status = str(item.status);
  const durationMs =
    typeof payload.started_at_ms === 'number' &&
    typeof payload.completed_at_ms === 'number' &&
    payload.completed_at_ms >= payload.started_at_ms
      ? payload.completed_at_ms - payload.started_at_ms
      : undefined;
  const base = { status, ...(durationMs !== undefined ? { durationMs } : {}) };
  switch (type) {
    case 'UserMessage':
      return {
        ...base,
        kind: 'request',
        title: 'User request',
        text: text(item.content),
        role: 'User',
      };
    case 'AgentMessage':
      if (item.phase === 'analysis') return undefined;
      return {
        ...base,
        kind: readQuestions(item.questions).length ? 'ask' : 'message',
        title: readQuestions(item.questions).length ? 'Ask user' : 'Assistant message',
        questions: readQuestions(item.questions),
        text: text(item.content),
        role,
        messagePhase:
          item.phase === 'final_answer' || item.phase === 'commentary' ? item.phase : undefined,
      };
    case 'CommandExecution': {
      const ms =
        typeof item.duration_ms === 'number'
          ? item.duration_ms
          : typeof obj(item.duration).secs === 'number'
            ? Number(obj(item.duration).secs) * 1000 +
              Number(obj(item.duration).nanos ?? 0) / 1000000
            : undefined;
      return {
        ...base,
        kind: 'command',
        title: 'Shell command',
        text: Array.isArray(item.command) ? printable(item.command) : str(item.command),
        output:
          str(item.aggregated_output) ||
          [str(item.stdout), str(item.stderr)].filter(Boolean).join('\n'),
        exitCode: typeof item.exit_code === 'number' ? item.exit_code : null,
        durationMs: durationMs ?? ms,
      };
    }
    case 'ImageView':
      return {
        ...base,
        kind: 'image',
        title: 'Image inspection',
        text: str(item.path),
        paths: str(item.path) ? [str(item.path)] : [],
      };
    case 'FileChange': {
      const changes: Obj[] = Array.isArray(item.changes)
        ? item.changes.map(obj)
        : Object.entries(obj(item.changes)).map(([path, change]) => ({ ...obj(change), path }));
      return {
        ...base,
        kind: 'edit',
        title: 'File changes',
        paths: changes.map((change) => str(change.path)).filter(Boolean),
        text: changes
          .map(
            (change) =>
              str(change.path) +
              '\n' +
              printable(
                change.unified_diff ??
                  change.content ??
                  obj(change.diff).text ??
                  change.diff ??
                  change.patch ??
                  '',
              ),
          )
          .join('\n\n'),
        output: [str(item.stdout), str(item.stderr)].filter(Boolean).join('\n'),
      };
    }
    case 'McpToolCall':
      return {
        ...base,
        kind: 'command',
        title: str(item.server) + ' · ' + str(item.tool),
        text: printable(item.arguments),
        output: printable(item.result),
        ...(item.server === 'codex_app' && item.tool === 'read_thread'
          ? { threadRead: threadReadResult(item.result) }
          : {}),
      };
    case 'CollabAgentToolCall':
      return {
        ...base,
        kind: 'delegation',
        title: 'Agent coordination · ' + str(item.tool),
        text: printable({
          sender: item.sender_thread_id,
          receivers: item.receiver_thread_ids,
          agents: item.receiver_agents,
        }),
        output: printable(item.agents_states),
        relatedThreads: (Array.isArray(item.receiver_thread_ids) ? item.receiver_thread_ids : [])
          .map(str)
          .filter(Boolean),
      };
    case 'SubAgentActivity':
      return {
        ...base,
        kind: 'delegation',
        title: 'Subagent · ' + str(item.kind),
        text: [str(item.agent_path), str(item.agent_thread_id)].filter(Boolean).join('\n'),
        relatedThreads: str(item.agent_thread_id) ? [str(item.agent_thread_id)] : [],
      };
    case 'ContextCompaction':
      return {
        ...base,
        kind: 'compaction',
        title: 'Context compacted',
        text: 'Context was compacted. Conversation history was condensed for continued work.',
        compaction: {
          startedAt: typeof payload.started_at_ms === 'number' ? payload.started_at_ms : undefined,
          completedAt:
            typeof payload.completed_at_ms === 'number' ? payload.completed_at_ms : undefined,
        },
      };
    case 'Extension':
      if (item.kind === 'clock.sleep')
        return {
          ...base,
          kind: 'wait',
          title: 'Clock wait',
          text: 'Paused until the timer elapsed or new input arrived.',
          durationMs:
            durationMs ?? (typeof item.durationMs === 'number' ? item.durationMs : undefined),
        };
      return {
        ...base,
        kind: 'reference',
        title:
          item.kind === 'web.search'
            ? 'Web · ' + str(obj(item.action).type || 'search')
            : 'Extension · ' + str(item.kind),
        ...(item.kind === 'web.search'
          ? {
              web: {
                query: str(item.query),
                targets: [
                  str(item.query),
                  str(obj(item.action).url),
                  str(obj(item.action).query),
                  ...(Array.isArray(obj(item.action).queries)
                    ? (obj(item.action).queries as unknown[]).map(str)
                    : []),
                  ...(str(obj(item.action).pattern)
                    ? ['find:' + str(obj(item.action).pattern)]
                    : []),
                ].filter(Boolean),
                results: (Array.isArray(item.results) ? item.results : [])
                  .map(obj)
                  .map((r) => ({ title: str(r.title), url: str(r.url), snippet: str(r.snippet) })),
              },
            }
          : {}),
        text: printable(item.query ?? item.action ?? {}),
        output: printable(item.results),
      };
    default:
      return undefined;
  }
}
