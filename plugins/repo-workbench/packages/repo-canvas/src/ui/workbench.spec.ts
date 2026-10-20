import { expect, test } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CanvasExchange } from '../model/bridge';
import { APP_URI } from '../server/app-resource';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument, type Snapshot } from '../model/document';

test('standalone edits and temporary requests share operation semantics with MCP', async ({
  page,
  request,
}) => {
  const client = new Client({ name: 'canvas-http-parity-test', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:4318/mcp')));
  try {
    await page.goto('/');
    await expect(page.getByText('Standalone preview', { exact: true })).toBeVisible();
    await expect(page.getByText('Shared with Codex', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Inspect src', exact: true }).dblclick();
    await page.getByRole('button', { name: 'Inspect core', exact: true }).click();
    await page.getByRole('button', { name: '↗ src/core/rules.ts', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Source preview' })).toContainText(
      'domain owns rules',
    );
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Module responsibility' })
      .fill('Saved through standalone HTTP');
    await page.getByRole('button', { name: 'Save map', exact: true }).click();
    await expect(page.getByText('✓ Shared document')).toBeVisible();
    const cleared = page.waitForResponse(
      (response) => response.url().endsWith('/api/draft') && response.request().method() === 'PUT',
    );
    await page.reload();
    await cleared;
    await expect(page.getByText('✓ Shared document')).toBeVisible();
    await page.goto('about:blank');
    const state = (await (await request.get('/api/state')).json()) as Snapshot & { token: string };
    expect(state.document.modules.find((m) => m.id === 'src/core')!.summary).toBe(
      'Saved through standalone HTTP',
    );
    const hosted = await client.callTool({ name: 'canvas_app', arguments: { action: 'state' } });
    expect(hosted.structuredContent).toMatchObject({
      value: { revision: state.revision, document: state.document, token: 'mcp-app' },
    });
    const headers = { 'X-Repo-Canvas-Token': state.token };
    expect((await request.get('/api/source?path=src/core/rules.ts')).status()).toBe(403);
    const source = await request.get('/api/source?path=src/core/rules.ts&path=../outside', {
      headers,
    });
    expect(source.ok()).toBe(true);
    expect(await source.json()).toMatchObject({
      path: 'src/core/rules.ts',
      content: expect.stringContaining('domain owns rules'),
    });
    const draft = {
      document: state.document,
      revision: state.revision,
      scope: 'repo',
      selection: null,
    };
    expect((await request.put('/api/draft', { headers, data: { draft } })).ok()).toBe(true);
    expect(
      (await client.callTool({ name: 'canvas_app', arguments: { action: 'draft_read' } }))
        .structuredContent,
    ).toEqual({ value: draft });
    await client.callTool({
      name: 'canvas_app',
      arguments: { action: 'draft_write', draft: null },
    });
    expect(await (await request.get('/api/draft', { headers })).json()).toBeNull();
    const sent = await request.post('/api/chat', {
      headers,
      data: {
        canvasId: 'http-parity',
        ...draft,
        messages: [{ role: 'user', text: 'Inspect this draft' }],
      },
    });
    expect(sent.ok()).toBe(true);
    const exchange = (await sent.json()) as CanvasExchange;
    expect(
      (
        await client.callTool({
          name: 'canvas_app',
          arguments: { action: 'chat', canvasId: 'http-parity' },
        })
      ).structuredContent,
    ).toMatchObject({ value: { id: exchange.id, status: 'pending' } });
    expect(
      (
        await request.post('/api/chat/cancel', {
          headers,
          data: { canvasId: 'http-parity', id: exchange.id },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await client.callTool({
          name: 'canvas_app',
          arguments: { action: 'chat', canvasId: 'http-parity' },
        })
      ).structuredContent,
    ).toMatchObject({ value: { id: exchange.id, status: 'cancelled' } });
  } finally {
    await client.close();
  }
});

test('navigate, annotate, connect, persist and reconcile agent proposals and external edits', async ({
  page,
  request,
}) => {
  // Render the delivered resource in an isolated MCP Apps host; all data goes through tools/call.
  const client = new Client({ name: 'canvas-app-host-test', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:4318/mcp')));
  const catalog = (await client.listTools()).tools;
  expect(catalog.find((t) => t.name === 'canvas_open')?._meta?.ui).toMatchObject({
    resourceUri: APP_URI,
  });
  expect(catalog.find((t) => t.name === 'canvas_app')?._meta?.ui).toMatchObject({
    visibility: ['app'],
  });
  const resource = await client.readResource({ uri: APP_URI });
  const content = resource.contents[0];
  if (!('text' in content)) throw new Error('Expected HTML resource');
  const html = content.text;
  expect(html).toContain('repo-canvas-mcp-app');
  expect(html).not.toMatch(/<script[^>]+src=/);
  let rejectMessage = false;
  const messages: { role: string; content: { type: string; text: string }[] }[] = [];
  await page.exposeFunction(
    'canvasTool',
    (params: { name: string; arguments: Record<string, unknown> }) => client.callTool(params),
  );
  await page.exposeFunction('canvasMessage', (message: (typeof messages)[number]) => {
    messages.push(message);
    if (rejectMessage)
      throw new Error('Codex did not accept the message. ' + 'Delivery details. '.repeat(50));
    return {};
  });
  await page.route('**/mcp-host', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><meta charset="UTF-8"><style>body{margin:0}iframe{width:100vw;height:100vh;border:0}</style><iframe title="Repo Canvas" sandbox="allow-scripts allow-forms allow-modals allow-downloads"></iframe><script>
  window.addEventListener('message', async event => {
    const frame = document.querySelector('iframe');
    if (event.source !== frame.contentWindow || event.data?.jsonrpc !== '2.0') return;
    const message = event.data;
    if (message.id === undefined) return;
    try {
      let result = {};
      if (message.method === 'ui/initialize') result = { hostCapabilities: { message: {} } };
      else if (message.method === 'tools/call') result = await window.canvasTool(message.params);
      else if (message.method === 'ui/message') result = await window.canvasMessage(message.params);
      frame.contentWindow.postMessage({jsonrpc:'2.0',id:message.id,result},'*');
    } catch(error) { frame.contentWindow.postMessage({jsonrpc:'2.0',id:message.id,error:{message:error.message}},'*'); }
  });
  document.querySelector('iframe').srcdoc = ${JSON.stringify(html).replace(/</g, '\\u003c')};
  </script>`,
    }),
  );
  const ui = page.frameLocator('iframe');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/mcp-host');
  await expect(ui.getByText('MCP host session', { exact: true })).toBeVisible();
  await expect(ui.locator('.checkout-path')).toHaveText(
    ((await (await request.get('/api/state')).json()) as Snapshot).repo,
  );
  // Undoing a new, selected module must restore a valid scope and chat context.
  await ui.getByText('Map actions', { exact: true }).click();
  await ui.getByRole('button', { name: '+ Module', exact: true }).click();
  await ui.getByRole('textbox', { name: 'Module name', exact: true }).last().fill('Temporary');
  await ui.getByRole('button', { name: 'Create module', exact: true }).click();
  await ui.getByRole('button', { name: 'Enter module' }).click();
  await ui.getByText('Map actions', { exact: true }).click();
  await ui.getByTitle('Undo last draft edit').click();
  await expect(ui.getByRole('button', { name: 'Inspect src', exact: true })).toBeVisible();
  await ui.getByRole('button', { name: 'Side chat' }).click();
  await ui.getByRole('button', { name: 'Inspect src', exact: true }).hover();
  await expect(ui.getByRole('tooltip')).toContainText('Directory grouping');
  await ui.getByRole('button', { name: 'Inspect src', exact: true }).dblclick();
  await expect(ui.getByRole('heading', { name: /^src/, level: 1 })).toBeVisible();
  await ui.getByRole('button', { name: 'Inspect core', exact: true }).click();
  await ui.getByRole('button', { name: 'Inspect', exact: true }).click();
  await ui.getByRole('button', { name: '↗ src/core/rules.ts', exact: true }).click();
  await expect(ui.getByRole('dialog', { name: 'Source preview' })).toContainText(
    'domain owns rules',
  );
  await ui.getByRole('button', { name: 'Close', exact: true }).click();
  await ui
    .getByRole('textbox', { name: 'Annotation', exact: true })
    .fill('Keep rules independent from UI.');
  await ui.getByRole('button', { name: 'Add annotation' }).click();
  const card = ui.getByRole('button', { name: 'Inspect core', exact: true });
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + 80, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 110, { steps: 5 });
  await page.mouse.up();
  await ui.getByText('Map actions', { exact: true }).click();
  await ui.getByRole('button', { name: '+ Module', exact: true }).click();
  await ui.getByRole('textbox', { name: 'Module name', exact: true }).last().fill('Adapters');
  await ui.getByRole('button', { name: 'Create module', exact: true }).click();
  const output = (await ui
    .getByRole('button', { name: 'Connect from Adapters', exact: true })
    .boundingBox())!;
  const input = (await ui
    .getByRole('button', { name: 'Connect to core', exact: true })
    .boundingBox())!;
  await page.mouse.move(output.x + output.width / 2, output.y + output.height / 2);
  await page.mouse.down();
  // Drop near the input, not directly on it: snap must work in screen space under zoom.
  await page.mouse.move(input.x + input.width / 2 - 18, input.y + input.height / 2, { steps: 12 });
  await expect(ui.getByRole('status')).toContainText('Release to connect');
  await page.mouse.up();
  await ui
    .getByRole('dialog', { name: 'Relationship', exact: true })
    .getByLabel('Relationship label')
    .fill('calls');
  await ui
    .getByLabel('Explanation', { exact: true })
    .fill('Adapters call domain rules without owning their state.');
  await ui.getByRole('button', { name: 'Save relationship', exact: true }).click();
  await expect(ui.locator('.connections text')).toHaveText('calls');
  await ui.getByRole('button', { name: 'Explain relationship: calls' }).focus();
  await page.keyboard.press('Enter');
  await expect(ui.getByLabel('Explanation', { exact: true })).toHaveValue(
    'Adapters call domain rules without owning their state.',
  );
  await ui.getByRole('button', { name: 'Close relationship' }).click();
  await expect
    .poll(async () => {
      const result = await client.callTool({
        name: 'canvas_app',
        arguments: { action: 'draft_read' },
      });
      return JSON.stringify(result.structuredContent);
    })
    .toContain('Adapters call domain rules');
  await page.reload();
  await expect(ui.getByRole('status')).toContainText('Restored your unsaved draft');
  await expect(ui.locator('.connections text')).toHaveText('calls');
  await ui.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(ui.getByText('✓ Shared document')).toBeVisible();
  await expect
    .poll(async () => {
      const result = await client.callTool({
        name: 'canvas_app',
        arguments: { action: 'draft_read' },
      });
      return (result.structuredContent as { value: unknown }).value;
    })
    .toBeNull();
  await page.reload();
  await ui.getByRole('button', { name: 'Inspect src', exact: true }).dblclick();
  await expect(ui.getByRole('button', { name: 'Inspect Adapters', exact: true })).toBeVisible();
  await ui.getByRole('button', { name: 'Inspect core', exact: true }).click();
  await ui.getByRole('button', { name: 'Inspect', exact: true }).click();
  await expect(ui.getByText('Keep rules independent from UI.', { exact: true })).toBeVisible();
  // A newly created, unsaved module must not look stale after server normalization.
  await ui.getByText('Map actions', { exact: true }).click();
  await ui.getByRole('button', { name: '+ Module', exact: true }).click();
  await ui.getByRole('textbox', { name: 'Module name', exact: true }).last().fill('Unsaved helper');
  await ui.getByRole('button', { name: 'Create module', exact: true }).click();
  await ui.getByRole('button', { name: 'Inspect core', exact: true }).click();
  await ui.getByRole('button', { name: 'Side chat' }).click();
  await ui.getByRole('textbox', { name: 'Message Codex' }).fill('Annotate this module');
  await ui.getByRole('button', { name: 'Send to chat ↑' }).click();
  await expect(ui.getByText('Waiting for this conversation')).toBeVisible();
  await expect.poll(() => messages.length).toBe(1);
  expect(messages[0].role).toBe('user');
  expect(messages[0].content[0].text).toContain('Annotate this module');
  await expect(ui.getByRole('button', { name: 'Copy handoff' })).toHaveCount(0);
  await expect(ui.getByRole('textbox', { name: 'Message Codex' })).toBeInViewport();
  const answer = async (expectedCount: number) => {
    await expect.poll(() => messages.length).toBe(expectedCount);
    const requestId = messages.at(-1)!.content[0].text.match(/request ([a-f0-9-]+)/)![1];
    const result = await client.callTool({ name: 'canvas_read', arguments: { requestId } });
    const content = result.content as { type: string; text: string }[];
    const exchange = (JSON.parse(content[0].text) as { request: CanvasExchange }).request;
    expect(exchange.context.selection).toBe('src/core');
    const response = await client.callTool({
      name: 'canvas_reply',
      arguments: {
        requestId,
        reply: 'Current chat received the selected core module.',
        proposal: {
          ...exchange.context.document,
          annotations: [
            ...exchange.context.document.annotations,
            {
              id: crypto.randomUUID(),
              target: 'src/core',
              text: 'Keep domain rules independent.',
              author: 'agent',
            },
          ],
        },
      },
    });
    expect(response.isError).not.toBe(true);
  };
  await answer(1);
  await expect(ui.getByText('Current chat received the selected core module.')).toBeVisible();
  await page.screenshot({ path: 'test-results/repo-canvas/mcp-app-reply.png' });
  await ui.getByRole('button', { name: 'Apply to draft' }).click();
  await ui.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(ui.getByText('✓ Shared document')).toBeVisible();
  // A proposal must not overwrite an edit made since its context was captured.
  await ui.getByRole('textbox', { name: 'Message Codex' }).fill('Another proposal');
  await ui.getByRole('button', { name: 'Send to chat ↑' }).click();
  await answer(2);
  await ui.getByRole('button', { name: 'Inspect', exact: true }).click();
  await ui
    .getByRole('textbox', { name: 'Module responsibility' })
    .fill('Changed during discussion');
  await ui.getByRole('button', { name: 'Side chat' }).click();
  await expect(ui.getByRole('button', { name: 'Apply to draft' })).toBeDisabled();
  await ui.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(ui.getByText('✓ Shared document')).toBeVisible();
  const state = (await (await request.get('/api/state')).json()) as Snapshot & { token: string };
  expect(state.document.annotations.some((a) => a.author === 'agent')).toBe(true);
  expect(state.document.connections[0].description).toContain('Adapters call domain rules');
  expect(state.document.modules.find((m) => m.id === 'src/core')!.x).toBeGreaterThan(70);
  const path = join(state.repo, '.repo-canvas/architecture.json');
  const updated = parseDocument(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  updated.modules.find((m) => m.id === 'src/core')!.name = 'Core from agent';
  writeFileSync(path, JSON.stringify(updated));
  await expect(
    ui.getByRole('button', { name: 'Inspect Core from agent', exact: true }),
  ).toBeVisible({ timeout: 7000 });
  await ui.getByRole('button', { name: 'Inspect', exact: true }).click();
  await ui.getByRole('textbox', { name: 'Module responsibility' }).fill('Unsaved local draft');
  updated.title = 'Concurrent agent edit';
  writeFileSync(path, JSON.stringify(updated));
  await expect(
    ui.getByText('The repo document changed while you have draft edits.', { exact: false }),
  ).toBeVisible({ timeout: 7000 });
  await expect(ui.getByRole('button', { name: 'Save map', exact: true })).toBeDisabled();
  const rejected = await request.put('/api/state', {
    headers: { 'X-Repo-Canvas-Token': state.token },
    data: { revision: state.revision, document: state.document },
  });
  expect(rejected.status()).toBe(409);
  const foreign = await request.post('/api/chat', {
    headers: { Origin: 'https://foreign.example' },
    data: {},
  });
  expect(foreign.status()).toBe(403);
  expect(
    (
      await request.post('/mcp', { headers: { Origin: 'https://foreign.example' }, data: {} })
    ).status(),
  ).toBe(403);
  await page.setViewportSize({ width: 740, height: 950 });
  await ui.getByRole('button', { name: 'Inspect', exact: true }).click();
  await expect(ui.locator('.canvas')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/repo-canvas/narrow.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/repo-canvas/workbench.png' });
  rejectMessage = true;
  await ui.getByRole('button', { name: 'Side chat' }).click();
  await ui.getByRole('textbox', { name: 'Message Codex' }).fill('Rejected-message verification');
  // Exercise keyboard submission after resizing; pointer sends are covered above.
  await ui.getByRole('button', { name: 'Send to chat ↑' }).press('Enter');
  await expect(ui.locator('.side-chat').getByRole('alert')).toContainText(
    'Codex did not accept the message',
  );
  await expect(ui.getByRole('button', { name: 'Send to chat ↑' })).toBeDisabled();
  expect(messages.length).toBe(3);
  // A pending request plus a long host error must not clip recovery or compose controls.
  await page.setViewportSize({ width: 390, height: 844 });
  const sideChat = ui.locator('.side-chat');
  await sideChat.hover({ position: { x: 5, y: 5 } });
  await page.mouse.wheel(0, 1500);
  await expect(ui.getByRole('button', { name: 'Dismiss error' })).toBeInViewport();
  await expect(ui.getByRole('button', { name: 'Send to chat ↑' })).toBeInViewport();
  await page.screenshot({ path: 'test-results/repo-canvas/pending-error-mobile.png' });
  await ui.getByRole('button', { name: 'Dismiss error' }).click();
  await ui.getByRole('button', { name: 'Close request' }).click();
  await expect(ui.getByText('Request cancelled.')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Explicitly discarding a cached draft must survive an iframe reload.
  await expect
    .poll(async () => {
      const result = await client.callTool({
        name: 'canvas_app',
        arguments: { action: 'draft_read' },
      });
      return JSON.stringify(result.structuredContent);
    })
    .toContain('Unsaved local draft');
  page.once('dialog', (dialog) => void dialog.accept());
  await ui.getByText('Map actions', { exact: true }).click();
  await ui.getByRole('button', { name: 'Reload', exact: true }).click();
  await expect
    .poll(async () => {
      const result = await client.callTool({
        name: 'canvas_app',
        arguments: { action: 'draft_read' },
      });
      return (result.structuredContent as { value: unknown }).value;
    })
    .toBeNull();
  await page.reload();
  await expect(ui.getByText('✓ Shared document')).toBeVisible();
  await expect(ui.getByText('Restored your unsaved draft in this tab.')).toHaveCount(0);
  // A normal browser must never send or spawn a fallback agent.
  await page.goto('/');
  await page.getByRole('button', { name: 'Side chat' }).click();
  await page.getByRole('textbox', { name: 'Message Codex' }).fill('No standalone sender');
  await expect(page.getByRole('button', { name: 'Send to chat ↑' })).toBeDisabled();
  expect(errors).toEqual([]);
  await client.close();
});

test('compact panels preserve keyboard actions, source editing and visible checkout state', async ({
  page,
}) => {
  await page.goto('/');
  const actions = page.getByText('Map actions', { exact: true });
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeHidden();
  await actions.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(actions).toBeFocused();
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeHidden();
  await actions.click();
  await page.getByRole('button', { name: '+ Module', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Module name', exact: true })
    .last()
    .fill('Disclosure test');
  await page.getByRole('button', { name: 'Create module', exact: true }).click();
  await expect(page.getByText('● Draft changes')).toBeVisible();
  await expect(page.getByLabel('Source paths, one per line')).toBeHidden();
  await page.getByText('Edit source paths', { exact: true }).click();
  await page.getByLabel('Source paths, one per line').fill('src/core/rules.ts');
  await page.getByRole('button', { name: '↗ src/core/rules.ts', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Source preview' })).toContainText(
    'domain owns rules',
  );
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await actions.click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadEvent;
  const path = await download.path();
  const exported = parseDocument(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  expect(exported.modules.some((m) => m.name === 'Disclosure test')).toBe(true);
  await actions.click();
  const chooserEvent = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await (await chooserEvent).setFiles(path);
  await expect(
    page.getByRole('button', { name: 'Inspect Disclosure test', exact: true }),
  ).toBeVisible();
  await actions.click();
  await page.getByTitle('Undo last draft edit').click();
  for (const width of [740, 390]) {
    await page.setViewportSize({ width, height: 950 });
    await expect(page.locator('.checkout-path')).toBeVisible();
    await expect(page.getByText('Standalone preview', { exact: true })).toBeVisible();
    await expect(page.getByText('● Draft changes')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save map', exact: true })).toBeInViewport();
    await page.getByRole('button', { name: 'Close inspector' }).click();
    await page.getByRole('button', { name: 'Side chat', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Message Codex' })).toBeInViewport();
    const chat = (await page.locator('.chat-slot').boundingBox())!;
    const canvas = (await page.locator('.canvas').boundingBox())!;
    expect(chat.y).toBeGreaterThanOrEqual(canvas.y + canvas.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Close side chat' }).click();
    await page.getByRole('button', { name: 'Inspect', exact: true }).click();
  }
  page.once('dialog', (dialog) => void dialog.accept());
  await actions.click();
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await expect(page.getByText('✓ Shared document')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Inspect Disclosure test', exact: true }),
  ).toHaveCount(0);
});

test('short compact windows can scroll to chat controls and back to the map', async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 500 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Side chat', exact: true }).click();
  await page.screenshot({ path: 'test-results/repo-canvas/short-panel.png' });
  // Use user scrolling: programmatic scrollIntoView can mask overflow:hidden clipping.
  await page.locator('.app-header').hover();
  await page.mouse.wheel(0, 1000);
  await expect
    .poll(() => page.locator('.workbench').evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  await page.locator('.side-chat').hover();
  await page.mouse.wheel(0, 1000);
  await expect(page.getByRole('button', { name: 'Send to chat ↑' })).toBeInViewport();
  await page.getByRole('textbox', { name: 'Message Codex' }).fill('Reachable in a short window');
  await page.screenshot({ path: 'test-results/repo-canvas/short-panel-scrolled.png' });
  await page.getByRole('button', { name: 'Close side chat' }).click();
  await expect(page.getByRole('button', { name: 'Save map', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Fit view', exact: true })).toBeInViewport();
});
