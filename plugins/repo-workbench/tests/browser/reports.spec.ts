import { zstdCompressSync } from 'node:zlib';
import { z } from 'zod';
import { eventSchema } from '../../../mcp-app-runtime/src/events.ts';
import { scan } from '../../packages/usage/scan.ts';
import { render, runtime } from '../../packages/usage/build.ts';
import { test, expect, type Page } from '@playwright/test';
import { HostTestClient as Client } from '../host-client.ts';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, mkdir, readFile, rm, appendFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { build } from 'rolldown';
import { createFixture } from '../../packages/usage/fixture.ts';
let client: Client,
  temp = '',
  logs = '',
  host = '',
  html = '',
  standalone = '';
test.beforeAll(async () => {
  temp = await mkdtemp(resolve(tmpdir(), 'reports-browser-'));
  logs = resolve(temp, 'logs');
  await mkdir(logs);
  await createFixture(logs);
  await appendFile(
    resolve(logs, 'parent.jsonl'),
    JSON.stringify({
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        message: 'LAZY_BODY_BEGIN ' + 'retained '.repeat(2000) + ' LAZY_BODY_END',
      },
    }) + '\n',
  );
  client = new Client({ name: 'reports-browser', version: '1' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve('dist/reports-server.mjs')],
      stderr: 'pipe',
      env: {
        ...(process.env as Record<string, string>),
        XDG_CACHE_HOME: resolve(temp, 'cache'),
        MCP_APP_LOG_ROOT: resolve(temp, 'diagnostics'),
      },
    }),
  );
  const archived = (await readFile(resolve(logs, 'parent.jsonl'), 'utf8'))
    .replaceAll('parent', 'old-parent')
    .replaceAll('2026-10-09', '2026-05-09');
  await writeFile(resolve(logs, 'old.jsonl.zst'), zstdCompressSync(archived));
  standalone = await render(await scan([logs]), await runtime());
  html = await readFile('dist/assets/reports.html', 'utf8');
  const bundle = await build({
    write: false,
    input: 'tests/browser/reports-host.ts',
    platform: 'browser',
    output: { format: 'iife', codeSplitting: false },
  });
  const chunk = bundle.output.find((c) => c.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('Missing host');
  host = chunk.code;
});
test.afterAll(async () => {
  await client?.close();
  await rm(temp, { recursive: true, force: true });
});
async function openHost(
  page: Page,
  result: unknown,
  limited = false,
  beforeCall?: (params: Parameters<Client['callTool']>[0]) => Promise<void>,
  beforeMessage: () => Promise<void> = () => Promise.resolve(),
) {
  await page.exposeFunction('reportMessage', beforeMessage);
  await page.exposeFunction('reportCall', async (params: Parameters<Client['callTool']>[0]) => {
    await beforeCall?.(params);
    return client.callTool({
      ...params,
      _meta: { ...params._meta, threadId: '11111111-1111-4111-8111-111111111111' },
    });
  });
  await page.route('**/reports-host', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<html><head><meta charset="utf-8"></head><body style="margin:0"><button id="theme">Theme</button><button id="close">Close</button><select id="delivery"><option>accept</option><option>reject</option></select><p id="sent"></p><script>window.boot=${JSON.stringify({ html, result, limited }).replace(/</g, '\\u003c')};${host.replace(/<\/script/gi, '<\\/script')}</script></body></html>`,
    }),
  );
  await page.goto('/reports-host');
}
test('usage to trace, lazy source, frozen discussion, refresh, theme and teardown under opaque CSP', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const result = await client.callTool({ name: 'usage_open', arguments: { roots: [logs] } });
  const calls: string[] = [];
  await openHost(page, result, false, async (params) => {
    calls.push(JSON.stringify(params));
    await Promise.resolve();
  });
  const app = page.frameLocator('iframe');
  await expect(app.locator('#report-status')).toContainText('Connected');
  await expect(app.locator('#from')).toHaveValue('');
  await expect(app.locator('#updated')).toContainText('2026-05-09');
  await app.getByRole('button', { name: 'All time', exact: true }).click();
  await app.locator('#report-question').fill('hi');
  const before = calls.length;
  await app.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('#sent')).toContainText('hi');
  expect(
    (JSON.parse((await page.locator('#sent').textContent())!) as { content: unknown }).content,
  ).toEqual([{ type: 'text', text: 'hi' }]);
  expect(calls.slice(before).some((c) => c.includes('select_'))).toBe(false);
  await app.locator('#report-question').fill('Explain these totals');
  await app.getByLabel('Attach filters or open evidence').check();
  await app.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('#sent')).toContainText('selectionId');
  await expect(page.locator('#sent')).toContainText('Explain these totals');
  await expect(page.locator('#sent')).not.toContainText('sha256');
  await expect(page.locator('#sent')).not.toContainText('report_read');
  await expect(app.locator('#report-status')).toContainText('Accepted by host');
  await app.getByRole('button', { name: 'Refresh logs' }).click();
  await expect(app.locator('#message')).toContainText('Refreshed');
  await app.locator('#sessions tbody tr').first().click();
  await expect(app.locator('#evidence')).toBeVisible();
  await app
    .getByRole('link', { name: /Open full trace/ })
    .first()
    .click();
  await expect(app.locator('#report-status')).toContainText('Trace ·');
  await expect(app.locator('#root')).toContainText('Conversation');
  await app.getByRole('button', { name: 'Recorded actions', exact: true }).click();
  const lazy = app.locator('#event-list > article').filter({ hasText: 'LAZY_BODY_BEGIN' });
  await lazy.locator('summary').first().click();
  await expect(lazy).toContainText('LAZY_BODY_END');
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await expect(app.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'test-results/reports-trace-dark.png' });
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await page.screenshot({ path: 'test-results/reports-trace.png' });
  await app.getByRole('button', { name: 'Back to usage' }).click();
  await expect(app.locator('#usage-view')).toBeVisible();
  await app.locator('#close-evidence').click();
  await page.locator('#delivery').selectOption('reject');
  await app.locator('#report-question').fill('Keep this question');
  await app.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(app.locator('#report-status')).toContainText('Host rejected');
  await expect(app.locator('#report-question')).toHaveValue('Keep this question');
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await expect(app.locator('html')).toHaveAttribute('data-theme', 'dark');
  const standalonePage = await page.context().newPage();
  await standalonePage.route('**/standalone-report', (route) =>
    route.fulfill({ contentType: 'text/html', body: standalone }),
  );
  await standalonePage.emulateMedia({ colorScheme: 'dark' });
  await standalonePage.goto('http://127.0.0.1:4385/standalone-report');
  const palette = (el: Element) => ({
    color: getComputedStyle(el).color,
    background: getComputedStyle(el).backgroundColor,
  });
  expect(await app.locator('.card').first().evaluate(palette)).toEqual(
    await standalonePage.locator('.card').first().evaluate(palette),
  );
  await expect(standalonePage.locator('#updated')).toContainText('2026-05-09');
  expect(await app.locator('#measure').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
    await app
      .locator('.card')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  );
  await standalonePage.screenshot({ path: 'test-results/reports-standalone-dark.png' });
  await standalonePage.close();
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await expect(app.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: 'test-results/reports-light.png' });
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await app.locator('html').evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/reports-dark.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await app.locator('html').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await app.locator('html').evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/reports-narrow.png' });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(app.locator('#report-status')).toContainText('closed');
  await expect(app.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('cached summary renders before refresh finishes and retains filters and discussion draft', async ({
  page,
}) => {
  const seed = await client.callTool({ name: 'usage_open', arguments: { roots: [logs] } });
  const contextId = (seed.structuredContent as { contextId: string }).contextId;
  // Force the seed scan to finish, including persistence, through the real protocol.
  await client.callTool({
    name: 'report_app',
    arguments: { contextId, expectedRevision: 0, request: { action: 'refresh' } },
  });
  const result = await client.callTool({ name: 'usage_open', arguments: { roots: [logs] } });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const actions: string[] = [];
  await openHost(page, result, false, async (params) => {
    const action = (params.arguments?.request as { action?: string } | undefined)?.action;
    if (action) actions.push(action);
    if (action === 'status') await gate;
  });
  const app = page.frameLocator('iframe');
  await expect(app.locator('#report-status')).toContainText('Cached summary');
  await expect(app.locator('#total')).not.toHaveText('—');
  await app.locator('#search').fill('parent');
  await app.locator('#report-question').fill('Keep my draft while refreshing');
  expect(actions).not.toContain('evidence');
  expect(actions).not.toContain('export');
  await page.screenshot({ path: 'test-results/reports-cached.png' });
  release();
  await expect(app.locator('#report-status')).toContainText('Connected');
  await expect(app.locator('#search')).toHaveValue('parent');
  await expect(app.locator('#report-question')).toHaveValue('Keep my draft while refreshing');
  await app.locator('#timezone').selectOption('UTC');
  await expect(app.locator('#footer-count')).toContainText('UTC');
  await app.locator('#sessions tbody tr').first().click();
  await expect(app.locator('#evidence .record').first()).toBeVisible();
  expect(actions).toContain('evidence');
});

test('late message acceptance preserves a newer draft and attachment choice', async ({ page }) => {
  const result = await client.callTool({ name: 'usage_open', arguments: { roots: [logs] } });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await openHost(page, result, false, undefined, () => gate);
  const app = page.frameLocator('iframe');
  await expect(app.locator('#total')).not.toHaveText('—');
  await app.locator('#report-question').fill('First question');
  await app.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('#sent')).toContainText('First question');
  await expect(app.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  await app.locator('#report-question').fill('Next question');
  await app.getByLabel('Attach filters or open evidence').check();
  release();
  await expect(app.locator('#report-status')).toContainText('Accepted by host');
  await expect(app.locator('#report-question')).toHaveValue('Next question');
  await expect(app.getByLabel('Attach filters or open evidence')).toBeChecked();
  await expect(app.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
  await expect(page.locator('#sent')).not.toContainText('Next question');
});

test('direct trace works when conversation capability is absent', async ({ page }) => {
  const result = await client.callTool({
    name: 'trace_open',
    arguments: { roots: [logs], session: 'parent' },
  });
  await openHost(page, result, true);
  const app = page.frameLocator('iframe');
  await expect(app.locator('#report-status')).toContainText('Trace · parent');
  await app.locator('#report-question').fill('Unavailable conversation');
  await expect(app.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  await expect(app.getByRole('button', { name: 'Back to usage' })).toBeHidden();
  await app.getByRole('button', { name: 'Recorded actions', exact: true }).click();
  await expect(app.locator('#event-list')).toBeVisible();
});

test('background refresh preserves an unconfirmed discussion and its draft', async ({ page }) => {
  const seed = await client.callTool({ name: 'usage_open', arguments: { roots: [logs] } });
  await client.callTool({
    name: 'report_app',
    arguments: {
      contextId: (seed.structuredContent as { contextId: string }).contextId,
      expectedRevision: 0,
      request: { action: 'refresh' },
    },
  });
  const result = await client.callTool({ name: 'usage_open', arguments: { roots: [logs] } });
  const contextId = (result.structuredContent as { contextId: string }).contextId;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await openHost(page, result, false, async (params) => {
    if ((params.arguments?.request as { action?: string } | undefined)?.action === 'status')
      await gate;
  });
  const app = page.frameLocator('iframe');
  await expect(app.locator('#report-status')).toContainText('Cached summary');
  await page.locator('#delivery').selectOption('reject');
  await app.locator('#report-question').fill('Keep this unconfirmed question');
  await app.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(app.locator('#report-status')).toContainText('Host rejected');
  release();
  await expect
    .poll(
      async () =>
        (
          await client.callTool({
            name: 'report_app',
            arguments: { contextId, expectedRevision: 0, request: { action: 'status' } },
          })
        ).isError,
    )
    .toBe(true);
  await app.locator('#sessions tbody tr').first().click();
  await expect(app.locator('#evidence .record').first()).toBeVisible();
  await expect(app.locator('#report-status')).toContainText('Host rejected');
  await expect(app.locator('#report-question')).toHaveValue('Keep this unconfirmed question');
});

test('failed opening tool is visible instead of an endless connecting state', async ({ page }) => {
  const result = await client.callTool({
    name: 'trace_open',
    arguments: { roots: [logs], session: 'missing' },
  });
  expect(result.isError).toBe(true);
  await openHost(page, result);
  const app = page.frameLocator('iframe');
  await expect(app.locator('#report-status')).toContainText('Session is not in these log roots');
  await expect(app.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
});

test('plain report message has a frozen inspector and an explicit one-interaction capture', async ({
  page,
}) => {
  const result = await client.callTool({ name: 'usage_open', arguments: { roots: [logs] } });
  await openHost(page, result);
  const app = page.frameLocator('iframe');
  await expect(app.locator('#total')).not.toHaveText('—');
  await app.locator('#report-question').fill('diagnostic plain message');
  await app.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(app.locator('#report-status')).toContainText('Accepted by host');
  await app.getByRole('button', { name: 'Inspect send', exact: true }).click();
  const inspector = app.locator('dialog.mcp-observability');
  await expect(inspector.locator('ol button')).toHaveCount(2);
  await inspector.locator('ol button').first().click();
  const event = eventSchema.parse(JSON.parse((await inspector.locator('pre').textContent())!));
  expect(JSON.parse(event.payload.text)).toEqual({
    role: 'user',
    content: [{ type: 'text', text: 'diagnostic plain message' }],
  });
  const info = z
    .object({ directory: z.string() })
    .parse((await client.callTool({ name: 'diagnostics_info', arguments: {} })).structuredContent);
  const before = await readFile(resolve(String(info.directory), 'app.jsonl'), 'utf8');
  expect(before).not.toContain('diagnostic plain message');
  await inspector.getByRole('button', { name: 'Save diagnostic capture', exact: true }).click();
  const saved = inspector.locator('[role="status"]').last();
  await expect(saved).toContainText('Saved 2 observations');
  const path = (await saved.textContent())!.split(' to ')[1];
  const capture = z
    .object({ events: z.array(eventSchema) })
    .parse(JSON.parse(await readFile(path, 'utf8')));
  expect(capture.events).toHaveLength(2);
  expect(
    capture.events.every((item: { interaction: string }) => item.interaction === event.interaction),
  ).toBe(true);
  await inspector.getByRole('button', { name: 'Tools', exact: true }).click();
  await expect(inspector.locator('details')).toHaveCount(14);
  await inspector.getByRole('button', { name: 'Conversation flow', exact: true }).click();
  await expect(inspector).toContainText('Plain message · fixture');
  await page.locator('#theme').click();
  await expect(inspector).toHaveCSS(
    'color',
    await app.locator('body').evaluate((body) => getComputedStyle(body).color),
  );
  await page.setViewportSize({ width: 390, height: 950 });
  await page.screenshot({ path: 'test-results/browser/report-observability-narrow.png' });
});
