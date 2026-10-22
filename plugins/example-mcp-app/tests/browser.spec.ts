import { test, expect, type Page, type FrameLocator } from '@playwright/test';
async function ready(page: Page, path = '/') {
  await page.goto(path);
  const app = page.frameLocator('iframe');
  await expect(app.locator('#connection')).toHaveText('Connected');
  await expect(app.locator('#run')).toBeEnabled();
  return app;
}
async function journey(app: FrameLocator, id: string) {
  await app.locator(`[data-journey="${id}"]`).click();
}
async function run(app: FrameLocator) {
  await app.locator('#run').click();
  await expect(app.locator('#run')).toBeEnabled();
}
test('delivered iframe groups live tool/resource/error runs and separates fixture traffic', async ({
  page,
}) => {
  const errors: string[] = [],
    calls: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().endsWith('/rpc')) calls.push(request.postData() ?? '');
  });
  const app = await ready(page);
  await journey(app, 'tool');
  await app.locator('#demo-text').fill('One real interaction');
  const before = calls.length;
  await run(app);
  await expect(app.locator('#outcome')).toContainText('Succeeded');
  await expect(app.locator('#app-events .event')).toHaveCount(2);
  await expect(app.locator('#server-events .event')).toHaveCount(2);
  await expect(app.locator('#host-events')).toContainText('Forwarding inferred');
  expect(calls.slice(before).filter((v) => v.includes('"name":"example_trace"'))).toHaveLength(1);
  expect(calls.slice(before).filter((v) => v.includes('"name":"example_report"'))).toHaveLength(1);
  await app.locator('#app-events summary').first().click();
  await expect(app.locator('#app-events')).toContainText('wire ID');
  await page.screenshot({ path: 'test-results/journey-live-desktop.png', fullPage: true });
  await run(app);
  await expect(app.locator('#history option')).toHaveCount(2);
  await expect(app.locator('#app-events .event')).toHaveCount(2);
  await app.locator('#fixture-mode').click();
  const fixtureStart = calls.length;
  for (const id of ['startup', 'tool', 'resource', 'context', 'message', 'error', 'teardown']) {
    await journey(app, id);
    await run(app);
  }
  expect(calls.length).toBe(fixtureStart);
  await expect(app.locator('#outcome')).toContainText('Example outcome');
  await app.locator('#live-mode').click();
  await journey(app, 'tool');
  await expect(app.locator('#history option')).toHaveCount(2);
  await journey(app, 'resource');
  await run(app);
  await expect(app.locator('#server-events .event')).toHaveCount(2);
  await expect(app.locator('#result')).toContainText('Resources supply context');
  await journey(app, 'error');
  await run(app);
  await expect(app.locator('#outcome')).toContainText('Expected tool error');
  await app.locator('#scenario').selectOption('protocol-error');
  await run(app);
  await expect(app.locator('#outcome')).toContainText('Failed');
  await expect(app.locator('#result')).toContainText('not found');
  await journey(app, 'context');
  await run(app);
  await expect(app.locator('#outcome')).toContainText('No model turn');
  await page.locator('#theme').click();
  await expect(app.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'test-results/journey-dark.png', fullPage: true });
  const download = page.waitForEvent('download');
  await app.locator('#export').click();
  expect((await download).suggestedFilename()).toBe('example-mcp-live-trace.json');
  await journey(app, 'teardown');
  await app.locator('#run').click();
  await expect(app.locator('#connection')).toHaveText('Closed');
  await expect(app.locator('#run')).toBeDisabled();
  await expect(app.locator('#outcome')).toContainText('Cleanup acknowledged');
  await page.locator('#reopen').click();
  await expect(app.locator('#connection')).toHaveText('Connected');
  expect(errors).toEqual([]);
});
test('standalone fixtures never call a host; narrow layout and keyboard stay usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url());
  });
  await page.goto('/fixtures');
  await expect(page.locator('#live-mode')).toBeDisabled();
  await page.locator('[data-journey="tool"]').click();
  await page.locator('#run').click();
  await expect(page.locator('#app-events .event')).toHaveCount(2);
  expect(await page.locator('html').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(page.locator('#input-label')).toBeHidden();
  await page.locator('#run').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#app-events summary').first()).toBeFocused();
  await page.screenshot({ path: 'test-results/journey-narrow-top.png' });
  await page.locator('#server-events').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/journey-narrow-traces.png' });
  expect(posts).toEqual([]);
});
test('native-style capabilities gate controls and diagnostic failure stays separate', async ({
  page,
}) => {
  let app = await ready(page, '/?limited');
  await journey(app, 'message');
  await expect(app.locator('#run')).toBeDisabled();
  await expect(app.locator('#availability')).toContainText('did not advertise');
  await journey(app, 'context');
  await expect(app.locator('#run')).toBeDisabled();
  app = await ready(page, '/?trace-error');
  await expect(app.locator('#diagnostic-status')).toContainText('Evidence collection failed');
  await journey(app, 'tool');
  await run(app);
  await expect(app.locator('#outcome')).toContainText('Succeeded');
  await expect(app.locator('#host-events')).toContainText('Partial evidence');
  await expect(app.locator('#connection')).toHaveText('Connected');
});
test('message acknowledgment, rejection and timeout do not claim model delivery or resend', async ({
  page,
}) => {
  const app = await ready(page);
  await journey(app, 'message');
  await run(app);
  await expect(app.locator('#outcome')).toContainText('Check this conversation');
  await page.locator('#message-mode').selectOption('reject');
  await run(app);
  await expect(app.locator('#outcome')).toContainText('rejected');
  await page.locator('#message-mode').selectOption('timeout');
  await app.locator('#run').click();
  await expect(app.locator('[data-journey="tool"]')).toBeDisabled();
  await expect(app.locator('#outcome')).toContainText('Not confirmed', { timeout: 15000 });
  await expect(app.locator('#run')).toBeEnabled();
  await expect(app.locator('#app-events .event').filter({ hasText: 'ui/message' })).toHaveCount(1);
  await expect(app.locator('#history option')).toHaveCount(3);
});

test('an older server schema blocks live actions but leaves fixtures usable', async ({ page }) => {
  await page.goto('/?old-build');
  const app = page.frameLocator('iframe');
  await expect(app.locator('#fixture-mode')).toBeEnabled();
  await journey(app, 'tool');
  await expect(app.locator('#run')).toBeDisabled();
  await expect(app.locator('#availability')).toContainText('Build mismatch');
  await app.locator('#fixture-mode').click();
  await run(app);
  await expect(app.locator('#outcome')).toContainText('Example outcome: Succeeded');
});
