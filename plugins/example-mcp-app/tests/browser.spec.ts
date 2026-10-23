import { test, expect, type Page, type FrameLocator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
async function ready(page: Page, path = '/') {
  await page.goto(path);
  const ui = page.frameLocator('iframe');
  await expect(ui.locator('#connection')).toContainText('Connected');
  await expect(ui.locator('#run')).toBeEnabled();
  return ui;
}
const scenario = async (ui: FrameLocator, id: string) => {
  await ui.locator(`[data-journey="${id}"]`).click();
};
const run = async (ui: FrameLocator) => {
  await ui.locator('#run').click();
  await expect(ui.locator('#outcome')).not.toContainText('In progress');
};
test('real tool/resource wiring feeds one sequence and log; variants preserve actual error layers', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ui = await ready(page);
  await expect(ui.locator('#actors > div')).toHaveCount(4);
  await scenario(ui, 'tool');
  await ui.locator('#demo-text').fill('Real sequence payload');
  await run(ui);
  await expect(ui.locator('#outcome')).toContainText('Succeeded');
  await expect(ui.locator('#sequence [data-event]')).toHaveCount(4);
  await ui.locator('#sequence [data-event]').first().focus();
  await expect(ui.locator('#payload-tip')).toContainText('Real sequence payload');
  await ui.locator('#sequence [data-event]').first().click();
  await expect(ui.locator('#detail-body')).toContainText('Real sequence payload');
  await ui.locator('#detail-close').click();
  await ui.locator('#log-toggle').click();
  await expect(ui.locator('#log-records tbody tr')).toHaveCount(4);
  await run(ui);
  await expect(ui.locator('#history option')).toHaveCount(2);
  await expect(ui.locator('#sequence [data-event]')).toHaveCount(4);
  await ui.locator('[data-variant="tool-error"]').click();
  await run(ui);
  await expect(ui.locator('#outcome')).toContainText('Tool error');
  await scenario(ui, 'resource');
  await ui.locator('[data-variant="protocol-error"]').click();
  await run(ui);
  await expect(ui.locator('#outcome')).toContainText('Failed');
  await scenario(ui, 'resource');
  await run(ui);
  await expect(ui.locator('#outcome')).toContainText('JSON resource returned');
  await page.screenshot({ path: 'test-results/sequence-live.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('fixture variants never call the host, preserve drafts, and fit a narrow keyboard-accessible view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url());
  });
  await page.goto('/fixtures');
  await expect(page.locator('#live-mode')).toBeDisabled();
  await page.getByRole('button', { name: 'App info', exact: true }).click();
  await page.getByRole('button', { name: 'Tools and API contracts', exact: true }).click();
  await expect(page.locator('#detail-body details')).toHaveCount(10);
  await page.locator('#detail-close').click();
  await page.locator('[data-journey="tool"]').click();
  await page.locator('#demo-text').fill('Retained draft');
  await page.locator('#run').click();
  await page.locator('[data-journey="context"]').click();
  await page.locator('[data-journey="tool"]').click();
  await expect(page.locator('#demo-text')).toHaveValue('Retained draft');
  await page.locator('[data-variant="tool-error"]').click();
  await expect(page.locator('#outcome')).toContainText('Expected tool failure');
  await page.locator('#sequence [data-event]').first().focus();
  await expect(page.locator('#payload-tip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#payload-tip')).toBeHidden();
  await page.locator('[data-journey="investigate"]').click();
  await page.locator('[data-phase="message"]').click();
  await expect(page.locator('.event-row.dim')).toHaveCount(10);
  expect(await page.locator('html').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/sequence-narrow.png', fullPage: true });
  expect(posts).toEqual([]);
});
test('live sequence capture saves only the selected run and exposes recording health', async ({
  page,
}) => {
  const ui = await ready(page);
  await scenario(ui, 'tool');
  await ui.locator('#demo-text').fill('Selected capture marker');
  await run(ui);
  await expect(ui.locator('#actors > div')).toHaveCount(4);
  await expect(ui.locator('#sequence [data-event]')).toHaveCount(4);
  await ui.getByRole('button', { name: 'App info', exact: true }).click();
  await expect(ui.locator('#recording-info')).toContainText('Metadata on disk');
  await ui.locator('#detail-close').click();
  await ui.getByRole('button', { name: 'Save interaction capture', exact: true }).click();
  await expect(ui.locator('#capture-status')).toContainText('Saved run');
  const path = (await ui.locator('#capture-status').textContent())!.split(' to ')[1]!;
  const body = await readFile(path, 'utf8');
  const capture = z
    .object({
      interaction: z.string(),
      events: z.array(
        z.object({ interaction: z.string(), payload: z.object({ text: z.string() }) }),
      ),
    })
    .parse(JSON.parse(body));
  expect(capture.events).toHaveLength(4);
  expect(capture.events.every((event) => event.interaction === capture.interaction)).toBe(true);
  expect(body).toContain('Selected capture marker');
  await ui.locator('#fixture-mode').click();
  await expect(
    ui.getByRole('button', { name: 'Save interaction capture', exact: true }),
  ).toBeDisabled();
});
test('missing capabilities and trace failures are distinct from operation success', async ({
  page,
}) => {
  let ui = await ready(page, '/?limited');
  await scenario(ui, 'message');
  await expect(ui.locator('#run')).toBeDisabled();
  await expect(ui.locator('#availability')).toContainText('did not advertise');
  await scenario(ui, 'context');
  await expect(ui.locator('#run')).toBeDisabled();
  ui = await ready(page, '/?trace-error');
  await scenario(ui, 'tool');
  await run(ui);
  await expect(ui.locator('#outcome')).toContainText('Succeeded');
  await expect(ui.locator('#diagnostic-status')).toContainText('Evidence collection failed');
  await expect(ui.locator('#sequence [data-event]')).toHaveCount(2);
  const calls: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/rpc')) calls.push(r.postData() ?? '');
  });
  await ui.locator('#refresh').click();
  await expect(ui.locator('#refresh')).toBeEnabled();
  expect(calls.filter((c) => c.includes('example_echo'))).toHaveLength(0);
});
test('message acknowledgment, rejection and timeout use SDK responses; uncertain resend is deliberate', async ({
  page,
}) => {
  const ui = await ready(page);
  await scenario(ui, 'message');
  await run(ui);
  await expect(ui.locator('#outcome')).toContainText('Check this conversation');
  await expect(ui.locator('.unobserved')).toContainText('not observed');
  await page.locator('#message-mode').selectOption('reject');
  await run(ui);
  await expect(ui.locator('#outcome')).toContainText('rejected');
  await expect(ui.locator('.unobserved')).toHaveCount(0);
  await page.locator('#message-mode').selectOption('timeout');
  await ui.locator('#run').click();
  await expect(ui.locator('#outcome')).toContainText('Not confirmed', { timeout: 15000 });
  await expect(ui.locator('#run')).toBeDisabled();
  await expect(ui.locator('#history option')).toHaveCount(3);
  await ui.locator('#check-conversation').click();
  await ui.locator('#checked').click();
  await expect(ui.locator('#run')).toBeEnabled();
  await ui.locator('#run').click();
  await expect(ui.locator('#confirm-send')).toBeVisible();
  await ui.locator('#detail-close').click();
  await expect(ui.locator('#history option')).toHaveCount(3);
});
test('a composite journey uses real operations and requires an explicit click for every step', async ({
  page,
}) => {
  const ui = await ready(page);
  await scenario(ui, 'investigate');
  for (const label of ['Read resource', 'Call echo', 'Update context', 'Send message']) {
    await expect(ui.locator('#run')).toHaveText(label);
    await run(ui);
  }
  await expect(ui.locator('#outcome')).toContainText('Host acknowledged');
  await expect(ui.locator('#sequence [data-event]')).toHaveCount(12);
  await expect(ui.locator('#run')).toHaveText('Read resource');
  await ui.locator('[data-phase="message"]').click();
  await expect(ui.locator('.event-row.dim')).toHaveCount(10);
});
test('actual partial-input notifications assemble a stable row and remain in the raw event log', async ({
  page,
}) => {
  const ui = await ready(page, '/?partial-input');
  await expect(ui.locator('#sequence')).toContainText('Tool input · streaming');
  await ui.locator('#sequence button').filter({ hasText: 'Tool input · streaming' }).click();
  await expect(ui.locator('#detail-body')).toContainText('partial draft');
  await expect(ui.locator('#detail-body')).toContainText('final input', { timeout: 10000 });
  await ui.locator('#detail-close').click();
  await expect(ui.locator('#sequence')).toContainText('Tool input · complete');
  await ui.locator('#log-toggle').click();
  await expect(ui.locator('#log-records')).toContainText('ui/notifications/tool-input-partial');
});
test('teardown during a pending real request aborts observation and cannot overwrite closed state', async ({
  page,
}) => {
  const ui = await ready(page, '/?slow-tool');
  await scenario(ui, 'tool');
  await ui.locator('#run').click();
  await expect(ui.locator('#outcome')).toContainText('In progress');
  await page.locator('#teardown').click();
  await expect(ui.locator('#connection')).toContainText('Closed');
  await expect(ui.locator('#run')).toBeDisabled();
  await expect(ui.locator('#outcome')).toContainText('Panel closed');
  await page.locator('#host-status').filter({ hasText: 'Teardown acknowledged' }).waitFor();
  await expect(ui.locator('#connection')).toContainText('Closed');
});
test('export, deliberate closure, theme and a fresh app lifetime use host wiring', async ({
  page,
}) => {
  const ui = await ready(page);
  await scenario(ui, 'tool');
  await run(ui);
  await page.locator('#theme').click();
  await expect(ui.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'test-results/sequence-dark.png', fullPage: true });
  const download = page.waitForEvent('download');
  await ui.locator('#export').click();
  expect((await download).suggestedFilename()).toBe('example-mcp-live-trace.json');
  await scenario(ui, 'teardown');
  await ui.locator('#run').click();
  await expect(ui.locator('#confirm-close')).toBeDisabled();
  await ui.locator('#close-ack').check();
  await ui.locator('#confirm-close').click();
  await expect(ui.locator('#connection')).toContainText('Closed');
  await expect(ui.locator('#outcome')).toContainText('Cleanup acknowledged');
  await page.locator('#reopen').click();
  await expect(ui.locator('#connection')).toContainText('Connected');
});
test('older builds block live operations without fixture fallback', async ({ page }) => {
  await page.goto('/?old-build');
  const ui = page.frameLocator('iframe');
  await expect(ui.locator('#fixture-mode')).toBeEnabled();
  await scenario(ui, 'tool');
  await expect(ui.locator('#run')).toBeDisabled();
  await expect(ui.locator('#availability')).toContainText('Build mismatch');
  await ui.locator('#fixture-mode').click();
  await expect(ui.locator('#outcome')).toContainText('Example');
});

test('composite continuation rechecks capabilities before the next operation', async ({ page }) => {
  const ui = await ready(page, '/?limited');
  await scenario(ui, 'investigate');
  await run(ui);
  await run(ui);
  await expect(ui.locator('#run')).toHaveText('Update context');
  await expect(ui.locator('#run')).toBeDisabled();
  await expect(ui.locator('#outcome')).toContainText('Next step');
  await expect(ui.locator('#availability')).toContainText('did not advertise');
  await expect(page.locator('#host-status')).not.toContainText('Context stored');
});
