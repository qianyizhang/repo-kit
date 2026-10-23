import { expect, test } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { reviewFixture } from '../../packages/trace/review-fixture.ts';
import { renderReview } from '../../packages/session-review/build.ts';
let url = '';
let root = '';
test.beforeAll(async () => {
  root = await mkdtemp(resolve('test-results/action-review-'));
  const document = await reviewFixture(root);
  const html = resolve(root, 'index.html');
  await writeFile(html, await renderReview(document));
  url = pathToFileURL(html).href;
});
test.afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});
test('full exchanges, semantic actions and recorded metrics stay readable with interleaved activity', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await page.locator('.conversation-card .conversation-pair').click({ position: { x: 20, y: 25 } });
  await expect(page.locator('#turn-pair')).toContainText('INPUT_END');
  await expect(page.locator('#turn-pair')).toContainText('RESPONSE_END');
  await expect(page.locator('#turn-detail .turn-metadata')).toContainText('1K input tokens');
  await expect(page.locator('#turn-detail .turn-metadata')).toContainText('100 output tokens');
  await expect(page.locator('#turn-detail .turn-metadata')).toContainText('1m 0s elapsed');
  await page.goto(url + '#view=events');
  const edits = page.locator('#event-list > article').filter({ has: page.locator('.type-edit') });
  await expect(edits).toHaveCount(1);
  await edits.locator(':scope > details').first().locator(':scope > summary').click();
  await expect(edits).toContainText('+new');
  await edits
    .getByText('Source sequence · other activity occurred during this action', { exact: true })
    .click();
  await expect(edits.locator('.source-sequence')).toContainText(
    'Assistant message · separate action',
  );
  await expect(page.locator('#event-list .type-commentary')).toHaveCount(1);
  await expect(page.locator('#event-list .type-response')).toHaveCount(1);
  const image = page.locator('#event-list .image-gallery img');
  await expect(image).toHaveCount(1);
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(1);
  await expect(page.locator('#event-list .type-delegation')).toHaveCount(1);
  await page.locator('#turn-slider').fill('1');
  await expect(page.locator('#action-context .turn-metadata')).toContainText('800 cached');
  await page.screenshot({ path: info.outputPath('semantic-actions.png'), fullPage: true });
  expect(errors).toEqual([]);
});
test('review signals filter observable outcomes and restore the scoped action list', async ({
  page,
}, info) => {
  await page.goto(url + '#view=events&session=session');
  const signals = page.getByRole('navigation', { name: 'Review signals' });
  for (const label of [
    'Mid-turn input',
    'Rejected',
    'Errors',
    'No recorded result',
    'Unmatched result',
  ]) {
    await signals.getByRole('button', { name: label + ' 1', exact: true }).click();
    await expect(page.locator('#event-count')).toHaveText('1 actions');
    await page.reload();
    await expect(signals.getByRole('button', { name: label + ' 1', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await signals.getByRole('button', { name: 'All activity', exact: true }).click();
    await expect(page.locator('#thread-filter')).toHaveValue('session');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('actions-mobile.png'), fullPage: true });
});

test('parallel MCP reads join shell executions and present a chat overview instead of nested JSON', async ({
  page,
}, info) => {
  await page.goto(url + '#view=events');
  const batch = page
    .locator('#event-list > article')
    .filter({ has: page.locator('.batch-count', { hasText: 'parallel' }) });
  await expect(batch).toHaveCount(1);
  await expect(batch.locator('.batch-count')).toHaveText('4 parallel tool calls · 3 shell + 1 MCP');
  await batch.locator(':scope > details > .action-summary').click();
  await expect(batch.locator('.execution-pair')).toHaveCount(4);
  const overview = batch.locator('.thread-read');
  await expect(
    overview.getByRole('heading', { name: 'Blueprint review', exact: true }),
  ).toBeVisible();
  await expect(overview.getByRole('heading', { name: 'Outcome', exact: true })).toBeVisible();
  await expect(overview.locator('strong')).toHaveText('the blueprint');
  await expect(overview).toContainText('Partial overview');
  await expect(overview).not.toContainText('PRIVATE_NOT_FOR_OVERVIEW');
  await expect(batch.getByText('Complete tool input and result', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('parallel-thread-read.png'), fullPage: true });
  await page.getByLabel('Raw text', { exact: true }).check();
  await expect(batch.locator('.thread-read')).toHaveCount(0);
  await page.getByLabel('Raw text', { exact: true }).uncheck();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('questions distinguish delivery from answers, mixed code mode preserves order, and compaction is visible', async ({
  page,
}, info) => {
  await page.goto(url + '#view=events');
  const cards = page.locator('#event-list > article');
  const ask = cards
    .filter({ has: page.locator('.type-ask') })
    .filter({ hasText: 'Keep the case unfinished?' });
  await expect(ask).toHaveCount(1);
  await ask.locator(':scope > details > summary').click();
  await expect(ask.locator('.question-exchange')).toContainText('No linked user reply recorded');
  await expect(ask.locator('.question-exchange')).toContainText('not a user selection');
  await expect(page.locator('#event-list .type-response')).toHaveCount(1);
  const answered = cards
    .filter({ has: page.locator('.type-ask') })
    .filter({ hasText: 'Which scope?' });
  await answered.locator(':scope > details > summary').click();
  await expect(answered.locator('.user-answer')).toHaveText('User replyNarrow');
  const code = cards.filter({ has: page.locator('.type-code-mode') });
  await expect(code).toHaveCount(1);
  await expect(code.locator('.batch-count')).toHaveText('2 sequential tool calls');
  await code.locator(':scope > details > summary').click();
  await expect(code.locator('.execution-pair').first()).toContainText('Source dataset');
  await expect(code.locator('.execution-pair').nth(1)).toContainText('PROCESSED');
  await code.locator('.source-sequence > summary').click();
  await expect(code.locator('.source-sequence')).toContainText('3 hidden records before this step');
  await expect(code.locator('.source-sequence')).toContainText(
    'Private reasoning record · content excluded',
  );
  await expect(code.locator('.source-sequence')).toContainText('Usage bookkeeping');
  const compaction = cards.filter({ has: page.locator('.type-compaction') });
  await expect(compaction).toHaveCount(1);
  await expect(compaction).toContainText('window 2');
  await expect(compaction).toContainText('2.0 s');
  await page
    .getByRole('navigation', { name: 'Review signals' })
    .getByRole('button', { name: 'Compaction 1', exact: true })
    .click();
  await expect(page.locator('#event-count')).toHaveText('1 actions');
  await expect(page.locator('body')).not.toContainText('PRIVATE_COMPACTION_SUMMARY');
  await page.screenshot({ path: info.outputPath('compaction.png'), fullPage: true });
});
