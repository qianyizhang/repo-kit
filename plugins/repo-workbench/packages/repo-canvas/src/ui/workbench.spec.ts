import { hostDocument } from '../../../../tests/browser/host-fixture';
import { expect, test } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CanvasExchange } from '../model/bridge';
import { APP_URI } from '../server/app-resource';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
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
    await page.getByRole('button', { name: /^Sources ·/ }).click();
    await page.getByRole('button', { name: 'src/core/rules.ts', exact: true }).click();
    await expect(page.locator('.source-block')).toContainText('domain owns rules');

    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Module responsibility' })
      .fill('Saved through standalone HTTP');
    await page.getByRole('button', { name: 'Apply edits', exact: true }).click();
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
    const hosted = await client.callTool({
      name: 'canvas_app',
      arguments: { request: { action: 'state', args: {} } },
    });
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
      (
        await client.callTool({
          name: 'canvas_app',
          arguments: { request: { action: 'draft_read', args: {} } },
        })
      ).structuredContent,
    ).toEqual({ value: draft });
    await client.callTool({
      name: 'canvas_app',
      arguments: { request: { action: 'draft_write', args: { draft: null } } },
    });
    expect(await (await request.get('/api/draft', { headers })).json()).toBeNull();
    const sent = await request.post('/api/chat', {
      headers,
      data: {
        canvasId: 'http-parity',
        document: draft.document,
        scope: draft.scope,
        selection: draft.selection,
        messages: [{ role: 'user', text: 'Inspect this draft' }],
      },
    });
    expect(sent.ok(), await sent.text()).toBe(true);
    const exchange = (await sent.json()) as CanvasExchange;
    expect(
      (
        await client.callTool({
          name: 'canvas_app',
          arguments: { request: { action: 'chat', args: { canvasId: 'http-parity' } } },
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
          arguments: { request: { action: 'chat', args: { canvasId: 'http-parity' } } },
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
  const initial = (await (await request.get('/api/state')).json()) as Snapshot;
  // A genuinely unmodeled disposable repository: no implicit chat scan before the click.
  unlinkSync(join(initial.repo, '.repo-canvas/architecture.json'));
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
  const hostHtml = await hostDocument(html);
  await page.route('**/mcp-host', (route) =>
    route.fulfill({ contentType: 'text/html', body: hostHtml }),
  );
  const ui = page.frameLocator('iframe');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/mcp-host');
  await expect(ui.getByText('MCP host session', { exact: true })).toBeVisible();
  await expect(ui.locator('.checkout-path')).toHaveText(
    ((await (await request.get('/api/state')).json()) as Snapshot).repo,
  );
  await expect(
    ui.getByRole('button', { name: 'Initialize architecture', exact: true }),
  ).toBeVisible();
  expect(messages).toHaveLength(0);
  await page.screenshot({ path: 'test-results/repo-canvas/initialize-before.png' });
  await ui.getByRole('button', { name: 'Initialize architecture', exact: true }).click();
  await expect.poll(() => messages.length).toBe(1);
  const initializationId = messages[0].content[0].text.match(/"requestId":"([a-f0-9-]+)"/)![1];
  const initializationResult = await client.callTool({
    name: 'canvas_map',
    arguments: { requestId: initializationId },
  });
  const initialization = JSON.parse(
    (initializationResult.content as { text: string }[])[0].text,
  ) as {
    document: CanvasExchange['context']['document'];
  };
  expect(messages[0].content[0].text).toContain('recent commits');
  expect(messages[0].content[0].text).toContain('previous sessions');
  expect(((await (await request.get('/api/state')).json()) as Snapshot).saved).toBe(false);
  await client.callTool({
    name: 'canvas_reply',
    arguments: {
      requestId: initializationId,
      reply: 'A concise architecture candidate is ready for review.',
      proposal: initialization.document,
    },
  });
  await expect(ui.getByRole('button', { name: 'Apply to draft', exact: true })).toBeEnabled();
  await ui.getByRole('button', { name: 'Apply to draft', exact: true }).click();
  await ui.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(
    ui.getByRole('button', { name: 'Initialize architecture', exact: true }),
  ).toHaveCount(0);
  messages.length = 0;
  // Undoing a new, selected module must restore a valid scope and chat context.
  await ui.getByRole('button', { name: 'Canvas context menu', exact: true }).click();
  await ui.getByRole('menuitem', { name: 'Add node here', exact: true }).click();
  await ui.getByRole('textbox', { name: 'Module name', exact: true }).last().fill('Temporary');
  await ui.getByRole('button', { name: 'Create module', exact: true }).click();
  await ui.getByRole('button', { name: 'Inspect Temporary', exact: true }).dblclick();
  await ui.getByRole('button', { name: 'Canvas context menu', exact: true }).click();
  await ui.getByRole('menuitem', { name: 'Undo', exact: true }).click();
  await expect(ui.getByRole('button', { name: 'Inspect src', exact: true })).toBeVisible();
  await ui.getByRole('button', { name: 'Side chat' }).click();
  await ui.getByRole('button', { name: 'Inspect src', exact: true }).hover();
  await expect(ui.getByRole('tooltip')).toContainText('Directory grouping');
  await ui.getByRole('button', { name: 'Inspect src', exact: true }).dblclick();
  await expect(
    ui.locator('.breadcrumbs').getByRole('button', { name: 'src', exact: true }),
  ).toBeVisible();
  await ui.getByRole('button', { name: 'Inspect core', exact: true }).click();
  await ui.getByRole('button', { name: 'Inspect', exact: true }).click();
  await ui.getByRole('button', { name: /^Sources ·/ }).click();
  await ui.getByRole('button', { name: 'src/core/rules.ts', exact: true }).click();
  await expect(ui.locator('.source-block')).toContainText('domain owns rules');

  await ui.getByRole('button', { name: /^Notes ·/ }).click();
  await ui.getByRole('button', { name: 'Add note', exact: true }).click();
  await ui
    .getByRole('textbox', { name: 'Note text', exact: true })
    .fill('Keep rules independent from UI.');
  await ui.getByRole('button', { name: 'Apply note' }).click();
  const card = ui.getByRole('button', { name: 'Inspect core', exact: true });
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + 80, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 110, { steps: 5 });
  await page.mouse.up();
  await ui.getByRole('button', { name: 'Canvas context menu', exact: true }).click();
  await ui.getByRole('menuitem', { name: 'Add node here', exact: true }).click();
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
  await ui.getByLabel('Relationship sources').fill('../outside.ts');
  await ui.getByRole('button', { name: 'Save relationship', exact: true }).click();
  await expect(ui.getByRole('dialog', { name: 'Relationship', exact: true })).toBeVisible();
  await expect(ui.getByRole('alert')).toContainText('relative');
  await ui.getByLabel('Relationship sources').fill('src/core/rules.ts');
  await ui.getByRole('button', { name: 'Save relationship', exact: true }).click();
  await expect(
    ui.getByRole('button', { name: 'Explain relationship: calls', exact: true }),
  ).toBeVisible();
  await ui.getByRole('button', { name: 'Explain relationship: calls' }).focus();
  await page.keyboard.press('Enter');
  await expect(ui.getByRole('dialog', { name: 'Relationship', exact: true })).toContainText(
    'Adapters call domain rules without owning their state.',
  );
  await ui.getByRole('button', { name: 'Close relationship' }).click();
  await expect
    .poll(async () => {
      const result = await client.callTool({
        name: 'canvas_app',
        arguments: { request: { action: 'draft_read', args: {} } },
      });
      return JSON.stringify(result.structuredContent);
    })
    .toContain('Adapters call domain rules');
  await page.reload();
  await expect(ui.getByRole('status')).toContainText('Restored your unsaved draft');
  await expect(
    ui.getByRole('button', { name: 'Explain relationship: calls', exact: true }),
  ).toBeVisible();
  await ui.getByRole('button', { name: 'Save map', exact: true }).click();
  await expect(ui.getByText('✓ Shared document')).toBeVisible();
  await expect
    .poll(async () => {
      const result = await client.callTool({
        name: 'canvas_app',
        arguments: { request: { action: 'draft_read', args: {} } },
      });
      return (result.structuredContent as { value: unknown }).value;
    })
    .toBeNull();
  await page.reload();
  await ui.getByRole('button', { name: 'Inspect src', exact: true }).dblclick();
  await expect(ui.getByRole('button', { name: 'Inspect Adapters', exact: true })).toBeVisible();
  await ui.getByRole('button', { name: 'Inspect core', exact: true }).click();
  await ui.getByRole('button', { name: 'Inspect', exact: true }).click();
  await ui.getByRole('button', { name: /^Notes ·/ }).click();
  await expect(ui.getByText('Keep rules independent from UI.', { exact: true })).toBeVisible();
  // A newly created, unsaved module must not look stale after server normalization.
  await ui.getByRole('button', { name: 'Canvas context menu', exact: true }).click();
  await ui.getByRole('menuitem', { name: 'Add node here', exact: true }).click();
  await ui.getByRole('textbox', { name: 'Module name', exact: true }).last().fill('Unsaved helper');
  await ui.getByRole('button', { name: 'Create module', exact: true }).click();
  await ui.getByRole('button', { name: 'Inspect core', exact: true }).click();
  await ui.getByRole('button', { name: 'Side chat' }).click();
  await ui.getByRole('textbox', { name: 'Message Codex' }).fill('hi');
  await ui.getByRole('button', { name: 'Send to chat ↑' }).click();
  await expect.poll(() => messages.length).toBe(1);
  expect(messages.pop()!.content[0].text).toBe('hi');
  await ui.getByLabel('Attach selection and notes').check();
  await ui.getByRole('textbox', { name: 'Message Codex' }).fill('Annotate this module');
  await ui.getByRole('button', { name: 'Send to chat ↑' }).click();
  await expect(ui.getByText('Awaiting the main chat')).toBeVisible();
  await expect.poll(() => messages.length).toBe(1);
  expect(messages[0].role).toBe('user');
  expect(messages[0].content[0].text).toContain('Annotate this module');
  await expect(ui.getByRole('button', { name: 'Copy handoff' })).toHaveCount(0);
  await expect(ui.getByRole('textbox', { name: 'Message Codex' })).toBeInViewport();
  const answer = async (expectedCount: number) => {
    await expect.poll(() => messages.length).toBe(expectedCount);
    const requestId = messages.at(-1)!.content[0].text.match(/"requestId":"([a-f0-9-]+)"/)![1];
    const result = await client.callTool({ name: 'canvas_map', arguments: { requestId } });
    const content = result.content as { type: string; text: string }[];
    const exchange = JSON.parse(content[0].text) as {
      document: CanvasExchange['context']['document'];
    };
    expect(messages.at(-1)!.content[0].text).toContain('src/core');
    const response = await client.callTool({
      name: 'canvas_reply',
      arguments: {
        requestId,
        reply: 'Current chat received the selected core module.',
        proposal: {
          ...exchange.document,
          annotations: [
            ...exchange.document.annotations,
            {
              id: crypto.randomUUID(),
              target: { kind: 'node', id: 'src/core' },
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
  await ui.getByLabel('Attach selection and notes').check();
  await ui.getByRole('button', { name: 'Send to chat ↑' }).click();
  await answer(2);
  await ui.getByRole('button', { name: 'Inspect', exact: true }).click();
  await ui.getByRole('button', { name: 'Edit', exact: true }).click();
  await ui
    .getByRole('textbox', { name: 'Module responsibility' })
    .fill('Changed during discussion');
  await ui.getByRole('button', { name: 'Apply edits', exact: true }).click();
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
  await ui.getByRole('button', { name: 'Edit', exact: true }).click();
  await ui.getByRole('textbox', { name: 'Module responsibility' }).fill('Unsaved local draft');
  await ui.getByRole('button', { name: 'Apply edits', exact: true }).click();
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
  await ui.getByLabel('Attach selection and notes').check();
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
  await expect(ui.getByRole('button', { name: 'Retry local save' })).toBeVisible();
  await expect(ui.getByRole('button', { name: 'Send to chat ↑' })).toBeInViewport();
  await page.screenshot({ path: 'test-results/repo-canvas/pending-error-mobile.png' });

  await ui.getByRole('button', { name: 'Close request' }).click();
  await expect(ui.getByText('Request closed locally.')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Explicitly discarding a cached draft must survive an iframe reload.
  await expect
    .poll(async () => {
      const result = await client.callTool({
        name: 'canvas_app',
        arguments: { request: { action: 'draft_read', args: {} } },
      });
      return JSON.stringify(result.structuredContent);
    })
    .toContain('Unsaved local draft');
  page.once('dialog', (dialog) => void dialog.accept());
  await ui.getByRole('button', { name: 'Canvas context menu', exact: true }).click();
  await ui.getByRole('menuitem', { name: 'Reload', exact: true }).click();
  await expect
    .poll(async () => {
      const result = await client.callTool({
        name: 'canvas_app',
        arguments: { request: { action: 'draft_read', args: {} } },
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
  const actions = page.getByRole('button', { name: 'Canvas context menu', exact: true });
  await expect(page.getByRole('menuitem', { name: 'Export', exact: true })).toBeHidden();
  await actions.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Export', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu', { name: 'Canvas actions' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Export', exact: true })).toBeHidden();
  await actions.click();
  await page.getByRole('menuitem', { name: 'Add node here', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Module name', exact: true })
    .last()
    .fill('Disclosure test');
  await page.getByRole('button', { name: 'Create module', exact: true }).click();
  await expect(page.getByText('● Draft changes')).toBeVisible();
  await expect(page.getByLabel('Source references', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Source references', { exact: true }).fill('src/core/rules.ts');
  await page.getByRole('button', { name: 'Apply edits', exact: true }).click();
  await page.getByRole('button', { name: /^Sources ·/ }).click();
  await page.getByRole('button', { name: 'src/core/rules.ts', exact: true }).click();
  await expect(page.locator('.source-block')).toContainText('domain owns rules');

  await actions.click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export', exact: true }).click();
  const download = await downloadEvent;
  const path = await download.path();
  const exported = parseDocument(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  expect(exported.modules.some((m) => m.name === 'Disclosure test')).toBe(true);
  await actions.click();
  const chooserEvent = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Import', exact: true }).click();
  await (await chooserEvent).setFiles(path);
  await expect(
    page.getByRole('button', { name: 'Inspect Disclosure test', exact: true }),
  ).toBeVisible();
  await actions.click();
  await page.getByRole('menuitem', { name: 'Undo', exact: true }).click();
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
  await page.getByRole('menuitem', { name: 'Reload', exact: true }).click();
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

test('narrow canvas supports readable arrangement, multi-selection and revision-checked agent views', async ({
  page,
  request,
}) => {
  const original = (await (await request.get('/api/state')).json()) as Snapshot & { token: string };
  const headers = { 'X-Repo-Canvas-Token': original.token };
  const document = parseDocument({
    version: 3,
    title: 'Viewport study',
    modules: [
      {
        id: 'repo',
        parent: null,
        name: 'Viewport study',
        kind: 'system',
        summary: 'Architecture overview',
        sources: [],
        x: 0,
        y: 0,
      },
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `node-${i}`,
        parent: 'repo',
        name: `Owner ${i}`,
        kind: 'module',
        summary: 'A readable responsibility with source evidence',
        sources: ['src/core/rules.ts'],
        x: (i % 3) * 320,
        y: Math.floor(i / 3) * 230,
      })),
    ],
    connections: [
      { id: 'edge-one', from: 'node-0', to: 'node-1', label: 'dispatches workflow' },
      {
        id: 'edge-two',
        from: 'node-0',
        to: 'node-4',
        label: '保存用于研究和架构讨论的完整证据来源以及关联关系',
      },
      { id: 'edge-three', from: 'node-2', to: 'node-3', label: 'projects current state' },
    ],
    annotations: [],
  });
  await request.put('/api/state', { headers, data: { document, revision: original.revision } });
  const client = new Client({ name: 'agent-ui-test', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:4318/mcp')));
  async function snapshot() {
    const result = await client.callTool({
      name: 'canvas_snapshot',
      arguments: { contextId: 'fixed', includeDocument: true },
    });
    expect(result.isError).not.toBe(true);
    return JSON.parse((result.content as { text: string }[])[0].text) as {
      available: boolean;
      revision: string;
      document: Snapshot['document'];
      selections: string[];
      navigation: boolean;
      viewport: { zoom: number; height: number };
      command?: { id: string; status: string };
    };
  }
  try {
    await page.setViewportSize({ width: 876, height: 1000 });
    await page.goto('/');
    await expect(page.getByRole('navigation')).toBeHidden();
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await expect(page.getByRole('navigation')).toBeVisible();
    await page.getByRole('button', { name: 'Hide navigation' }).click();
    await page.getByRole('button', { name: 'Inspect Owner 3', exact: true }).dblclick();
    await expect(
      page.locator('.breadcrumbs').getByRole('button', { name: 'Owner 3', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Viewport study', exact: true }).click();
    await page.getByRole('button', { name: 'Side chat', exact: true }).click();
    await page.getByRole('button', { name: 'Arrange', exact: true }).click();
    await expect
      .poll(async () =>
        Number(
          (await page.getByRole('button', { name: 'Read at 100 percent' }).innerText()).replace(
            '%',
            '',
          ),
        ),
      )
      .toBeGreaterThanOrEqual(80);
    const canvas = (await page.locator('.canvas').boundingBox())!;
    for (const card of await page.locator('.module-card').all()) {
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(canvas.x);
      expect(box.x + box.width).toBeLessThanOrEqual(canvas.x + canvas.width);
      expect(box.y + box.height).toBeLessThanOrEqual(canvas.y + canvas.height - 55);
    }
    const labelBoxes = await page.locator('.connection-label rect').evaluateAll((elements) =>
      elements.map((e) => {
        const b = e.getBoundingClientRect();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      }),
    );
    const cardBoxes = await page.locator('.module-card').evaluateAll((elements) =>
      elements.map((e) => {
        const b = e.getBoundingClientRect();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      }),
    );
    expect(labelBoxes.length).toBeGreaterThan(0);
    const overlap = (a: (typeof labelBoxes)[number], b: (typeof labelBoxes)[number]) =>
      a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    for (const [i, label] of labelBoxes.entries()) {
      expect(cardBoxes.some((card) => overlap(label, card))).toBe(false);
      expect(labelBoxes.slice(i + 1).some((other) => overlap(label, other))).toBe(false);
    }
    for (const label of await page.locator('.connection-label').all()) {
      const bounds = (await label.locator('rect').boundingBox())!;
      const text = (await label.locator('.edge-label').boundingBox())!;
      expect(text.x).toBeGreaterThanOrEqual(bounds.x);
      expect(text.x + text.width).toBeLessThanOrEqual(bounds.x + bounds.width);
    }
    await page.getByRole('button', { name: 'Select several', exact: true }).click();
    await page.getByRole('button', { name: 'Inspect Owner 0', exact: true }).click();
    await page.getByRole('button', { name: 'Inspect Owner 1', exact: true }).click();
    await expect(page.locator('.context-chip')).toContainText('2 selected nodes');
    await expect.poll(async () => (await snapshot()).selections).toEqual(['node-0', 'node-1']);
    const live = await snapshot();
    expect(
      (
        await client.callTool({
          name: 'canvas_command',
          arguments: { contextId: 'fixed', expectedRevision: 'stale', command: { action: 'fit' } },
        })
      ).isError,
    ).toBe(true);
    let acknowledgments = 0;
    await page.route('**/api/command/ack', async (route) => {
      acknowledgments++;
      if (acknowledgments === 1) await route.abort('failed');
      else await route.continue();
    });
    const result = await client.callTool({
      name: 'canvas_command',
      arguments: {
        contextId: 'fixed',
        expectedRevision: live.revision,
        command: { action: 'panel', panel: null },
      },
    });
    expect(result.isError).not.toBe(true);
    await expect(page.locator('.side-chat')).toBeHidden();
    await expect.poll(async () => (await snapshot()).command?.status).toBe('applied');
    expect(acknowledgments).toBe(2);
    await expect(page.getByText('Agent state sync unavailable:', { exact: false })).toHaveCount(0);
    await expect
      .poll(async () => (await snapshot()).viewport.height)
      .toBe(await page.locator('.canvas').evaluate((element) => element.clientHeight));
    // A command belongs to its scope; remounting the canvas must not replay it.
    const selected = await snapshot();
    expect(
      (
        await client.callTool({
          name: 'canvas_command',
          arguments: {
            contextId: 'fixed',
            expectedRevision: selected.revision,
            command: { action: 'fit_selection' },
          },
        })
      ).isError,
    ).not.toBe(true);
    await expect.poll(async () => (await snapshot()).command?.status).toBe('applied');
    await page.getByRole('button', { name: 'Inspect Owner 3', exact: true }).dblclick();
    await page.getByRole('button', { name: 'Viewport study', exact: true }).click();
    const automaticallyFitted = await page.locator('.canvas-world').getAttribute('style');
    await page.getByRole('button', { name: 'Fit view', exact: true }).click();
    await expect(page.locator('.canvas-world')).toHaveAttribute('style', automaticallyFitted!);
    const basis = await snapshot();
    const proposal = { ...basis.document, title: 'Agent reviewed map' };
    expect(
      (
        await client.callTool({
          name: 'canvas_propose',
          arguments: {
            contextId: 'fixed',
            expectedRevision: basis.revision,
            document: proposal,
            explanation: 'Keep sources and arrangement; improve the title.',
          },
        })
      ).isError,
    ).not.toBe(true);
    await expect(page.getByRole('region', { name: 'Agent map proposal' })).toBeVisible();
    expect(((await (await request.get('/api/state')).json()) as Snapshot).document.title).toBe(
      'Viewport study',
    );
    await page.getByText('Review proposed map · 7 concepts', { exact: true }).click();
    await page.getByRole('button', { name: 'Apply to draft', exact: true }).click();
    await expect(page.getByText('● Draft changes', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save map', exact: true }).click();
    await expect(page.getByText('✓ Shared document', { exact: true })).toBeVisible();
    expect(((await (await request.get('/api/state')).json()) as Snapshot).document.title).toBe(
      'Agent reviewed map',
    );
    await page.screenshot({ path: 'test-results/canvas-narrow-after.png' });
  } finally {
    await client.close();
    await page.goto('about:blank');
    const latest = (await (await request.get('/api/state')).json()) as Snapshot;
    await request.put('/api/state', {
      headers,
      data: { document: original.document, revision: latest.revision },
    });
  }
});
