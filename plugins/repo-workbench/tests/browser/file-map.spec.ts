import { test, expect } from '@playwright/test';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { render, type Inventory } from '../../packages/file-map/index.ts';

test('file map: filters, inspection, reset, empty results and narrow layout', async ({ page }) => {
  await mkdir('test-results', { recursive: true });
  const out = await mkdtemp(resolve('test-results/file-map-'));
  const inventory: Inventory = {
    repo: '/fixture/repo',
    head: 'fixture',
    created: '2026-10-25',
    staged_deletions: [],
    files: ['docs/guide.md', 'src/' + 'long-name-'.repeat(20) + '.ts'].map((path, i) => ({
      path,
      oid: String(i),
      mode: '100644',
      size: 100,
      changes: [],
      nature: i ? 'Source' : 'Documentation',
      basis: 'Path hint',
      action: i ? 'unreviewed' : 'inspect',
      reason: i ? '' : 'Check owner',
      evidence: i ? [] : ['README.md:1'],
      copies: 1,
    })),
  };
  await writeFile(resolve(out, 'report.html'), await render(inventory));
  try {
    await page.goto(`/test-results/${basename(out)}/report.html`);
    // The editable area must remain identifiable before focus supplies a ring.
    const contrast = await page.getByLabel('Find a file or review').evaluate((input) => {
      const luminance = (color: string) => {
        const rgb = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number);
        const linear = rgb.map((v) => {
          const x = v / 255;
          return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        });
        return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
      };
      const style = getComputedStyle(input);
      const border = luminance(style.borderColor);
      return [
        style.backgroundColor,
        getComputedStyle(document.documentElement).backgroundColor,
      ].map((color) => {
        const background = luminance(color);
        return (Math.max(border, background) + 0.05) / (Math.min(border, background) + 0.05);
      });
    });
    expect(Math.min(...contrast)).toBeGreaterThanOrEqual(3);
    await expect(page.locator('#files tr')).toHaveCount(2);
    await page.getByRole('button', { name: 'docs/guide.md', exact: true }).click();
    await expect(page.getByLabel('File details')).toContainText('README.md:1');
    await page.getByRole('combobox', { name: 'Action', exact: true }).selectOption('inspect');
    await expect(page.locator('#files tr')).toHaveCount(1);
    await page.getByLabel('Find a file or review').fill('missing');
    await expect(page.locator('#empty')).toBeVisible();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.locator('#folders button').filter({ hasText: 'docs/' }).click();
    await expect(page.locator('#files tr')).toHaveCount(1);
    await page.getByRole('button', { name: '↑ Parent' }).click();
    await expect(page.locator('#files tr')).toHaveCount(2);
    await page.getByRole('button', { name: inventory.files[1].path, exact: true }).click();
    await page.screenshot({ path: resolve('test-results/file-map-wide.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: inventory.files[1].path, exact: true }).click();
    await expect(page.getByLabel('File details')).toContainText(inventory.files[1].path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await page.locator('#files td').first().boundingBox())!.width).toBeGreaterThan(180);
    await page.screenshot({ path: resolve('test-results/file-map-narrow.png'), fullPage: true });
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
