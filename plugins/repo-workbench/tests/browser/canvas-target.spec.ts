import { hostDocument } from './host-fixture';
import { test, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, realpath, rm, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

test('failed workspace discovery retries explicitly and yields to manual selection', async ({
  page,
}) => {
  const temporary = await realpath(await mkdtemp(resolve(tmpdir(), 'canvas-discovery-')));
  const home = resolve(temporary, 'home');
  await mkdir(home);
  const repos = await Promise.all(
    ['automatic', 'manual'].map(async (name) => {
      const repo = resolve(temporary, name);
      await mkdir(repo);
      execFileSync('git', ['init', '-q', repo]);
      return repo;
    }),
  );
  const threadId = '33333333-3333-4333-8333-333333333333';
  const db = new DatabaseSync(resolve(home, 'state_5.sqlite'));
  db.exec('CREATE TABLE threads (id TEXT PRIMARY KEY, cwd TEXT)');
  const client = new Client({ name: 'discovery-host', version: '1' });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [resolve('dist/canvas-server.mjs')],
        cwd: temporary,
        env: {
          ...process.env,
          CODEX_HOME: home,
          XDG_CONFIG_HOME: resolve(temporary, 'config'),
          XDG_STATE_HOME: resolve(temporary, 'state'),
        },
      }),
    );
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    await page.exposeFunction('canvasTool', async (params: Parameters<Client['callTool']>[0]) => {
      const connect =
        (params.arguments?.request as { action?: string } | undefined)?.action === 'connect';
      const call = connect ? ++calls : 0;
      if (call === 4) await gate;
      const result = await client.callTool({ ...params, _meta: { ...params._meta, threadId } });
      return call === 2
        ? {
            isError: true,
            content: [{ type: 'text', text: 'Temporary discovery failure' }],
          }
        : result;
    });
    const resource = (
      await client.readResource({
        uri: (await client.listResources()).resources.find(
          (resource) => resource.name === 'Repo Canvas workbench',
        )!.uri,
      })
    ).contents[0];
    if (!('text' in resource)) throw new Error('Missing HTML');
    const html = await hostDocument(resource.text);
    await page.route('**/discovery-host', (route) =>
      route.fulfill({ contentType: 'text/html', body: html }),
    );
    await page.goto('/discovery-host');
    const app = page.frameLocator('iframe');
    await expect(app.getByText(/This chat’s repository isn’t available/)).toBeVisible();
    await expect(app.getByText('No saved repositories yet.', { exact: false })).toBeVisible();
    expect(calls).toBe(1);
    await expect.poll(() => calls, { timeout: 8000 }).toBe(2);
    await expect(app.locator('body')).toContainText('Temporary discovery failure');
    await app.getByRole('button', { name: 'Retry automatic connection' }).click();
    await expect(app.getByText(/still waiting for workspace context/)).toBeVisible();
    expect(calls).toBe(3);
    const frame = page.frames()[1];
    await frame.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await frame.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => calls).toBe(4);
    db.prepare('INSERT INTO threads VALUES (?,?)').run(threadId, repos[0]);
    await app.getByText('Add another repository', { exact: true }).click();
    await app.getByRole('textbox', { name: 'Repository path', exact: true }).fill(repos[1]);
    await app.getByRole('button', { name: 'Open and remember', exact: true }).click();
    release();
    await expect(app.locator('.checkout-path')).toHaveText(repos[1]);
  } finally {
    await client.close();
    db.close();
    await rm(temporary, { recursive: true, force: true });
  }
});

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
          XDG_STATE_HOME: resolve(temporary, 'state'),
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
      await page.exposeFunction('canvasTool', (params: Parameters<Client['callTool']>[0]) =>
        client.callTool({
          ...params,
          _meta: { ...params._meta, ...(threadId ? { threadId } : {}) },
        }),
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
    await expect(picker.getByText(/Hosted access requires a caller chat identity/)).toBeVisible();
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
    await expect(picker.locator('.checkout-path')).not.toBeVisible();
    await second.getByRole('button', { name: 'Inspect src', exact: true }).click();
    await second.getByRole('button', { name: 'Inspect', exact: true }).click();
    await second.getByRole('button', { name: 'Edit', exact: true }).click();
    await second
      .getByRole('textbox', { name: 'Module responsibility' })
      .fill('Unsaved responsibility survives reconnect');
    await second.getByRole('button', { name: 'Apply edits', exact: true }).click();
    await second.getByRole('button', { name: 'App info', exact: true }).click();
    await expect(second.getByText('UI and server builds match.')).toBeVisible();
    await expect(second.getByText(ids[1], { exact: true })).toBeVisible();
    await second.getByRole('button', { name: 'Copy connection details' }).click();
    await expect(second.getByRole('textbox', { name: 'Connection details to copy' })).toHaveValue(
      /App: Repo Canvas[\s\S]*Repository: .*beta/,
    );
    await second.getByRole('button', { name: 'Refresh status' }).click();
    await expect(second.getByRole('button', { name: 'Refresh status' })).toBeEnabled();
    await pages[1].evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        ),
    );
    const originalInfo = await second.locator('.mcp-observability dd').allTextContents();
    await pages[1].screenshot({ path: info.outputPath('connection-info.png') });
    await client.close();
    client = await start();
    await expect
      .poll(
        async () => {
          const result = await client.callTool({
            name: 'canvas_requests',
            arguments: {},
            _meta: { threadId: ids[0] },
          });
          return (
            JSON.parse((result.content as Array<{ text: string }>)[0].text) as {
              canvases: unknown[];
            }
          ).canvases.length;
        },
        { timeout: 15000 },
      )
      .toBe(1);
    await second.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await expect(second.locator('.responsibility')).toHaveText(
      'Unsaved responsibility survives reconnect',
    );
    await expect(second.locator('.checkout-path')).toHaveText(repos[1]);
    await expect(first.locator('.checkout-path')).toHaveText(repos[0]);
    const updatedInfo = await second.locator('.mcp-observability dd').allTextContents();
    expect(updatedInfo).not.toEqual(originalInfo);
    const betaContext = await second
      .locator('.mcp-observability dt')
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
      server: { build: string; instance: string };
      app: { info: { threadId: string } };
    };
    expect(report.server.build).toBeTruthy();
    expect(report.server.instance).toBeTruthy();
    expect(report.app.info.threadId).toBe(ids[1]);
    expect(JSON.stringify(report)).not.toContain('Unsaved responsibility');
    for (const page of pages)
      expect(
        await page.evaluate(() => (window as unknown as { chatRequests: unknown[] }).chatRequests),
      ).toHaveLength(0);
    await second.getByRole('button', { name: 'Close', exact: true }).click();
  } finally {
    await client.close();
    await rm(temporary, { recursive: true, force: true });
  }
});
