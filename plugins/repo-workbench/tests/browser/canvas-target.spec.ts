import { test, expect, type Page } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
test('packaged app accepts an explicit target and menu selection without changing an already open canvas', async ({
  context,
}, info) => {
  test.setTimeout(65_000);
  const temporary = await realpath(await mkdtemp(resolve(tmpdir(), 'canvas-targets-')));
  const repos = await Promise.all(
    ['alpha', 'beta'].map(async (name) => {
      const repo = resolve(temporary, name);
      await mkdir(repo);
      execFileSync('git', ['init', '-q', repo]);
      await writeFile(resolve(repo, 'README.md'), name);
      return repo;
    }),
  );
  const client = new Client({ name: 'target-host', version: '1' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve('dist/canvas-server.mjs')],
      cwd: temporary,
      env: { ...process.env, XDG_CONFIG_HOME: resolve(temporary, 'config') },
    }),
  );
  try {
    const resource = (await client.readResource({ uri: 'ui://repo-canvas/workbench-v2.html' }))
      .contents[0];
    if (!('text' in resource)) throw new Error('Expected app HTML');
    const opened = await client.callTool({ name: 'canvas_open', arguments: { repo: repos[0] } });
    const pages: Page[] = [];
    for (const initial of [opened.structuredContent, null]) {
      const page = await context.newPage();
      pages.push(page);
      await page.exposeFunction(
        'canvasTool',
        (params: { name: string; arguments: Record<string, unknown> }) => client.callTool(params),
      );
      await page.route('**/target-host', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: `<!doctype html><meta charset="utf-8"><style>body{margin:0}iframe{width:100vw;height:100vh;border:0}</style><iframe sandbox="allow-scripts allow-forms allow-modals"></iframe><script>
      window.chatRequests=[];
      const initial=${JSON.stringify(initial).replace(/</g, '\\u003c')};
      window.addEventListener('message',async event=>{
        const frame=document.querySelector('iframe');const m=event.data;
        if(event.source!==frame.contentWindow||m?.jsonrpc!=='2.0'||m.id===undefined)return;
        try {
          if(m.method==='ui/message'){window.chatRequests.push(m.params.content[0].text);return;}
          const result=m.method==='ui/initialize'?{hostCapabilities:{message:{}}}:m.method==='tools/call'?await window.canvasTool(m.params):{};
          frame.contentWindow.postMessage({jsonrpc:'2.0',id:m.id,result},'*');
          if(m.method==='ui/initialize'&&initial)frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:initial}},'*');
        }catch(error){frame.contentWindow.postMessage({jsonrpc:'2.0',id:m.id,error:{message:error.message}},'*');}
      });
      document.querySelector('iframe').srcdoc=${JSON.stringify(resource.text).replace(/</g, '\\u003c')};</script>`,
        }),
      );
      await page.goto('/target-host');
    }
    const first = pages[0].frameLocator('iframe'),
      second = pages[1].frameLocator('iframe');
    await expect(first.locator('.checkout-path')).toHaveText(repos[0]);
    await expect(second.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);
    await expect(second.getByRole('alert')).toHaveCount(0);
    await expect(second.locator('.connection-spinner')).toBeVisible();
    await expect(second.getByRole('button', { name: /alpha/ })).toBeVisible({ timeout: 10000 });
    await pages[1].screenshot({ path: info.outputPath('connecting-panel.png') });
    for (const [width, height] of [
      [740, 950],
      [390, 844],
    ]) {
      await pages[1].setViewportSize({ width, height });
      await expect(
        second.getByText('Connecting to this chat’s repository…', { exact: true }),
      ).toBeVisible();
      await pages[1].screenshot({ path: info.outputPath(`connecting-${width}.png`) });
    }
    await pages[1].setViewportSize({ width: 1440, height: 1000 });
    await second.getByText('Add another repository', { exact: true }).click();
    await second.getByLabel('Repository path').fill(repos[1]);
    await second.getByRole('button', { name: 'Open and remember', exact: true }).click();
    await expect(second.locator('.checkout-path')).toHaveText(repos[1]);
    const registered = await client.callTool({
      name: 'canvas_app',
      arguments: { action: 'catalog' },
    });
    expect(
      (registered.structuredContent as { value: { path: string }[] }).value
        .map((entry) => entry.path)
        .sort(),
    ).toEqual([...repos].sort());
    const messages = await pages[1].evaluate(
      () => (window as unknown as { chatRequests: string[] }).chatRequests,
    );
    expect(messages).toHaveLength(1);
    const bindingId = /bindingId ([0-9a-f-]+)/.exec(messages[0])![1];
    const late = await client.callTool({
      name: 'canvas_bind',
      arguments: { bindingId, repo: repos[0] },
    });
    expect(late.isError).toBe(true);
    await expect(first.locator('.checkout-path')).toHaveText(repos[0]);
    await pages[1].reload();
    await expect
      .poll(() =>
        pages[1].evaluate(
          () => (window as unknown as { chatRequests: string[] }).chatRequests.length,
        ),
      )
      .toBe(1);
    await second.getByLabel('Find a repository').fill('beta');
    await expect(second.getByRole('button', { name: /alpha/ })).toHaveCount(0);
    await expect(second.getByRole('button', { name: /beta/ })).toBeVisible();
    const nextMessage = await pages[1].evaluate(
      () => (window as unknown as { chatRequests: string[] }).chatRequests[0],
    );
    const nextId = /bindingId ([0-9a-f-]+)/.exec(nextMessage)![1];
    await expect(second.getByText(/has not acknowledged/)).toBeVisible({ timeout: 35_000 });
    await expect(second.getByRole('alert')).toHaveCount(0);
    expect(
      await pages[1].evaluate(
        () => (window as unknown as { chatRequests: string[] }).chatRequests.length,
      ),
    ).toBe(1);
    await expect(second.locator('.connection-spinner')).toBeVisible();
    const bound = await client.callTool({
      name: 'canvas_bind',
      arguments: { bindingId: nextId, repo: repos[1] },
    });
    expect(bound.isError).not.toBe(true);
    await expect(second.locator('.checkout-path')).toHaveText(repos[1]);
    await expect(first.locator('.checkout-path')).toHaveText(repos[0]);
    await pages[0].screenshot({ path: info.outputPath('explicit-target.png') });
    await pages[1].screenshot({ path: info.outputPath('menu-target.png') });
  } finally {
    await client.close();
    await rm(temporary, { recursive: true, force: true });
  }
});
