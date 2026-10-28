import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { sessionSchema } from '../../packages/repo-canvas/src/model/contracts.ts';

test('catalog discovery is single-flight, pauses while hidden and backs off after failure', async ({
  page,
}) => {
  const html = await readFile('dist/assets/canvas.html', 'utf8');
  await page.clock.install();
  await page.route('**/discovery', (route) =>
    route.fulfill({ contentType: 'text/html', body: html }),
  );
  await page.route('**/api/state', (route) => route.fulfill({ json: { needsRepository: true } }));
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  await page.route('**/api/repositories', async (route) => {
    const call = ++calls;
    if (call === 1) await gate;
    await route.fulfill(call === 2 ? { status: 503 } : { json: [] });
  });
  await page.goto('/discovery');
  await expect.poll(() => calls).toBe(1);
  await page.clock.runFor(15000);
  expect(calls).toBe(1);
  release();
  await expect(page.getByText('No saved repositories yet.', { exact: false })).toBeVisible();
  await page.clock.runFor(5000);
  await expect(page.getByRole('alert')).toHaveText('Cannot load registered repositories');
  expect(calls).toBe(2);
  await page.clock.runFor(9999);
  expect(calls).toBe(2);
  await page.clock.runFor(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(calls).toBe(3);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(15000);
  expect(calls).toBe(3);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => calls).toBe(4);
});

test('a late discovery load cannot replace a newer repository load', async ({ page, request }) => {
  const html = await readFile('dist/assets/canvas.html', 'utf8');
  const snapshot = sessionSchema.parse(
    await (await request.get('http://127.0.0.1:4318/api/state')).json(),
  );
  await page.route('**/discovery', (route) =>
    route.fulfill({ contentType: 'text/html', body: html }),
  );
  await page.route('**/api/repositories', (route) => route.fulfill({ json: [] }));
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  await page.route('**/api/state', async (route) => {
    const call = ++calls;
    if (call === 1) return route.fulfill({ json: { needsRepository: true } });
    if (call === 2) await gate;
    return route.fulfill({ json: { ...snapshot, repo: call === 2 ? '/automatic' : '/manual' } });
  });
  await page.goto('/discovery');
  await expect(page.getByText('Choose a repository for this canvas.')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('repo-canvas-target')));
  await expect.poll(() => calls).toBe(2);
  await page.evaluate(() => window.dispatchEvent(new Event('repo-canvas-target')));
  await expect(page.locator('.checkout-path')).toHaveText('/manual');
  const completed = page.waitForResponse(
    (response) => response.url().endsWith('/api/state') && response.status() === 200,
  );
  release();
  await completed;
  // Let both fetch parsing and the following React commit finish before checking retained state.
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );
  await expect(page.locator('.checkout-path')).toHaveText('/manual');
});
