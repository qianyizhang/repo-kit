import { hostDocument } from '../../../../tests/browser/host-fixture';
import { APP_URI } from '../server/app-resource';
import type { CanvasExchange } from '../model/bridge';
import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Session } from '../model/contracts';
import { parseDocument, type Architecture } from '../model/document';
const node = (id: string, parent: string | null, name: string, x = 0) => ({
  id,
  parent,
  name,
  kind: 'module' as const,
  summary: `Responsibility of ${name}`,
  sources: ['src/core/rules.ts#L1-L1'],
  x,
  y: 100,
});
const model: Architecture = {
  version: 3,
  title: 'Reviewed model',
  modules: [
    node('repo', null, 'Reviewed model'),
    { ...node('owner', 'repo', 'Owner', 30), typeId: 'service', fields: { capacity: 3 } },
    node('leaf', 'repo', 'Leaf', 360),
    node('child', 'owner', 'Child'),
  ],
  connections: [
    {
      id: 'link',
      from: 'owner',
      to: 'leaf',
      label: 'calls',
      description: 'Owner calls Leaf with a bounded request.',
    },
  ],
  annotations: [
    {
      id: 'risk',
      target: { kind: 'node', id: 'owner' },
      severity: 'risk',
      kind: 'note',
      author: 'human',
      text: 'Verify the boundary before expanding.',
    },
  ],
  nodeTypes: [
    {
      id: 'service',
      label: 'Service',
      description: 'An owning service',
      baseKind: 'module',
      fields: [{ id: 'capacity', label: 'Capacity', kind: 'number', surface: 'card' }],
    },
  ],
  groups: [
    {
      id: 'owners',
      scope: 'repo',
      name: 'Owners',
      description: 'Owning responsibilities',
      members: ['owner'],
    },
  ],
};
test('v3 reading, notes, groups, leaf promotion, contextual drafts and explicit type migration', async ({
  page,
  request,
}) => {
  const original = (await (await request.get('/api/state')).json()) as Session;
  const headers = { 'X-Repo-Canvas-Token': original.token };
  await request.put('/api/state', {
    headers,
    data: { revision: original.revision, document: model },
  });
  page.on('dialog', (dialog) => void dialog.accept());
  try {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Inspect Owner', exact: true })).toBeVisible();
    const nav = page.getByRole('navigation');
    await expect(nav.getByRole('button', { name: /Leaf/ })).toHaveCount(0);
    await expect(nav.getByRole('button', { name: /Owner/ })).toBeVisible();
    const card = page.getByRole('button', { name: 'Inspect Owner', exact: true });
    await expect(card).not.toContainText('Responsibility');
    await expect(card).toContainText('Capacity');
    await card.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Responsibility of Owner');
    await card.click();
    await expect(page.locator('.responsibility')).toHaveText('Responsibility of Owner');
    await card.hover();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(page.getByLabel('Module responsibility', { exact: true })).toHaveCount(0);
    await expect(page.locator('.inspector')).not.toContainText('Capacity');
    await page.getByRole('button', { name: '1 risk', exact: true }).click();
    await expect(page.locator('.note-card.risk')).toContainText('Verify the boundary');
    await page.getByRole('button', { name: 'Edit note', exact: true }).click();
    await page.getByLabel('Note severity').selectOption('warning');
    await page.getByLabel('Note text').fill('Recheck the boundary.');
    await page.getByRole('button', { name: 'Apply note', exact: true }).click();
    await expect(page.locator('.note-card.warning')).toContainText('Recheck');
    await page.getByRole('button', { name: 'Remove note', exact: true }).click();
    await expect(page.locator('.note-card')).toHaveCount(0);
    await page.getByRole('button', { name: 'Canvas context menu' }).click();
    await page.getByRole('menuitem', { name: 'Undo', exact: true }).click();
    await expect(page.locator('.note-card.warning')).toBeVisible();
    await page.locator('.edge-label').filter({ hasText: 'calls' }).hover();
    await expect(page.getByRole('tooltip')).toContainText('bounded request');
    const positions = await page.locator('.module-wrap').evaluateAll((elements) =>
      elements.map((e) => ({
        left: (e as HTMLElement).style.left,
        top: (e as HTMLElement).style.top,
      })),
    );
    await page.getByLabel('Focus group').selectOption('owners');
    await expect(
      page.getByRole('button', { name: 'Inspect Leaf', exact: true }).locator('..'),
    ).toHaveCSS('opacity', '0.15');
    await page.getByRole('button', { name: 'Dimmed others' }).click();
    await expect(page.getByRole('button', { name: 'Inspect Leaf', exact: true })).toBeHidden();
    await page.getByLabel('Focus group').selectOption('');
    expect(
      await page.locator('.module-wrap').evaluateAll((elements) =>
        elements.map((e) => ({
          left: (e as HTMLElement).style.left,
          top: (e as HTMLElement).style.top,
        })),
      ),
    ).toEqual(positions);
    await page.getByRole('button', { name: 'Add child to Leaf' }).click();
    await page
      .getByRole('dialog', { name: 'Add module' })
      .getByLabel('Module name')
      .fill('New child');
    await page.getByRole('button', { name: 'Create module' }).click();
    await expect(page.locator('.breadcrumbs')).toContainText('Leaf');
    await expect(nav.getByRole('button', { name: /Leaf/ })).toBeVisible();
    await page
      .locator('.breadcrumbs')
      .getByRole('button', { name: 'Reviewed model', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Inspect Owner', exact: true })
      .click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Comment to agent' }).click();
    await page.getByLabel('Contextual instruction').fill('Keep this ownership boundary explicit.');
    await page.getByRole('button', { name: 'Queue comment' }).click();
    await expect(page.locator('.queued-comment')).toContainText('Owner');
    await expect(page.getByRole('button', { name: 'Send to chat ↑' })).toBeDisabled();
    await expect
      .poll(async () => {
        const d = (await (await request.get('/api/discussion', { headers })).json()) as {
          comments: { instruction: string }[];
        };
        return d.comments.at(-1)?.instruction;
      })
      .toBe('Keep this ownership boundary explicit.');
    await page.getByRole('button', { name: 'Types', exact: true }).click();
    await page.getByRole('button', { name: 'Remove Capacity', exact: true }).click();
    await page.getByRole('button', { name: 'Review type changes' }).click();
    await expect(page.getByRole('dialog', { name: 'Node types' })).toContainText(
      'Owner · Capacity: 3',
    );
    await expect(page.getByRole('button', { name: 'Apply types to draft' })).toBeDisabled();
    await page.getByLabel('Accept these value changes').check();
    await page.getByRole('button', { name: 'Apply types to draft' }).click();
    await page.getByRole('button', { name: 'Save map', exact: true }).click();
    await expect(page.getByText('✓ Shared document')).toBeVisible();
    const saved = (await (await request.get('/api/state')).json()) as Session;
    expect(saved.document.modules.find((m) => m.id === 'owner')?.fields).toEqual({});
    expect(saved.document.modules.find((m) => m.name === 'New child')?.parent).toBe('leaf');
    await page.reload();
    await page.getByRole('button', { name: 'Side chat', exact: true }).click();
    await expect(page.locator('.queued-comment')).toContainText('Owner');
    await page.screenshot({ path: 'test-results/repo-canvas/redesign-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: 'test-results/repo-canvas/redesign-mobile.png' });
  } finally {
    writeFileSync(
      join(original.repo, '.repo-canvas/architecture.json'),
      JSON.stringify(original.document),
    );
  }
});
test('source blocks review before saving and reject an external edit; old maps offer explicit recovery', async ({
  page,
  request,
}) => {
  const original = (await (await request.get('/api/state')).json()) as Session;
  const headers = { 'X-Repo-Canvas-Token': original.token };
  const path = join(original.repo, 'src/core/rules.ts'),
    before = readFileSync(path, 'utf8'),
    mapPath = join(original.repo, '.repo-canvas/architecture.json');
  await request.put('/api/state', {
    headers,
    data: { revision: original.revision, document: model },
  });
  page.on('dialog', (dialog) => void dialog.accept());
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Inspect Owner', exact: true }).click();
    await page.getByRole('button', { name: /^Sources ·/ }).click();
    await page.getByRole('button', { name: 'src/core/rules.ts#L1-L1', exact: true }).click();
    await expect(page.locator('.line-number')).toHaveText('1');
    await expect(page.locator('.source-code .hljs-keyword').first()).toBeVisible();
    await page.getByRole('button', { name: 'Edit source', exact: true }).click();
    await page.getByLabel('Edit source block').fill('export const rule = "reviewed";\n');
    await page.getByRole('button', { name: 'Review diff' }).click();
    expect(readFileSync(path, 'utf8')).toBe(before);
    await expect(page.locator('.source-diff')).toContainText('domain owns rules');
    await expect(page.locator('.source-diff')).toContainText('reviewed');
    writeFileSync(path, '// external change\n');
    await page.getByRole('button', { name: 'Save source file' }).click();
    await expect(page.getByRole('alert')).toContainText('Source changed');
    expect(readFileSync(path, 'utf8')).toBe('// external change\n');
    await page.getByRole('button', { name: 'Reload source' }).click();
    await page.getByRole('button', { name: 'Edit source', exact: true }).click();
    await page.getByLabel('Edit source block').fill('export const rule = "reviewed";\n');
    await page.getByRole('button', { name: 'Review diff' }).click();
    await page.getByRole('button', { name: 'Save source file' }).click();
    await expect(page.getByRole('status')).toContainText('Source file saved');
    expect(readFileSync(path, 'utf8')).toBe('export const rule = "reviewed";\n');
    const legacy = '{"version":2,"authored":"keep me"}';
    writeFileSync(mapPath, legacy);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'This map needs repair' })).toBeVisible();
    await page.getByRole('button', { name: 'Start new draft' }).click();
    expect(readFileSync(mapPath, 'utf8')).toBe(legacy);
    await page.getByRole('button', { name: 'Save map', exact: true }).click();
    await expect(page.getByText('✓ Shared document')).toBeVisible();
    expect(JSON.parse(readFileSync(mapPath, 'utf8')) as { version: number }).toMatchObject({
      version: 3,
    });
  } finally {
    writeFileSync(path, before);
    writeFileSync(
      join(original.repo, '.repo-canvas/architecture.json'),
      JSON.stringify(original.document),
    );
  }
});
test('an open node editor retains its text and refuses to overwrite a concurrent map update', async ({
  page,
  request,
}) => {
  const original = (await (await request.get('/api/state')).json()) as Session;
  const headers = { 'X-Repo-Canvas-Token': original.token };
  await request.put('/api/state', {
    headers,
    data: { revision: original.revision, document: model },
  });
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Inspect Owner', exact: true }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Module responsibility').fill('My local edit');
    const basis = (await (await request.get('/api/state')).json()) as Session;
    const external = {
      ...basis.document,
      modules: basis.document.modules.map((m) =>
        m.id === 'owner' ? { ...m, summary: 'New external responsibility' } : m,
      ),
    };
    await request.put('/api/state', {
      headers,
      data: { revision: basis.revision, document: external },
    });
    await expect(page.getByRole('status')).toContainText('Updated from the shared repo document');
    await page.getByRole('button', { name: 'Apply edits', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('node changed while you were editing');
    await expect(page.getByLabel('Module responsibility')).toHaveValue('My local edit');
    expect(
      ((await (await request.get('/api/state')).json()) as Session).document.modules.find(
        (m) => m.id === 'owner',
      )?.summary,
    ).toBe('New external responsibility');
  } finally {
    writeFileSync(
      join(original.repo, '.repo-canvas/architecture.json'),
      JSON.stringify(original.document),
    );
  }
});
test('each destructive agent proposal requires its own migration approval', async ({
  page,
  request,
}) => {
  const original = (await (await request.get('/api/state')).json()) as Session;
  const headers = { 'X-Repo-Canvas-Token': original.token };
  await request.put('/api/state', {
    headers,
    data: { revision: original.revision, document: model },
  });
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } =
    await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const client = new Client({ name: 'migration-review-test', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:4318/mcp')));
  try {
    await page.goto('/');
    async function propose() {
      const snapshot = await client.callTool({
        name: 'canvas_snapshot',
        arguments: { contextId: 'fixed', includeDocument: true },
      });
      const live = JSON.parse((snapshot.content as { text: string }[])[0].text) as {
        available: boolean;
        revision: string;
        document: Architecture;
      };
      if (!live.available || JSON.stringify(live.document) !== JSON.stringify(parseDocument(model)))
        return false;
      const result = await client.callTool({
        name: 'canvas_propose',
        arguments: {
          contextId: 'fixed',
          expectedRevision: live.revision,
          document: { ...model, nodeTypes: [], title: 'Review migration' },
          explanation: 'Review removing the type.',
        },
      });
      return !result.isError;
    }
    await expect.poll(propose).toBe(true);
    await page.getByText('Review proposed map · 4 concepts', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Apply to draft', exact: true })).toBeDisabled();
    await page.getByLabel('Accept these type migrations').check();
    await expect(page.getByRole('button', { name: 'Apply to draft', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Dismiss proposal', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Agent map proposal' })).toHaveCount(0);
    await expect.poll(propose).toBe(true);
    await page.getByText('Review proposed map · 4 concepts', { exact: true }).click();
    await expect(page.getByLabel('Accept these type migrations')).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Apply to draft', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Dismiss proposal', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Agent map proposal' })).toHaveCount(0);
  } finally {
    await client.close();
    writeFileSync(
      join(original.repo, '.repo-canvas/architecture.json'),
      JSON.stringify(original.document),
    );
  }
});

test('discussion proposals require fresh consent and Apply leaves the saved map unchanged', async ({
  page,
  request,
}) => {
  const original = (await (await request.get('/api/state')).json()) as Session;
  const headers = { 'X-Repo-Canvas-Token': original.token };
  await request.put('/api/state', {
    headers,
    data: { revision: original.revision, document: model },
  });
  await request.put('/api/draft', { headers, data: { draft: null } });
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } =
    await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const client = new Client({ name: 'discussion-review-test', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:4318/mcp')));
  try {
    const resource = (await client.readResource({ uri: APP_URI })).contents[0];
    if (!('text' in resource)) throw new Error('Expected HTML resource');
    const messages: { content: { text: string }[] }[] = [];
    await page.exposeFunction(
      'canvasTool',
      (params: { name: string; arguments: Record<string, unknown> }) => client.callTool(params),
    );
    await page.exposeFunction('canvasMessage', (message: (typeof messages)[number]) => {
      messages.push(message);
      return {};
    });
    const html = await hostDocument(resource.text);
    await page.route('**/proposal-host', (route) =>
      route.fulfill({ contentType: 'text/html', body: html }),
    );
    await page.goto('/proposal-host');
    const ui = page.frameLocator('iframe');
    const review = ui.getByRole('region', { name: 'Discussion map proposal' });
    for (let count = 1; count <= 2; count++) {
      await ui.getByRole('textbox', { name: 'Message Codex' }).fill('Review type removal');
      await ui.getByRole('button', { name: 'Send to chat ↑' }).click();
      await expect.poll(() => messages.length).toBe(count);
      const requestId = messages.at(-1)!.content[0].text.match(/request ([a-f0-9-]+)/)![1];
      const read = await client.callTool({ name: 'canvas_read', arguments: { requestId } });
      const exchange = (
        JSON.parse((read.content as { text: string }[])[0].text) as { request: CanvasExchange }
      ).request;
      const response = await client.callTool({
        name: 'canvas_reply',
        arguments: {
          requestId,
          reply: 'Review removing the type.',
          proposal: { ...exchange.context.document, nodeTypes: [] },
        },
      });
      expect(response.isError).not.toBe(true);
      await expect(
        review.getByRole('button', { name: 'Apply to draft', exact: true }),
      ).toBeDisabled();
      await expect(review.getByLabel('Accept these type migrations')).not.toBeChecked();
      await review.getByLabel('Accept these type migrations').check();
      await expect(
        review.getByRole('button', { name: 'Apply to draft', exact: true }),
      ).toBeEnabled();
      if (count === 1) {
        await review.getByRole('button', { name: 'Dismiss', exact: true }).click();
        await expect(review).toHaveCount(0);
      }
    }
    await review.getByRole('button', { name: 'Apply to draft', exact: true }).click();
    await expect(review).toHaveCount(0);
    expect(
      ((await (await request.get('/api/state')).json()) as Session).document.nodeTypes,
    ).toHaveLength(1);
    await ui.getByRole('button', { name: 'Save map', exact: true }).click();
    await expect(ui.getByText('✓ Shared document')).toBeVisible();
    expect(
      ((await (await request.get('/api/state')).json()) as Session).document.nodeTypes,
    ).toEqual([]);
  } finally {
    await page.goto('about:blank');
    await client.close();
    writeFileSync(
      join(original.repo, '.repo-canvas/architecture.json'),
      JSON.stringify(original.document),
    );
    await request.put('/api/draft', { headers, data: { draft: null } });
  }
});
