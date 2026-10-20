import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeThread, scriptJSON } from './normalize.ts';
const fixture = (items: unknown[]) => ({
  schemaVersion: 1,
  thread: { id: 'thread' },
  page: { hasMore: false },
  turns: [
    { id: 'later', startedAt: 20, items },
    { id: 'earlier', startedAt: 10, items: [] },
  ],
});
await test('known records preserve provenance, order and stable IDs; omissions reconcile without private payloads', () => {
  const source = fixture([
    { id: 'r', type: 'reasoning', content: ['PRIVATE_SECRET'] },
    { id: 'unknown', type: 'futureEvent', payload: 'PRIVATE_SECRET' },
    { type: 'futureEvent', payload: 'PRIVATE_SECRET' },
    {
      id: 'u',
      type: 'userMessage',
      content: [
        {
          type: 'text',
          text: '<in-app-browser-context>ambient</in-app-browser-context>\n## My request:\nMake the shape flow.',
        },
      ],
    },
    { id: 'm', type: 'agentMessage', phase: 'final_answer', text: 'Done' },
    {
      id: 'c',
      type: 'commandExecution',
      command: 'false',
      exitCode: 1,
      output: { text: 'failed', truncated: true },
    },
    {
      id: 'f',
      type: 'fileChange',
      changes: [{ path: 'a.ts', diff: { text: '+foo', truncated: true } }],
    },
    { id: 'i', type: 'imageView', path: 'retained.png' },
    { id: 'w', type: 'webSearch', query: 'geometry' },
    {
      id: 's',
      type: 'subAgentActivity',
      agentThreadId: 'a',
      agentThreadIds: ['b'],
      receiverThreadIds: ['c'],
    },
    {
      id: 'd',
      type: 'collabAgentToolCall',
      tool: 'wait',
      receiverThreadIds: ['a', 'b', 'a'],
      prompt: 'Review',
    },
  ]);
  const result = normalizeThread(source),
    events = result.turns[1].events;
  assert.equal(result.turns[0].id, 'earlier');
  assert.deepEqual(
    events.map((e) => e.ordinal),
    [4, 5, 6, 7, 8, 9, 10, 11],
  );
  assert.equal(events[0].text, 'Make the shape flow.');
  assert.deepEqual(events[6].relatedThreads, ['a', 'b', 'c']);
  assert.deepEqual(events[7].relatedThreads, ['a', 'b']);
  assert.equal(events[2].sourceTruncated, true);
  assert.equal(events[2].displayTruncated, false);
  assert.equal(result.coverage.totalItems, 11);
  assert.equal(result.coverage.normalizedItems, 8);
  assert.equal(result.coverage.unsupportedItems[0].count, 2);
  assert.equal(result.coverage.excludedItems[0].count, 1);
  assert.equal(result.coverage.unsupportedItems[0].refs[1].event, 'later:item:3');
  assert.equal(JSON.stringify(result).includes('PRIVATE_SECRET'), false);
  assert.deepEqual(normalizeThread(source), result);
  assert.equal(result.source.name, 'ReadThreadExportAdapter');
});
await test('viewer previews retain full normalized values and do not imply upstream truncation', () => {
  const e = normalizeThread(
    fixture([
      {
        type: 'commandExecution',
        id: 'c',
        command: 'x'.repeat(17000),
        output: { text: 'y'.repeat(18000) },
      },
    ]),
  ).turns[1].events[0];
  assert.equal(e.text.length, 17000);
  assert.ok(e.output);
  assert.equal(e.output.length, 18000);
  assert.equal(e.preview.length, 1200);
  assert.equal(e.displayTruncated, true);
  assert.equal(e.sourceTruncated, false);
});
await test('refuses incomplete pages, unsupported schemas and duplicate identities', () => {
  const page = fixture([]);
  page.page.hasMore = true;
  assert.throws(() => normalizeThread(page), /paginated/);
  assert.throws(() => normalizeThread({ ...page, schemaVersion: 2 }), /schemaVersion/);
  assert.throws(
    () =>
      normalizeThread(
        fixture([
          { id: 'a', type: 'reasoning' },
          { id: 'a', type: 'imageView' },
        ]),
      ),
    /Duplicate event/,
  );
});
await test('embedded transcript cannot terminate script or introduce HTML', () => {
  const input = { text: '</script><img src=x onerror=alert(1)>\u2028' };
  assert.equal(scriptJSON(input).includes('<'), false);
  assert.deepEqual(JSON.parse(scriptJSON(input)), input);
});
