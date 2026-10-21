import { test, expect, type Page } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canvasMcp } from '../../packages/repo-canvas/src/server/mcp';
import { Repository } from '../../packages/repo-canvas/src/server/repository';
import { hostDocument } from './host-fixture';

async function withHost(
  page: Page,
  options: { messaging?: boolean; malformed?: boolean },
  run: () => Promise<void>,
) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'canvas-host-contract-')));
  const previousConfig = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = join(root, 'config');
  execFileSync('git', ['init', '-q', root]);
  await writeFile(join(root, 'README.md'), 'Host contract fixture');
  const server = canvasMcp(undefined, new Repository(root));
  const client = new Client({ name: 'host-contract', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  try {
    const uri = (await client.listResources()).resources[0].uri;
    const resource = (await client.readResource({ uri })).contents[0];
    if (!('text' in resource)) throw new Error('Expected HTML');
    await page.exposeFunction('canvasTool', async (params: CallToolRequest['params']) => {
      if (
        options.malformed &&
        (params.arguments?.request as { action?: string })?.action === 'state'
      )
        return { content: [], structuredContent: { value: { document: 'invalid' } } };
      return client.callTool(params);
    });
    const html = await hostDocument(resource.text, {
      messaging: options.messaging ?? true,
      theme: 'light',
    });
    await page.route('**/contract-host', (route) =>
      route.fulfill({ contentType: 'text/html', body: html }),
    );
    await page.goto('/contract-host');
    await run();
  } finally {
    await page.close();
    await client.close();
    await server.close();
    if (previousConfig === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previousConfig;
    await rm(root, { recursive: true, force: true });
  }
}

test('SDK host negotiates the app, changes theme and observes actual dimensions under CSP', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await withHost(page, {}, async () => {
    const ui = page.frameLocator('iframe');
    await expect(ui.locator('.checkout-path')).toBeVisible();
    await expect(ui.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(ui.locator('body')).toHaveCSS('color', 'rgb(34, 44, 37)');
    await page.screenshot({ path: info.outputPath('canvas-light.png') });
    await page.evaluate(() => window.testHost.setHostContext({ theme: 'dark' }));
    await expect(ui.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(ui.locator('body')).toHaveCSS('color', 'rgb(232, 233, 226)');
    await page.setViewportSize({ width: 780, height: 640 });
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.hostSizes.some((size) => size.width === 780 && size.height !== 1000),
        ),
      )
      .toBe(true);
    await page.screenshot({ path: info.outputPath('canvas-dark-compact.png') });
    expect(errors).toEqual([]);
  });
});

test('missing messaging capability prevents enqueueing a chat request', async ({ page }) => {
  await withHost(page, { messaging: false }, async () => {
    const ui = page.frameLocator('iframe');
    await expect(ui.locator('.checkout-path')).toBeVisible();
    await ui.getByRole('textbox', { name: 'Message Codex' }).fill('Capability check');
    await ui.getByRole('button', { name: 'Send to chat' }).click();
    await expect(ui.getByText('This host does not support app messages.')).toBeVisible();
    expect(await page.evaluate(() => window.chatRequests.length)).toBe(0);
    expect(await page.evaluate(() => window.hostCalls.includes('send'))).toBe(false);
  });
});

test('malformed state stays out of the editor and can be retried', async ({ page }) => {
  await withHost(page, { malformed: true }, async () => {
    const ui = page.frameLocator('iframe');
    await expect(ui.getByRole('alert')).toContainText('invalid');
    await expect(ui.getByRole('button', { name: 'Retry loading map' })).toBeVisible();
    await expect(ui.locator('.workbench')).toHaveCount(0);
  });
});

test('teardown cancels pending tool calls instead of leaving UI work waiting', async ({ page }) => {
  await withHost(page, {}, async () => {
    const ui = page.frameLocator('iframe');
    await expect(ui.locator('.checkout-path')).toBeVisible();
    await page.evaluate(() => {
      window.dropDiagnostics = true;
    });
    await ui.locator('summary[aria-label="Connection information"]').click();
    await expect
      .poll(() => page.evaluate(() => window.hostCalls.includes('diagnostics')))
      .toBe(true);
    await page.evaluate(() => window.testHost.teardownResource({}));
    await expect(ui.locator('.connection-info [role="alert"]')).toContainText('Canvas closed', {
      timeout: 2000,
    });
  });
});

test('an uncertain message is never sent twice automatically', async ({ page }) => {
  await withHost(page, {}, async () => {
    const ui = page.frameLocator('iframe');
    await expect(ui.locator('.checkout-path')).toBeVisible();
    await page.evaluate(() => {
      window.dropMessages = true;
    });
    await ui.getByRole('textbox', { name: 'Message Codex' }).fill('One deliberate request');
    await ui.getByRole('button', { name: 'Send to chat' }).click();
    await expect.poll(() => page.evaluate(() => window.chatRequests.length)).toBe(1);
    await expect(ui.getByText(/Delivery is uncertain/)).toBeVisible({ timeout: 35000 });
    await expect(ui.getByRole('button', { name: 'Close request' })).toBeVisible();
    expect(await page.evaluate(() => window.chatRequests.length)).toBe(1);
  });
});
