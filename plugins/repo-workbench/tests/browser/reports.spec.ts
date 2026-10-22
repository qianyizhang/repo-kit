import { zstdCompressSync } from 'node:zlib';
import { scan } from '../../packages/usage/scan.ts';
import { render, runtime } from '../../packages/usage/build.ts';
import { test, expect, type Page } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
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
      env: { ...(process.env as Record<string, string>), XDG_CACHE_HOME: resolve(temp, 'cache') },
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
async function openHost(page: Page, result: unknown, limited = false) {
  await page.exposeFunction('reportCall', (params: Parameters<Client['callTool']>[0]) =>
    client.callTool(params),
  );
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
  await openHost(page, result);
  const app = page.frameLocator('iframe');
  await expect(app.locator('#report-status')).toContainText('Connected');
  await expect(app.locator('#from')).toHaveValue('');
  await expect(app.locator('#updated')).toContainText('2026-05-09');
  await app.getByRole('button', { name: 'All time', exact: true }).click();
  await app.locator('#report-question').fill('Explain these totals');
  await app.getByRole('button', { name: 'Discuss', exact: true }).click();
  await expect(page.locator('#sent')).toContainText('report_read');
  await expect(app.locator('#report-status')).toContainText('Sent');
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
  await app.getByRole('button', { name: 'Discuss', exact: true }).click();
  await expect(app.locator('#report-status')).toContainText('Delivery unconfirmed');
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
  await expect(app.getByRole('button', { name: 'Discuss', exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
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
  await expect(app.getByRole('button', { name: 'Discuss', exact: true })).toBeDisabled();
  await expect(app.getByRole('button', { name: 'Back to usage' })).toBeHidden();
  await app.getByRole('button', { name: 'Recorded actions', exact: true }).click();
  await expect(app.locator('#event-list')).toBeVisible();
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
  await expect(app.getByRole('button', { name: 'Discuss', exact: true })).toBeDisabled();
});
