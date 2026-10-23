import { test, expect, type Page } from '@playwright/test';
import { HostTestClient as Client } from '../host-client.ts';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
  const client = new Client({ name: 'host-contract', version: '1' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve('dist/canvas-server.mjs'), '--repo', root],
      env: {
        ...process.env,
        XDG_CONFIG_HOME: join(root, 'config'),
        XDG_STATE_HOME: join(root, 'state'),
      },
      stderr: 'pipe',
    }),
  );
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
      return client.callTool({
        ...params,
        _meta: { ...params._meta, threadId: '11111111-1111-4111-8111-111111111111' },
      });
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
    await ui.getByRole('button', { name: 'App info', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.hostCalls.includes('diagnostics_info')))
      .toBe(true);
    await page.evaluate(() => window.testHost.teardownResource({}));
    await expect(ui.locator('.mcp-observability [role="status"]')).toContainText(
      /closed|uncertain|abort/i,
      {
        timeout: 2000,
      },
    );
  });
});

test('an uncertain message is never sent twice automatically', async ({ page }) => {
  await withHost(page, {}, async () => {
    const ui = page.frameLocator('iframe');
    await expect(ui.locator('.checkout-path')).toBeVisible();
    await page.evaluate(() => {
      window.dropMessages = true;
    });
    await ui.getByLabel('Attach selection and notes').check();
    await ui.getByRole('textbox', { name: 'Message Codex' }).fill('One deliberate request');
    await ui.getByRole('button', { name: 'Send to chat' }).click();
    await expect.poll(() => page.evaluate(() => window.chatRequests.length)).toBe(1);
    await expect(ui.getByText(/Delivery is uncertain/)).toBeVisible({ timeout: 35000 });
    await expect(ui.getByRole('button', { name: 'Close local request' })).toBeVisible();
    expect(await page.evaluate(() => window.chatRequests.length)).toBe(1);
  });
});

test('a frozen send survives ninety seconds of actual background polling', async ({ page }) => {
  test.setTimeout(120000);
  await withHost(page, {}, async () => {
    const ui = page.frameLocator('iframe');
    await expect(ui.locator('.checkout-path')).toBeVisible();
    const exact = '  retained user action  ';
    await ui.getByRole('textbox', { name: 'Message Codex' }).fill(exact);
    await ui.getByRole('button', { name: 'Send to chat' }).click();
    await expect.poll(() => page.evaluate(() => window.chatRequests.length)).toBe(1);
    expect(await page.evaluate(() => window.chatRequests[0])).toMatchObject({
      content: [{ text: exact }],
    });
    // This is the temporal acceptance case: the former FIFO lost the send after ~64 seconds.
    await page.waitForTimeout(91000);
    expect(
      await page.evaluate(() => window.hostCalls.filter((name) => name === 'agent_read').length),
    ).toBeGreaterThan(60);
    await ui.getByRole('button', { name: 'Inspect last send' }).click();
    const dialog = ui.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: /ui\/message.*request/ })).toBeVisible();
    await dialog.getByRole('button', { name: /ui\/message.*request/ }).click();
    await expect(dialog.locator('.interaction-split pre')).toContainText(exact);
    const calls = await page.evaluate(() => window.hostCalls.length);
    await expect
      .poll(() => page.evaluate(() => window.hostCalls.length))
      .toBeGreaterThan(calls + 2);
    await expect(dialog.getByRole('button', { name: /ui\/message.*request/ })).toBeFocused();
    await expect(dialog.locator('.interaction-split pre')).toContainText(exact);
    expect(await page.evaluate(() => window.chatRequests.length)).toBe(1);
  });
});
