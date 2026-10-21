import { hostDocument } from './host-fixture';
import { test, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, realpath, rm, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

test('native metadata binds without messages; picker and restart preserve selected repository and draft', async ({
  context,
}, info) => {
  const temporary = await realpath(await mkdtemp(resolve(tmpdir(), 'canvas-targets-')));
  const home = resolve(temporary, 'codex-home');
  await mkdir(home);
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  const newChatId = '33333333-3333-4333-8333-333333333333';
  const repos = await Promise.all(
    ['alpha', 'beta'].map(async (name) => {
      const repo = resolve(temporary, name);
      await mkdir(repo);
      execFileSync('git', ['init', '-q', repo]);
      await writeFile(resolve(repo, 'README.md'), name);
      await mkdir(resolve(repo, 'src/pages/exhibits/[project]'), { recursive: true });
      await writeFile(
        resolve(repo, 'src/pages/exhibits/[project]/index.ts'),
        'export const value = 1;',
      );
      return repo;
    }),
  );
  const db = new DatabaseSync(resolve(home, 'state_5.sqlite'));
  db.exec('CREATE TABLE threads (id TEXT PRIMARY KEY, cwd TEXT)');
  ids.forEach((id, i) => db.prepare('INSERT INTO threads VALUES (?,?)').run(id, repos[i]));
  db.close();
  async function start() {
    const client = new Client({ name: 'target-host', version: '1' });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [resolve('dist/canvas-server.mjs')],
        cwd: temporary,
        env: {
          ...process.env,
          CODEX_HOME: home,
          XDG_CONFIG_HOME: resolve(temporary, 'config'),
          XDG_CACHE_HOME: resolve(temporary, 'cache'),
        },
      }),
    );
    return client;
  }
  let client = await start();
  try {
    const resource = (
      await client.readResource({
        uri: (await client.listResources()).resources.find(
          (resource) => resource.name === 'Repo Canvas workbench',
        )!.uri,
      })
    ).contents[0];
    if (!('text' in resource)) throw new Error('Missing HTML');
    const pages = [];
    for (const threadId of [...ids, undefined, newChatId]) {
      const page = await context.newPage();
      pages.push(page);
      await page.exposeFunction(
        'canvasTool',
        (params: { name: string; arguments: Record<string, unknown> }) =>
          client.callTool({ ...params, _meta: threadId ? { threadId } : {} }),
      );
      const hostHtml = await hostDocument(resource.text);
      await page.route('**/target-host', (route) =>
        route.fulfill({ contentType: 'text/html', body: hostHtml }),
      );
      await page.goto('/target-host');
    }
    const [first, second, picker, newChat] = pages.map((p) => p.frameLocator('iframe'));
    await expect(first.locator('.checkout-path')).toHaveText(repos[0]);
    await expect(second.locator('.checkout-path')).toHaveText(repos[1]);
    await expect(picker.getByRole('button', { name: 'Retry automatic connection' })).toBeVisible();
    await expect(picker.getByText(/Codex hasn’t supplied a chat identity/)).toBeVisible();
    await expect(newChat.getByText(/This chat’s repository isn’t available/)).toBeVisible();
    await newChat.getByRole('button', { name: 'Retry automatic connection' }).click();
    await expect(newChat.getByText(/still waiting for workspace context/)).toBeVisible();
    await expect(newChat.getByRole('button', { name: 'Retry automatic connection' })).toBeEnabled();
    await pages[3].evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        ),
    );
    await pages[3].screenshot({ path: info.outputPath('new-chat-picker.png') });
    // Codex persists the workspace after launch. The already-open panel must recover itself.
    const persisted = new DatabaseSync(resolve(home, 'state_5.sqlite'));
    persisted.prepare('INSERT INTO threads VALUES (?,?)').run(newChatId, repos[1]);
    persisted.close();
    await expect(newChat.locator('.checkout-path')).toHaveText(repos[1], { timeout: 12000 });
    await expect(picker.getByRole('button', { name: /alpha/ })).toBeVisible();
    await picker.getByRole('button', { name: /alpha/ }).click();
    await expect(picker.locator('.checkout-path')).toHaveText(repos[0]);
    await second.getByRole('button', { name: 'Inspect src', exact: true }).click();
    await second.getByRole('button', { name: 'Inspect', exact: true }).click();
    await second
      .getByRole('textbox', { name: 'Module responsibility' })
      .fill('Unsaved responsibility survives reconnect');
    await second.locator('summary[aria-label="Connection information"]').click();
    await expect(second.getByText('UI and server builds match.')).toBeVisible();
    await expect(second.getByText(ids[1], { exact: true })).toBeVisible();
    await second.getByRole('button', { name: 'Copy connection details' }).click();
    await expect(second.getByRole('textbox', { name: 'Connection details to copy' })).toHaveValue(
      /Repo Canvas · Connection[\s\S]*Repository: .*beta/,
    );
    await second.getByRole('button', { name: 'Refresh status' }).click();
    await expect(second.getByRole('button', { name: 'Refresh status' })).toBeEnabled();
    await pages[1].evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        ),
    );
    const originalInfo = await second.locator('.connection-info dd').allTextContents();
    await pages[1].screenshot({ path: info.outputPath('connection-info.png') });
    await client.close();
    client = await start();
    await expect
      .poll(
        async () => {
          const result = await client.callTool({ name: 'canvas_read', arguments: {} });
          return (
            JSON.parse((result.content as Array<{ text: string }>)[0].text) as {
              canvases: unknown[];
            }
          ).canvases.length;
        },
        { timeout: 15000 },
      )
      .toBe(4);
    await second.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await expect(second.getByRole('textbox', { name: 'Module responsibility' })).toHaveValue(
      'Unsaved responsibility survives reconnect',
    );
    await expect(second.locator('.checkout-path')).toHaveText(repos[1]);
    await expect(first.locator('.checkout-path')).toHaveText(repos[0]);
    const updatedInfo = await second.locator('.connection-info dd').allTextContents();
    expect(updatedInfo).not.toEqual(originalInfo);
    const betaContext = await second
      .locator('.connection-info dt')
      .filter({ hasText: /^Context$/ })
      .locator('xpath=following-sibling::dd[1]')
      .innerText();
    const draft = await client.callTool({
      name: 'canvas_app',
      arguments: { contextId: betaContext, request: { action: 'draft_read', args: {} } },
      _meta: { threadId: ids[1] },
    });
    expect(draft.isError, JSON.stringify(draft)).not.toBe(true);
    expect(JSON.stringify(draft.structuredContent)).toContain(
      'Unsaved responsibility survives reconnect',
    );
    const downloaded = pages[1].waitForEvent('download');
    await second.getByRole('button', { name: 'Download connection log' }).click();
    const report = JSON.parse(await readFile(await (await downloaded).path(), 'utf8')) as {
      server: { events: Array<{ event: string; threadId?: string }> };
    };
    expect(report.server.events).toContainEqual(
      expect.objectContaining({ event: 'panel.connect', threadId: ids[1] }),
    );
    expect(JSON.stringify(report)).not.toContain('Unsaved responsibility');
    await pages[1].evaluate(() => Object.assign(window, { dropDiagnostics: true }));
    const offlineDownload = pages[1].waitForEvent('download');
    await second.getByRole('button', { name: 'Download connection log' }).click();
    const offline = JSON.parse(await readFile(await (await offlineDownload).path(), 'utf8')) as {
      server: { error: string };
    };
    expect(offline.server.error).toContain('did not acknowledge');
    for (const page of pages)
      expect(
        await page.evaluate(() => (window as unknown as { chatRequests: unknown[] }).chatRequests),
      ).toHaveLength(0);
  } finally {
    await client.close();
    await rm(temporary, { recursive: true, force: true });
  }
});
