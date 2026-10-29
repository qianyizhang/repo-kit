import { expect, test } from '@playwright/test';
import { mkdtemp, readFile, rm, appendFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { Server } from 'node:http';
import { createFixture } from '../../packages/usage/fixture.ts';
import { buildDashboard, startServer } from '../../packages/usage/build.ts';
import type { ScanCache } from '../../packages/usage/scan.ts';
let url = '';
let input = '';
let output = '';
let server: Server;
test.beforeAll(async () => {
  input = await mkdtemp(resolve(tmpdir(), 'usage-browser-'));
  await createFixture(input);
  await writeFile(
    resolve(input, 'auto-review.jsonl'),
    [
      {
        type: 'session_meta',
        payload: {
          id: 'auto-review-session',
          parent_thread_id: 'parent',
          cwd: '/projects/workshop',
        },
      },
      {
        type: 'turn_context',
        payload: { model: 'codex-auto-review', effort: 'high', turn_id: 'review-turn' },
      },
      {
        type: 'event_msg',
        payload: {
          type: 'user_message',
          message:
            'The following is the Codex agent history added since your last approval assessment. REVIEW_CONTEXT_MARKER',
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'function_call',
          name: 'review_tool',
          call_id: 'review-call',
          arguments: 'REVIEW_TOOL_MARKER',
        },
      },
      { type: 'event_msg', payload: { type: 'agent_message', message: 'REVIEW_REPLY_MARKER' } },
      {
        type: 'token_usage_record',
        timestamp: '2026-10-09T07:00:00Z',
        payload: {
          thread_id: 'auto-review-session',
          response_id: 'review-1',
          usage: { input_tokens: 500, output_tokens: 50, reasoning_output_tokens: 25 },
        },
      },
    ]
      .map((row) => JSON.stringify(row))
      .join('\n') + '\n',
  );
  await appendFile(
    resolve(input, 'parent.jsonl'),
    [
      {
        type: 'event_msg',
        timestamp: '2026-10-08T01:00:00Z',
        payload: { type: 'user_message', message: 'TRACE_USER_REQUEST_BEFORE_USAGE_FILTER' },
      },
      {
        type: 'response_item',
        timestamp: '2026-10-08T01:00:00Z',
        payload: {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: 'TRACE_USER_REQUEST_BEFORE_USAGE_FILTER' },
            {
              type: 'input_image',
              image_url:
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=',
            },
          ],
        },
      },
      {
        type: 'response_item',
        timestamp: '2026-10-08T02:00:00Z',
        payload: {
          type: 'function_call',
          name: 'exec_command',
          call_id: 'trace-call',
          arguments: '{"cmd":"node check.js"}',
        },
      },
      {
        type: 'response_item',
        timestamp: '2026-10-08T02:00:01Z',
        payload: { type: 'function_call_output', call_id: 'trace-call', output: 'TRACE_CHECK_OK' },
      },
      {
        type: 'response_item',
        payload: {
          type: 'function_call_output',
          call_id: 'large-call',
          output: 'LARGE_OUTPUT_HEAD ' + 'x'.repeat(140000) + ' LARGE_OUTPUT_TAIL',
        },
      },
      {
        type: 'event_msg',
        payload: {
          type: 'item_completed',
          turn_id: 'turn-a',
          item: {
            type: 'CommandExecution',
            command: ['echo', 'NATIVE_COMMAND_PROOF'],
            aggregated_output: 'NATIVE_RESULT_PROOF',
            exit_code: 0,
          },
        },
      },
      {
        type: 'event_msg',
        payload: {
          type: 'item_completed',
          turn_id: 'turn-a',
          item: {
            type: 'FileChange',
            changes: { 'native.ts': { type: 'update', unified_diff: '@@\n+NATIVE_PATCH_PROOF' } },
          },
        },
      },
      {
        type: 'response_item',
        timestamp: '2026-10-08T03:00:00Z',
        payload: {
          type: 'custom_tool_call',
          name: 'exec',
          call_id: 'batch-call',
          input:
            'await Promise.all([tools.exec_command({cmd:"echo BATCH_A"}), tools.exec_command({cmd:"echo BATCH_B"})]);',
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'custom_tool_call_output',
          call_id: 'batch-call',
          output: 'WRAPPER_BATCH_PROOF',
        },
      },
      {
        type: 'event_msg',
        payload: {
          type: 'item_completed',
          turn_id: 'turn-a',
          started_at_ms: Date.parse('2026-10-08T03:00:01Z'),
          item: {
            type: 'CommandExecution',
            id: 'native-a',
            command: ['/bin/zsh', '-lc', 'echo BATCH_A'],
            aggregated_output: 'BATCH_A_RESULT',
            exit_code: 0,
          },
        },
      },
      {
        type: 'event_msg',
        payload: {
          type: 'item_completed',
          turn_id: 'turn-a',
          started_at_ms: Date.parse('2026-10-08T03:00:01Z'),
          item: {
            type: 'CommandExecution',
            id: 'native-b',
            command: ['/bin/zsh', '-lc', 'echo BATCH_B'],
            aggregated_output: 'BATCH_B_RESULT',
            exit_code: 0,
          },
        },
      },
      { type: 'turn_context', payload: { turn_id: 'goal-turn', model: 'model-a' } },
      {
        type: 'event_msg',
        timestamp: '2026-10-09T08:00:00Z',
        payload: {
          type: 'user_message',
          message:
            '<codex_internal_context source="goal">\n<objective>\nGOAL_OBJECTIVE_PROOF\n</objective>\nContinuation behavior: keep working\n</codex_internal_context>',
        },
      },
      {
        type: 'event_msg',
        payload: {
          type: 'user_message',
          message: 'Please debug goals and auto-review; ordinary request',
        },
      },
      {
        type: 'response_item',
        timestamp: '2026-10-08T02:00:02Z',
        payload: { type: 'reasoning', text: 'PRIVATE_REASONING_SENTINEL' },
      },
    ]
      .map((record) => JSON.stringify(record))
      .join('\n') + '\n',
  );
  await appendFile(
    resolve(input, 'child.jsonl'),
    JSON.stringify({
      type: 'event_msg',
      timestamp: '2026-10-09T07:00:00Z',
      payload: { type: 'agent_message', message: 'CHILD_TRACE_MESSAGE' },
    }) + '\n',
  );
  const cache: ScanCache = new Map();
  const built = await buildDashboard({ roots: [input], cache });
  output = built.output;
  const service = await startServer(built, [input], cache, 0);
  url = service.url;
  server = service.server;
});
test.afterAll(async () => {
  if (server)
    await new Promise<void>((done, reject) => {
      server.close((e) => (e ? reject(e) : done()));
    });
  if (input) await rm(input, { recursive: true, force: true });
  if (output) await rm(output, { recursive: true, force: true });
});
test('offline dashboard filters, prices, drills down, exports and refreshes local usage', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(url) && !r.url().startsWith('blob:')) external.push(r.url());
  });
  await page.goto(url);
  await page.getByRole('button', { name: 'All time', exact: true }).click();
  await expect(page.locator('#total')).toHaveText('2.86K');
  await expect(page.locator('#events')).toHaveText('6');
  const toggle = page.getByRole('checkbox', { name: 'Ignore auto-review sessions', exact: true });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(page.locator('#total')).toHaveText('3.41K');
  await expect(
    page.getByRole('row', { name: 'Inspect session auto-review-session', exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'All time', exact: true }).click();
  await expect(toggle).not.toBeChecked();
  await expect(page.locator('#events')).toHaveText('7');
  await toggle.check();
  await expect(
    page.getByRole('row', { name: 'Inspect session auto-review-session', exact: true }),
  ).toHaveCount(0);
  const cleanDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const cleanPath = await (await cleanDownload).path();
  expect(await readFile(cleanPath, 'utf8')).not.toContain('codex-auto-review');
  await page.reload();
  await page.getByRole('button', { name: 'All time', exact: true }).click();
  await expect(toggle).toBeChecked();
  await expect(page.locator('#total')).toHaveText('2.86K');
  await expect(page.locator('#cost')).toHaveText('—');
  await expect(page.locator('#reasoning')).toHaveText('50.0%');
  await page
    .locator('#efforts')
    .getByRole('button', { name: /medium/ })
    .click();
  await expect(page.locator('#effort')).toHaveValue('medium');
  await expect(page.locator('#total')).toHaveText('990');
  await page.locator('#effort').selectOption('');
  await page.getByRole('button', { name: 'Sort by Tokens', exact: true }).click();
  await expect(page.locator('#sessions tbody tr').first()).toHaveAttribute(
    'aria-label',
    'Inspect session child',
  );
  await expect(
    page
      .locator('#sessions th')
      .filter({ has: page.getByRole('button', { name: 'Sort by Tokens', exact: true }) }),
  ).toHaveAttribute('aria-sort', 'ascending');
  await page.getByRole('button', { name: 'Sort by Tokens', exact: true }).click();
  await expect(page.locator('#sessions tbody tr').first()).toHaveAttribute(
    'aria-label',
    'Inspect session parent',
  );
  await page.getByRole('button', { name: 'Sort by Effort', exact: true }).click();
  await expect(page.locator('#sessions tbody tr').first()).toContainText('high');
  await page.locator('#measure').selectOption('reasoning');
  await expect(page.locator('#legend')).toContainText('Recorded reasoning');
  await page.locator('#measure').selectOption('tokens');
  await expect(page.locator('#trend svg rect')).not.toHaveCount(0);
  await expect(page.locator('#heatmap button:not(:disabled)')).not.toHaveCount(0);
  await page.locator('#model').selectOption('model-b');
  await expect(page.locator('#total')).toHaveText('990');
  await expect(page.locator('#events')).toHaveText('3');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const downloaded = await downloadPromise;
  const path = await downloaded.path();
  expect(path).not.toBeNull();
  const contents = await readFile(path, 'utf8');
  expect(contents.split('\r\n')).toHaveLength(4);
  expect(contents).not.toContain('model-a');
  await page.locator('#model').selectOption('');
  await expect(page.locator('#total')).toHaveText('2.86K');
  await page.getByRole('button', { name: 'Pricing', exact: true }).click();
  await expect(page.getByLabel('gpt-6.1-sol input USD per million', { exact: true })).toHaveValue(
    '2',
  );
  await expect(page.locator('#price-source')).toContainText('2026-10-09');
  for (const [key, value] of [
    ['input', '2'],
    ['cached', '1'],
    ['write', '3'],
    ['output', '10'],
  ])
    await page.getByLabel(`model-a ${key} USD per million`, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Save prices', exact: true }).click();
  await expect(page.locator('#price-status')).toContainText('Saved');
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.locator('#cost-sub')).toContainText('3 / 6 events priced');
  await page.locator('#from').fill('2026-10-09');
  await page.getByRole('row', { name: 'Inspect session parent', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export these records', exact: true })).toHaveCount(
    0,
  );
  const tracePromise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Open full trace ↗', exact: true }).click();
  const trace = await tracePromise;
  trace.on('pageerror', (error) => errors.push(error.message));
  await expect(trace.locator('#conversation')).toBeVisible();
  await trace.getByRole('button', { name: 'Recorded actions', exact: true }).click();
  await expect(trace.locator('#events')).toBeVisible();
  await expect(trace.getByRole('heading', { name: 'Session review', exact: true })).toBeVisible();
  await expect(trace.getByRole('button', { name: 'Copy full session ID', exact: true })).toHaveText(
    'parent',
  );
  await expect(trace.getByRole('button', { name: 'Creation story', exact: true })).toBeHidden();
  await expect(trace.locator('#event-list')).toContainText(
    'TRACE_USER_REQUEST_BEFORE_USAGE_FILTER',
  );
  await expect(trace.locator('#event-list')).toContainText('node check.js');
  await expect(trace.locator('#event-list')).toContainText('TRACE_CHECK_OK');
  await expect(trace.locator('#event-list')).toContainText('CHILD_TRACE_MESSAGE');
  const command = trace.locator('#event-list .event').filter({ hasText: 'node check.js' });
  await expect(command).toHaveCount(1);
  await command.locator(':scope > details > .action-summary').click();
  await expect(command).toContainText('TRACE_CHECK_OK');
  await expect(trace.getByText('Source & identity', { exact: true })).toHaveCount(0);
  await expect(trace.getByRole('button', { name: 'Inspect evidence', exact: true })).toHaveCount(0);
  await trace.getByLabel('Search record previews or file').fill('TRACE_CHECK_OK');
  await expect(trace.locator('#event-list .event')).toHaveCount(1);
  await trace.getByRole('button', { name: 'Source & provenance', exact: true }).click();
  await expect(trace.locator('#threads')).toContainText('SHA-256');
  await expect(trace.locator('#threads')).toContainText('parent.jsonl');
  const manifestUrl = await trace
    .getByRole('link', { name: 'Open evidence manifest', exact: true })
    .getAttribute('href');
  const manifest = await page.request.get(new URL(manifestUrl ?? '', url).href);
  const traceManifest = (await manifest.json()) as { sources: unknown[] };
  expect(traceManifest.sources).toHaveLength(3);
  expect(await trace.locator('body').textContent()).not.toContain('PRIVATE_REASONING_SENTINEL');
  await trace.getByRole('link', { name: '← Usage dashboard', exact: true }).click();
  await expect(trace.getByRole('heading', { name: 'Codex usage', exact: true })).toBeVisible();
  await trace.close();
  await expect(page.locator('#evidence-content')).toContainText('SHA-256');
  await expect(page.locator('#evidence-content')).toContainText('Per-response record');
  await expect(page.locator('#evidence-content')).toContainText('1000');
  await page.keyboard.press('Escape');
  await expect(page.locator('#evidence')).toBeHidden();
  await page.getByRole('row', { name: 'Inspect session parent', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#evidence')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#search').fill('missing-session');
  await expect(page.locator('#total')).toHaveText('0');
  await expect(page.locator('#sessions')).toContainText('No sessions');
  await page.locator('#search').fill('');
  await page.screenshot({ path: info.outputPath('usage-desktop.png'), fullPage: true });
  await page.reload();
  await page.getByRole('button', { name: 'All time', exact: true }).click();
  await expect(page.locator('#cost-sub')).toContainText('3 / 6 events priced');
  await page.getByRole('button', { name: 'Refresh logs', exact: true }).click();
  await expect(page.locator('#message')).toContainText('Refreshed');
  await appendFile(
    resolve(input, 'child.jsonl'),
    JSON.stringify({
      type: 'token_usage_record',
      timestamp: '2026-10-09T07:00:00Z',
      payload: {
        thread_id: 'child',
        turn_id: 'turn-a',
        response_id: 'r4',
        usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 10 },
      },
    }) + '\n',
  );
  await page.getByRole('button', { name: 'Refresh logs', exact: true }).click();
  await expect(page.locator('#events')).toHaveText('7');
  await expect(page.locator('#total')).toHaveText('2.97K');
  await page.getByRole('button', { name: 'Sources', exact: true }).click();
  await expect(page.locator('#source-summary')).toContainText('5 unchanged files reused');
  await expect(page.locator('#source-summary')).toContainText('1 appended files');
  await page.getByText('Source files (6)', { exact: true }).click();
  await expect(page.locator('#source-list')).toContainText('sha256');
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath('usage-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('large trace output pages through complete text and loads preserved images on demand', async ({
  page,
}) => {
  const errors: string[] = [];
  const images: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/trace-image?')) images.push(request.url());
  });
  await page.goto(url + 'trace?session=parent#view=events');
  const output = page.locator('#event-list .event').filter({ hasText: 'large-call' });
  await expect(output).toBeVisible();
  expect(images).toHaveLength(0);
  await output.locator(':scope > details > .action-summary').click();
  await expect(output.getByRole('status')).toContainText('1–65536');
  await output.getByRole('button', { name: 'Next text block →', exact: true }).click();
  await expect(output.getByRole('status')).toContainText('65537–131072');
  await output.getByRole('button', { name: 'Next text block →', exact: true }).click();
  await expect(output).toContainText('LARGE_OUTPUT_TAIL');
  await expect(
    output.getByRole('button', { name: 'Next text block →', exact: true }),
  ).toBeDisabled();
  await output.getByRole('button', { name: '← Previous text block', exact: true }).click();
  await expect(output.getByRole('status')).toContainText('65537–131072');
  const request = page
    .locator('#event-list .event')
    .filter({ hasText: 'TRACE_USER_REQUEST_BEFORE_USAGE_FILTER' });
  await request.locator(':scope > details > .action-summary').click();
  await request.getByText('Recorded images (1)', { exact: true }).click();
  await expect(request.locator('img')).toBeVisible();
  await expect
    .poll(() => request.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(1);
  expect(images).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('trace distinguishes goal continuations and review activity, with session source order and restorable filters', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url + 'trace?session=parent#view=events');
  const reviews = page.getByRole('checkbox', { name: 'Show auto-review', exact: true });
  await expect(reviews).not.toBeChecked();
  await expect(page.locator('#event-list')).not.toContainText('REVIEW_CONTEXT_MARKER');
  await expect(page.locator('#event-list')).not.toContainText('REVIEW_TOOL_MARKER');
  await expect(page.locator('#event-list')).not.toContainText('REVIEW_REPLY_MARKER');
  await expect(page.locator('#event-list')).toContainText('ordinary request');
  await expect(page.locator('#event-list')).toContainText('NATIVE_COMMAND_PROOF');
  await expect(page.locator('#event-list')).toContainText('NATIVE_PATCH_PROOF');
  await expect(page.locator('#event-list .session-main').first()).toHaveText('Main · parent');
  await expect(page.locator('#event-list .session-child').first()).toHaveText('Subagent · child');
  const batch = page.locator('#event-list .event').filter({ hasText: 'BATCH_A' });
  await expect(batch).toHaveCount(1);
  await batch.locator(':scope > details > .action-summary').click();
  await expect(batch.locator('.execution-pair')).toHaveCount(2);
  await expect(batch).toContainText('BATCH_A_RESULT');
  await expect(batch).toContainText('BATCH_B_RESULT');
  await expect(batch.locator('.tool-wrapper')).not.toHaveAttribute('open');
  await batch.getByText('Tool wrapper', { exact: true }).click();
  await expect(batch).toContainText('WRAPPER_BATCH_PROOF');
  const goal = page.locator('#event-list .event').filter({ hasText: 'GOAL_OBJECTIVE_PROOF' });
  await goal.locator(':scope > details > .action-summary').click();
  await expect(goal.locator('.type-goal')).toHaveText('goal');
  await expect(goal.locator('.event-meta')).toContainText('Main · parent');
  await expect(goal.locator('.event-meta')).toContainText('#');
  await expect(goal.locator('.goal-content')).toContainText('GOAL_OBJECTIVE_PROOF');
  await expect(goal.getByText('Continuation context', { exact: true })).toBeVisible();
  await expect(page.locator('#actions-coverage')).toHaveCount(0);
  await expect(page.locator('#coverage-summary')).toContainText('2 sessions');
  await expect(page.locator('#thread-filter option[value=auto-review-session]')).toHaveCount(0);
  await expect(page.locator('#conversation-thread option[value=auto-review-session]')).toHaveCount(
    0,
  );
  await expect(page.getByRole('slider', { name: 'Turn', exact: true })).toHaveAttribute('max', '3');
  await expect(page.locator('#turn-position')).toHaveText('All 3 turns');
  await page.locator('#thread-filter').selectOption('parent');
  await expect(page.getByRole('slider', { name: 'Turn', exact: true })).toHaveAttribute('max', '2');
  await expect(page.locator('#turn-position')).toHaveText('All 2 turns');
  await page.locator('#turn-slider').fill('2');
  await expect(page.locator('#turn-position')).toContainText('Turn 2');
  await expect(page.locator('#event-list')).toContainText('GOAL_OBJECTIVE_PROOF');
  await expect(page.locator('#event-list')).not.toContainText('NATIVE_COMMAND_PROOF');
  await page.locator('.map-cell').first().click();
  await expect(page.locator('#event-list .selected-event')).toBeVisible();
  await page.reload();
  await expect(page.locator('#thread-filter')).toHaveValue('parent');
  await expect(page.locator('#turn-slider')).toHaveValue('2');
  await page.getByRole('button', { name: 'All turns', exact: true }).click();
  await page.locator('#thread-filter').selectOption('all');
  await reviews.check();
  await expect(page.locator('#coverage-summary')).toContainText('2 sessions');
  await expect(page.locator('#coverage-summary')).toContainText('1 review sessions');
  await expect(page.locator('#thread-filter option[value=__reviews__]')).toHaveCount(1);
  await expect(page.locator('#thread-filter option[value=auto-review-session]')).toHaveCount(0);
  await expect(page.locator('#event-list')).toContainText('REVIEW_CONTEXT_MARKER');
  await expect(page.locator('#event-list')).toContainText('REVIEW_TOOL_MARKER');
  await expect(page.locator('#event-list')).toContainText('Auto-review · auto-rev');
  await page.locator('#kind').selectOption('auto-review');
  await expect(page.locator('#event-list .event')).toHaveCount(1);
  await page.locator('#event-order').selectOption('time');
  await page.reload();
  await expect(reviews).toBeChecked();
  await expect(page.locator('#kind')).toHaveValue('auto-review');
  await expect(page.locator('#event-order')).toHaveValue('time');
  await expect(page.locator('#event-list .event')).toHaveCount(1);
  await reviews.uncheck();
  await page.locator('#kind').selectOption('all');
  await page.locator('#event-order').selectOption('session');
  // File positions increase within each session, rather than mixing unrelated session ordinals.
  const positions = await page.locator('#event-list .event').evaluateAll((rows) =>
    rows.map((row) => ({
      session: row.querySelector('.session-badge')?.getAttribute('title'),
      line: Number(row.querySelector('.source-positions')?.textContent?.match(/#(\d+)/)?.[1]),
    })),
  );
  for (let index = 1; index < positions.length; index++)
    if (positions[index].session === positions[index - 1].session)
      expect(positions[index].line).toBeGreaterThan(positions[index - 1].line);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.action-minimap')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page.evaluate(
      () =>
        document.querySelector('#action-context')!.getBoundingClientRect().top <
        document.querySelector('#event-list')!.getBoundingClientRect().top,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
