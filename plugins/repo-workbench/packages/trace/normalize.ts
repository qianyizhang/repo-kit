import { classifyRequest } from './classify.ts';
import {
  identity,
  list,
  optionalNumber,
  optionalRecord,
  optionalText,
  record,
  text,
  texts,
  type Omission,
  type TraceEvent,
  type TraceThread,
} from './contracts.ts';
/** Observable actions only. Unknown payloads and private reasoning never enter the bundle. */
export const READ_THREAD_ADAPTER = {
  name: 'ReadThreadExportAdapter',
  format: 'read_thread',
  version: 1,
};
const asText = (value: unknown): string =>
  typeof value === 'string' ? value : (JSON.stringify(value ?? '', null, 2) ?? '');
const excluded = new Set(['reasoning', 'inAppBrowserContext', 'browserContext']);
export const eventKey = (ref: {
  thread?: string;
  threadId?: string;
  turn?: string;
  turnId?: string;
  event?: string;
  id?: string;
}) => JSON.stringify([ref.thread ?? ref.threadId, ref.turn ?? ref.turnId, ref.event ?? ref.id]);
export function normalizeThread(value: unknown, role = 'Agent'): TraceThread {
  const page = record(value, 'read_thread export');
  const sourceThread = optionalRecord(page.thread);
  if (page.schemaVersion !== 1 || !sourceThread.id || !Array.isArray(page.turns))
    throw new Error('Expected a schemaVersion 1 read_thread export.');
  if (optionalRecord(page.page).hasMore)
    throw new Error('Export is paginated; collect all turns before building.');
  const coverage: TraceThread['coverage'] = {
    totalItems: 0,
    normalizedItems: 0,
    unsupportedItems: [],
    excludedItems: [],
    truncatedItems: 0,
    displayTruncatedItems: 0,
  };
  const recordOmission = (
    list: Omission[],
    item: Record<string, unknown>,
    base: Pick<TraceEvent, 'threadId' | 'turnId' | 'id' | 'ordinal'>,
  ) => {
    const type = optionalText(item.type, 'event type') ?? '(missing type)';
    let group = list.find((x) => x.type === type);
    if (!group) list.push((group = { type, count: 0, refs: [] }));
    group.count++;
    group.refs.push({
      thread: base.threadId,
      turn: base.turnId,
      event: base.id,
      ordinal: base.ordinal,
    });
  };
  const cleanUser = (content: unknown) =>
    list(content ?? [], 'user content')
      .map((value) => record(value, 'content item'))
      .filter((c) => c.type === 'text')
      .map((c) => text(c.text, 'content text'))
      .join('\n')
      .replace(/<in-app-browser-context\b[\s\S]*?<\/in-app-browser-context>/g, '')
      .replace(/^\s*## My request:\s*/m, '')
      .trim();
  const thread = {
    id: identity(sourceThread.id, 'thread id'),
    title: optionalText(sourceThread.title, 'thread title') || role,
    role,
    source: { ...READ_THREAD_ADAPTER, rawSchemaVersion: page.schemaVersion },
  };
  const turnIds = new Set<string>();
  const turns = list(page.turns, 'turns')
    .map((value) => {
      const turn = record(value, 'turn');
      return {
        ...turn,
        id: identity(turn.id, 'turn id'),
        startedAt: optionalNumber(turn.startedAt, 'startedAt'),
        completedAt: optionalNumber(turn.completedAt, 'completedAt'),
        items: list(turn.items, 'turn items'),
      };
    })
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))
    .map((turn) => {
      if (!turn.id || turnIds.has(turn.id) || !Array.isArray(turn.items))
        throw new Error('Missing or duplicate turn identity / items');
      turnIds.add(turn.id);
      const events: TraceEvent[] = [];
      const ids = new Set<string>();
      for (const [index, value] of turn.items.entries()) {
        const item = record(value, 'event');
        const base = {
          id: optionalText(item.id, 'event id') ?? `${turn.id}:item:${index + 1}`,
          threadId: thread.id,
          turnId: turn.id,
          ordinal: index + 1,
          role,
          status: optionalText(item.status, 'status') ?? '',
          paths: [],
          relatedThreads: [],
          sourceType: optionalText(item.type, 'event type'),
          sourceTruncated: Boolean(item.truncated || item.textTruncated || item.contentTruncated),
        };
        if (ids.has(base.id)) throw new Error(`Duplicate event identity: ${turn.id} / ${base.id}`);
        ids.add(base.id);
        coverage.totalItems++;
        let event: Pick<TraceEvent, 'kind' | 'title' | 'text'> & Partial<TraceEvent>;
        switch (item.type) {
          case 'userMessage':
            event = {
              kind: 'request',
              title: 'User request',
              text: cleanUser(item.content),
              role: 'User',
            };
            break;
          case 'agentMessage':
            event = {
              kind: 'message',
              title: item.phase === 'final_answer' ? 'Completion report' : 'Progress / review',
              messagePhase:
                item.phase === 'final_answer' || item.phase === 'commentary'
                  ? item.phase
                  : undefined,
              text: asText(item.text),
            };
            break;
          case 'commandExecution':
            event = {
              kind: 'command',
              title: (optionalText(item.command, 'command') ?? '').split('\n')[0].slice(0, 180),
              text: asText(item.command),
              output: asText(optionalRecord(item.output).text ?? '(Output not included)'),
              exitCode: item.exitCode === null ? null : optionalNumber(item.exitCode, 'exitCode'),
              durationMs: optionalNumber(item.durationMs, 'durationMs'),
              sourceTruncated: Boolean(
                base.sourceTruncated ||
                item.commandTruncated ||
                optionalRecord(item.output).truncated,
              ),
            };
            break;
          case 'fileChange': {
            const changes = list(item.changes ?? [], 'changes').map((value) => {
              const change = record(value, 'change');
              return { path: text(change.path, 'change path'), diff: optionalRecord(change.diff) };
            });
            event = {
              kind: 'edit',
              title: 'Recorded file changes',
              text: changes
                .map((c) => `${c.path}\n${asText(c.diff.text ?? '(No diff included)')}`)
                .join('\n\n'),
              paths: changes.map((c) => c.path),
              sourceTruncated:
                base.sourceTruncated || changes.some((c) => Boolean(c.diff.truncated)),
            };
            break;
          }
          case 'imageView':
            event = {
              kind: 'image',
              title: 'Inspected image',
              text: asText(item.path),
              paths: item.path ? [text(item.path, 'image path')] : [],
            };
            break;
          case 'webSearch':
            event = {
              kind: 'reference',
              title: 'Reference lookup',
              text: asText(item.action ?? item.query),
            };
            break;
          case 'subAgentActivity':
            event = {
              kind: 'delegation',
              title: `Agent ${asText(item.kind)}`,
              text: `${optionalText(item.agentPath, 'agentPath') ?? ''}\n${optionalText(item.agentThreadId, 'agentThreadId') ?? ''}`,
              relatedThreads: [
                ...new Set(
                  [
                    optionalText(item.agentThreadId, 'agentThreadId'),
                    ...texts(item.agentThreadIds ?? [], 'agentThreadIds'),
                    ...texts(item.receiverThreadIds ?? [], 'receiverThreadIds'),
                  ].filter((id): id is string => Boolean(id)),
                ),
              ],
            };
            break;
          case 'collabAgentToolCall':
            event = {
              kind: 'delegation',
              title: optionalText(item.tool, 'tool') ?? 'Collaboration',
              text: asText(item.prompt ?? '(Prompt not included)'),
              relatedThreads: [
                ...new Set(texts(item.receiverThreadIds ?? [], 'receiverThreadIds')),
              ],
            };
            break;
          default:
            recordOmission(
              excluded.has(optionalText(item.type, 'event type') ?? '')
                ? coverage.excludedItems
                : coverage.unsupportedItems,
              item,
              base,
            );
            continue;
        }
        const normalized: TraceEvent = {
          ...base,
          ...event,
          key: eventKey(base),
          preview: event.text.slice(0, 1200),
          displayTruncated: event.text.length > 1200 || (event.output?.length ?? 0) > 1200,
        };
        classifyRequest(normalized);
        normalized.key = eventKey(normalized);
        coverage.normalizedItems++;
        if (normalized.sourceTruncated) coverage.truncatedItems++;
        if (normalized.displayTruncated) coverage.displayTruncatedItems++;
        events.push(normalized);
      }
      return {
        id: turn.id,
        threadId: thread.id,
        startedAt: turn.startedAt,
        completedAt: turn.completedAt,
        events,
      };
    });
  return { ...thread, coverage, turns };
}
export function scriptJSON(value: unknown) {
  const json = JSON.stringify(value);
  if (json === undefined) throw new Error('Trace data must be JSON serializable');
  return json
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
