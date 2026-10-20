import type { ThreadRead } from './contracts.ts';
type Obj = Record<string, unknown>;
const object = (value: unknown): Obj =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Obj) : {};
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const content = (value: unknown) =>
  typeof value === 'string'
    ? value
    : Array.isArray(value)
      ? value
          .map((part) => text(object(part).text))
          .filter(Boolean)
          .join('\n')
      : '';
/** A bounded overview of an explicit read_thread result; the complete result remains independently readable. */
export function threadReadResult(result: unknown): ThreadRead | undefined {
  const envelope = object(result);
  const candidates: unknown[] = [envelope.structuredContent];
  for (const block of Array.isArray(envelope.content) ? envelope.content : []) {
    if (object(block).type !== 'text') continue;
    try {
      candidates.push(JSON.parse(text(object(block).text)));
    } catch {
      /* Not structured thread data. */
    }
  }
  const data = candidates
    .map(object)
    .find((value) => text(object(value.thread).id) && Array.isArray(value.turns));
  if (!data) return undefined;
  const thread = object(data.thread),
    rows = data.turns as unknown[];
  let limited = rows.length > 10;
  const bounded = (value: string) => {
    if (value.length > 12000) limited = true;
    return value.slice(0, 12000);
  };
  const turns = rows.slice(0, 10).map((row) => {
    const turn = object(row),
      items = (Array.isArray(turn.items) ? turn.items : []).map(object);
    const responses = items.filter(
      (item) => item.type === 'agentMessage' && item.phase !== 'analysis',
    );
    const answer =
      responses.filter((item) => item.phase === 'final_answer').at(-1) ?? responses.at(-1);
    return {
      id: text(turn.id),
      status: text(turn.status),
      request: bounded(
        items
          .filter((item) => item.type === 'userMessage')
          .map((item) => content(item.content) || text(item.text))
          .join('\n\n'),
      ),
      response: bounded(answer ? text(answer.text) || content(answer.content) : ''),
      final: answer?.phase === 'final_answer',
      activities: items.filter(
        (item) =>
          !['userMessage', 'agentMessage', 'reasoning', 'contextCompaction'].includes(
            text(item.type),
          ),
      ).length,
    };
  });
  return {
    id: text(thread.id),
    title: text(thread.title) || text(thread.id),
    status: text(object(thread.status).type) || text(thread.status),
    hasMore: object(data.page).hasMore === true,
    limited,
    turns,
  };
}
