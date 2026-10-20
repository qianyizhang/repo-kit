import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
let file = '';
test.beforeAll(() => {
  file = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import {renderReview} from './packages/session-review/build.ts';
    import {mkdtemp,writeFile} from 'node:fs/promises';
    import {resolve} from 'node:path';
    const root = await mkdtemp(resolve('test-results/minimap-fixture-'));
    const events = Array.from({length:240},(_,i) => ({id:'e'+i,key:JSON.stringify(['session','turn','e'+i]),threadId:'session',turnId:'turn',ordinal:i+1,role:'Main',status:'completed',paths:[],relatedThreads:[],sourceTruncated:false,displayTruncated:false,kind:i%2 ? 'edit' : 'command',title:'work '+i,preview:'work '+i,text:'work '+i+'\\n'+('line\\n'.repeat(i%7 ? 2 : 45))}));
    const document = {version:3,title:'Minimap fixture',collectedAt:'2026-10-09',inputs:[],threads:[{id:'session',title:'Fixture',role:'Main',source:{name:'fixture',format:'synthetic',version:1,rawSchemaVersion:1},coverage:{totalItems:240,normalizedItems:240,unsupportedItems:[],excludedItems:[],truncatedItems:0,displayTruncatedItems:0},turns:[{id:'turn',threadId:'session',events}]}],documents:[],media:[]};
    const file = resolve(root,'index.html'); await writeFile(file,await renderReview(document)); console.log(file);
  `,
    ],
    { encoding: 'utf8' },
  ).trim();
  expect(readFileSync(file, 'utf8')).not.toContain('__review-fixture');
  expect(readFileSync(file, 'utf8')).not.toContain('fixture-gallery');
});
test('offline minimap follows scroll and resized cards, including non-first bucket members', async ({
  page,
}, info) => {
  const errors: string[] = [];
  const network: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) network.push(request.url());
  });
  // Actual file:// delivery proves the frontend and stylesheet do not require a server or CDN.
  const key = JSON.stringify(['session', 'turn', 'e1']);
  await page.goto(
    pathToFileURL(file).href + '#' + new URLSearchParams({ view: 'events', event: key }).toString(),
  );
  await expect(page.locator('.map-cell')).toHaveCount(120);
  await expect(page.locator('#event-list .selected-event')).toContainText('work 1');
  await expect(page.locator('.map-cell').first()).toHaveAttribute('aria-current', 'location');
  const row = page.locator('#event-list > article').nth(14);
  await row.evaluate((node) => node.scrollIntoView({ block: 'start' }));
  await expect(page.locator('.map-cell').nth(7)).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('.map-cell[aria-current]')).toHaveCount(1);
  // Opening a tall card changes all following positions; the reading marker must recompute.
  await row.locator(':scope > details > .action-summary').click();
  await page.setViewportSize({ width: 1100, height: 760 });
  await row.evaluate((node) => node.scrollIntoView({ block: 'start' }));
  await expect(page.locator('.map-cell').nth(7)).toHaveAttribute('aria-current', 'location');
  await page.screenshot({ path: info.outputPath('minimap-desktop.png') });
  expect(errors).toEqual([]);
  expect(network).toEqual([]);
});
test('type filters retain their legend, reset within the selected scope, and share semantic colors', async ({
  page,
}, info) => {
  await page.goto(pathToFileURL(file).href + '#view=events');
  await page.locator('#thread-filter').selectOption('session');
  await page.locator('#turn-slider').fill('1');
  await page.locator('#search').fill('work');
  const command = page.getByRole('button', { name: 'Filter command actions', exact: true });
  await command.click();
  await expect(page.locator('#event-count')).toHaveText('120 actions');
  await expect(
    page.getByRole('button', { name: 'Filter edit actions', exact: true }),
  ).toBeVisible();
  const palette = await page.evaluate(() => {
    const badge = document.querySelector('#event-list .type-command')!;
    const legend = document.querySelector('.map-key.type-command')!;
    const cell = document.querySelector('.map-cell.type-command')!;
    return [
      getComputedStyle(badge).color,
      getComputedStyle(legend).color,
      getComputedStyle(cell).backgroundColor,
    ];
  });
  expect(new Set(palette).size).toBe(1);
  await command.click();
  await expect(page.locator('#kind')).toHaveValue('all');
  await expect(page.locator('#event-count')).toHaveText('240 actions');
  await command.click();
  await page.getByRole('button', { name: 'All types', exact: true }).click();
  await expect(page.locator('#thread-filter')).toHaveValue('session');
  await expect(page.locator('#turn-slider')).toHaveValue('1');
  await expect(page.locator('#search')).toHaveValue('work');
  await page.reload();
  await expect(page.locator('#kind')).toHaveValue('all');
  await expect(page.locator('#thread-filter')).toHaveValue('session');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.action-minimap')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('minimap-mobile.png'), fullPage: true });
});
