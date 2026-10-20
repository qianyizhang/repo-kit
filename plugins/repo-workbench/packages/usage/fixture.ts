import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const at = (hour: number) => `2026-10-09T${String(hour).padStart(2, '0')}:00:00.000Z`;
const tokens = (input: number, cached: number, output: number) => ({
  input_tokens: input,
  cached_input_tokens: cached,
  output_tokens: output,
  reasoning_output_tokens: output / 2,
  total_tokens: input + output,
});
const meta = (id: string, parent = '', hour = 0) => ({
  type: 'session_meta',
  timestamp: at(hour),
  payload: { id, parent_thread_id: parent, cwd: '/projects/workshop', timestamp: at(hour) },
});
const context = (model = 'model-a', turn = 'turn-a') => ({
  type: 'turn_context',
  timestamp: at(0),
  payload: {
    model,
    effort: model === 'model-b' ? 'medium' : 'high',
    turn_id: turn,
    cwd: '/projects/workshop',
  },
});
const response = (
  thread: string,
  id: string,
  input: number,
  cached: number,
  output: number,
  hour: number,
) => ({
  type: 'token_usage_record',
  timestamp: at(hour),
  payload: {
    thread_id: thread,
    turn_id: 'turn-a',
    response_id: id,
    usage: tokens(input, cached, output),
  },
});
const event = (
  totalInput: number,
  totalCached: number,
  totalOutput: number,
  input: number,
  cached: number,
  output: number,
  hour: number,
) => ({
  type: 'event_msg',
  timestamp: at(hour),
  payload: {
    type: 'token_count',
    info: {
      total_token_usage: tokens(totalInput, totalCached, totalOutput),
      last_token_usage: tokens(input, cached, output),
    },
  },
});
export async function createFixture(directory: string) {
  await mkdir(directory, { recursive: true });
  const archive = resolve(directory, 'archive');
  await mkdir(archive);
  const parent = [
    meta('parent'),
    context(),
    { type: 'response_item', payload: { type: 'message', content: 'PRIVATE_PROMPT_SENTINEL' } },
    response('parent', 'r1', 1000, 600, 100, 1),
    event(1000, 600, 100, 1000, 600, 100, 1),
    response('parent', 'r2', 500, 200, 50, 2),
    event(1500, 800, 150, 500, 200, 50, 2),
  ];
  const legacy = [
    meta('legacy'),
    context('model-b'),
    event(400, 100, 40, 400, 100, 40, 3),
    event(400, 100, 40, 400, 100, 40, 3),
    event(700, 180, 70, 300, 80, 30, 4),
  ];
  const files: [string, unknown[]][] = [
    ['parent.jsonl', parent],
    ['archive/parent-copy.jsonl', parent],
    [
      'child.jsonl',
      [
        meta('child', 'parent', 5),
        context(),
        response('parent', 'r1', 1000, 600, 100, 1),
        response('child', 'r3', 200, 100, 20, 6),
      ],
    ],
    ['legacy.jsonl', legacy],
    [
      'fork.jsonl',
      [
        {
          type: 'session_meta',
          payload: {
            id: 'fork',
            forked_from_id: 'legacy',
            timestamp: at(5),
            cwd: '/projects/workshop',
          },
        },
        context('model-b'),
        ...legacy.slice(2),
        event(900, 230, 90, 200, 50, 20, 6),
      ],
    ],
  ];
  for (const [name, rows] of files)
    await writeFile(resolve(directory, name), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return directory;
}
