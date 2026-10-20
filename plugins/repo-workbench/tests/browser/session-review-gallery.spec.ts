import { expect, test } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { resolve } from 'node:path';
let server: ViteDevServer;
let url: string;
test.beforeAll(async () => {
  server = await createServer({
    configFile: resolve('packages/session-review/vite.config.ts'),
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  url = server.resolvedUrls!.local[0];
});
test.afterAll(async () => {
  await server?.close();
});

test('development examples use the actual renderer and keep uncertain evidence separate', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await expect(page.getByRole('complementary', { name: 'Development examples' })).toBeVisible();
  await page.getByRole('link', { name: 'Parallel calls', exact: true }).click();
  await expect(page.getByRole('link', { name: /Usage dashboard/ })).toHaveCount(0);
  await expect(page.locator('#event-list .selected-event .batch-count')).toHaveText(
    '4 parallel tool calls · 3 shell + 1 MCP',
  );
  await page.reload();
  await expect(page.locator('#event-list .selected-event')).toContainText('Blueprint review');
  await page.getByRole('link', { name: 'Interleaved edit', exact: true }).click();
  await expect(page.locator('#event-list .selected-event')).toContainText('example.ts');
  await page.locator('#event-list .source-sequence > summary').click();
  await page
    .locator('#event-list .source-sequence')
    .getByRole('button', { name: /Assistant message.*separate action/ })
    .click();
  await expect(page.locator('#event-list .selected-event')).toContainText('Checking the edit');
  await page.getByRole('link', { name: 'Questions and replies', exact: true }).click();
  await expect(page.locator('#event-list')).toContainText('No linked user reply recorded');
  const answered = page.locator('#event-list > article').filter({ hasText: 'Which scope?' });
  await answered.locator(':scope > details > summary').click();
  await expect(answered).toContainText('Narrow');
  await page.getByRole('link', { name: 'Compaction', exact: true }).click();
  await expect(page.locator('#event-list')).toContainText('window 2');
  await expect(page.locator('#event-list')).toContainText('2.0 s');
  await page.getByRole('link', { name: 'Ambiguous relationship', exact: true }).click();
  const commands = page
    .locator('#event-list > article')
    .filter({ has: page.locator('.action-summary .type-command') });
  await expect(commands).toHaveCount(3);
  await commands.last().locator(':scope > details > summary').click();
  await expect(commands.last()).toContainText('UNATTRIBUTED_RESULT');
  await expect(commands.last()).not.toContainText('Wrapper A complete');
  await expect(commands.last()).not.toContainText('Wrapper B complete');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('complementary', { name: 'Development examples' })).toHaveCount(1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('fixture-gallery-phone.png') });
  await commands.last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('fixture-actions-phone.png') });
  expect(errors).toEqual([]);
});
