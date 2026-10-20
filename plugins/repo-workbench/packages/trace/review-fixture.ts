import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizeSessionFile, sessionTrace } from './jsonl.ts';

/** Public source records shared by the development gallery and delivered-browser journeys. */
export async function reviewFixture(root: string, scenario: 'actions' | 'ambiguity' = 'actions') {
  const call = (id: string, name: string, input: string) => ({
    type: 'response_item',
    payload: { type: 'custom_tool_call', name, call_id: id, input },
  });
  const result = (id: string, output: unknown) => ({
    type: 'response_item',
    payload: { type: 'custom_tool_call_output', call_id: id, output },
  });
  const native = (item: object) => ({
    type: 'event_msg',
    payload: {
      type: 'item_completed',
      turn_id: 'turn',
      started_at_ms: 100,
      completed_at_ms: 120,
      item,
    },
  });
  const message = (role: string, text: string, phase?: string) => ({
    type: 'response_item',
    payload: { type: 'message', role, phase, content: [{ type: 'input_text', text }] },
  });
  const usage = {
    type: 'token_usage_record',
    payload: {
      turn_id: 'turn',
      response_id: 'response',
      usage: { input_tokens: 1000, output_tokens: 100, cached_input_tokens: 800 },
    },
  };
  const rows = [
    { type: 'session_meta', payload: { id: 'session' } },
    {
      type: 'event_msg',
      timestamp: '2026-10-09T00:00:00Z',
      payload: { type: 'task_started', turn_id: 'turn' },
    },
    message('user', 'Review this session.\n' + 'Full input detail. '.repeat(100) + 'INPUT_END'),
    call(
      'patch',
      'exec',
      'text(await tools.apply_patch("*** Begin Patch\\n*** Update File: /project/example.ts\\n@@\\n-old\\n+new\\n*** End Patch"))',
    ),
    message('assistant', 'Checking the edit while other work continues.', 'commentary'),
    native({
      type: 'FileChange',
      id: 'native-edit',
      status: 'completed',
      changes: { '/project/example.ts': { unified_diff: '@@\n-old\n+new' } },
    }),
    usage,
    result('patch', 'Script completed\nOutput:\n{}'),
    call(
      'images',
      'exec',
      'for (const path of paths) image((await tools.view_image({path})).image_url)',
    ),
    native({ type: 'ImageView', id: 'native-image', path: 'file:///project/retained.png' }),
    result('images', [
      {
        type: 'input_image',
        image_url:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=',
      },
    ]),
    call('delegate', 'send_message', '{"target":"/root","message":"status"}'),
    native({
      type: 'SubAgentActivity',
      id: 'delegate',
      kind: 'interacted',
      agent_path: '/root',
      agent_thread_id: '01a0e024-3705-7a91-9181-d237131801fa',
    }),
    result('delegate', ''),
    message('user', 'Please focus on the image.'),
    call('failure', 'exec_command', '{"cmd":"false"}'),
    native({
      type: 'CommandExecution',
      id: 'failure',
      status: 'completed',
      command: ['false'],
      exit_code: 1,
      aggregated_output: 'CHECK_FAILED',
    }),
    result('failure', 'CHECK_FAILED'),
    call('rejection', 'exec', 'await tools.exec_command({cmd:"publish"})'),
    result(
      'rejection',
      'Script failed\nOutput:\nScript error:\nexec_command failed: CreateProcess { message: "Rejected(denied)" }',
    ),
    result('orphan', 'ORPHAN_RESULT'),
    call('unfinished', 'exec_command', '{"cmd":"pending"}'),
    call(
      'parallel',
      'exec',
      'await Promise.allSettled([tools.exec_command({cmd:"echo A"}),tools.exec_command({cmd:"echo B"}),tools.exec_command({cmd:"echo C"}),tools.mcp__codex_app__read_thread({threadId:"read-target",turnLimit:1})])',
    ),
    ...['A', 'B', 'C'].map((name) =>
      native({
        type: 'CommandExecution',
        id: 'shell-' + name,
        command: ['/bin/zsh', '-lc', 'echo ' + name],
        exit_code: 0,
        aggregated_output: 'RESULT_' + name,
      }),
    ),
    native({
      type: 'McpToolCall',
      id: 'mcp-read',
      server: 'codex_app',
      tool: 'read_thread',
      arguments: { turnLimit: 1, threadId: 'read-target' },
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              thread: { id: 'read-target', title: 'Blueprint review', status: { type: 'idle' } },
              page: { hasMore: true },
              turns: [
                {
                  id: 'read-turn',
                  status: 'completed',
                  items: [
                    {
                      type: 'userMessage',
                      content: [{ type: 'text', text: 'Review **the blueprint**.' }],
                    },
                    { type: 'agentMessage', phase: 'analysis', text: 'PRIVATE_NOT_FOR_OVERVIEW' },
                    {
                      type: 'agentMessage',
                      phase: 'final_answer',
                      text: '## Outcome\nThe blueprint is consistent.\n\n- Verified the boundaries.',
                    },
                  ],
                },
              ],
            }),
          },
        ],
      },
    }),
    result('parallel', 'Batch completed'),

    call(
      'ask',
      'request_user_input_async',
      JSON.stringify({
        questions: [
          {
            title: 'Keep the case unfinished?',
            options: ['Keep unfinished (recommended)', 'Change scope'],
          },
        ],
      }),
    ),
    native({
      type: 'AgentMessage',
      id: 'ask',
      phase: 'final_answer',
      delivery: 'async',
      questions: [
        {
          title: 'Keep the case unfinished?',
          options: ['Keep unfinished (recommended)', 'Change scope'],
        },
      ],
      content: [{ type: 'Text', text: 'Keep the case unfinished?' }],
    }),
    result('ask', JSON.stringify({ accepted: true })),
    call(
      'answered',
      'request_user_input',
      JSON.stringify({
        questions: [
          {
            id: 'scope',
            question: 'Which scope?',
            options: [{ label: 'Narrow', description: 'Limit the scope.' }, { label: 'Broad' }],
          },
        ],
      }),
    ),
    result('answered', JSON.stringify({ answers: { scope: { answers: ['Narrow'] } } })),
    { type: 'event_msg', payload: { type: 'token_count' } },
    native({ type: 'Reasoning', summary_text: ['PRIVATE_GAP_CONTENT'] }),
    {
      type: 'response_item',
      payload: { type: 'reasoning', encrypted_content: 'PRIVATE_ENCRYPTED' },
    },
    call(
      'web-code',
      'exec',
      'text(await tools.web__run({open:[{ref_id:"https://example.com/source"}]})); text((await tools.exec_command({cmd:"process data"})).output)',
    ),
    native({
      type: 'Extension',
      id: 'native-web',
      kind: 'web.search',
      query: 'https://example.com/source',
      action: { type: 'openPage', url: 'https://example.com/source' },
      results: [
        {
          title: 'Source dataset',
          url: 'https://example.com/source',
          snippet: 'Dataset description',
        },
      ],
    }),
    native({
      type: 'CommandExecution',
      id: 'native-process',
      command: ['/bin/zsh', '-lc', 'process data'],
      exit_code: 0,
      aggregated_output: 'PROCESSED',
    }),
    result('web-code', 'Web and processing completed'),
    {
      type: 'compacted',
      timestamp: '2026-10-09T00:00:30Z',
      payload: {
        window_number: 2,
        message: 'PRIVATE_COMPACTION_SUMMARY',
        replacement_history: [{ private: 'DO_NOT_EXPORT' }],
      },
    },
    {
      type: 'event_msg',
      payload: {
        type: 'item_completed',
        turn_id: 'turn',
        started_at_ms: Date.parse('2026-10-09T00:00:29Z'),
        completed_at_ms: Date.parse('2026-10-09T00:00:31Z'),
        item: { type: 'ContextCompaction', id: 'compaction' },
      },
    },
    usage,
    message(
      'assistant',
      'The review is complete.\n' + 'Response detail. '.repeat(100) + 'RESPONSE_END',
      'final_answer',
    ),
    {
      type: 'event_msg',
      timestamp: '2026-10-09T00:01:00Z',
      payload: { type: 'task_complete', turn_id: 'turn' },
    },
  ];
  if (scenario === 'ambiguity') {
    rows.splice(
      2,
      rows.length - 3,
      message('user', 'Identify which command produced this result without guessing.'),
      call('overlap-a', 'exec', 'await tools.exec_command({cmd:"echo repeated"})'),
      call('overlap-b', 'exec', 'await tools.exec_command({cmd:"echo repeated"})'),
      native({
        type: 'CommandExecution',
        id: 'ambiguous-native',
        command: ['echo repeated'],
        exit_code: 0,
        aggregated_output: 'UNATTRIBUTED_RESULT',
      }),
      result('overlap-a', 'Wrapper A complete'),
      result('overlap-b', 'Wrapper B complete'),
      message(
        'assistant',
        'Two matching calls overlap. The native result remains separate.',
        'final_answer',
      ),
    );
  }
  const source = resolve(root, 'session.jsonl');
  await writeFile(source, rows.map((row) => JSON.stringify(row)).join('\n'));
  const thread = await normalizeSessionFile(source, 'session');
  const document = sessionTrace([thread], 'session');
  // Fixture bodies are embedded; no live usage server supplies additional records.
  delete document.delivery;
  return document;
}
