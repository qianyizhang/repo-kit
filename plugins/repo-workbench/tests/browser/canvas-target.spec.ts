import { test, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
test('packaged app accepts an explicit target and menu selection without changing an already open canvas', async ({
  context,
}, info) => {
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
    }),
  );
  try {
    const resource = (await client.readResource({ uri: 'ui://repo-canvas/workbench-v2.html' }))
      .contents[0];
    if (!('text' in resource)) throw new Error('Expected app HTML');
    const opened = await client.callTool({ name: 'canvas_open', arguments: { repo: repos[0] } });
    const pages = [];
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
          body: `<!doctype html><style>body{margin:0}iframe{width:100vw;height:100vh;border:0}</style><iframe sandbox="allow-scripts allow-forms allow-modals"></iframe><script>
      const initial=${JSON.stringify(initial).replace(/</g, '\\u003c')};
      window.addEventListener('message',async event=>{
        const frame=document.querySelector('iframe');const m=event.data;
        if(event.source!==frame.contentWindow||m?.jsonrpc!=='2.0'||m.id===undefined)return;
        try {
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
    await second.getByLabel('Repository path').fill(repos[1]);
    await second.getByRole('button', { name: 'Open repository', exact: true }).click();
    await expect(second.locator('.checkout-path')).toHaveText(repos[1]);
    await expect(first.locator('.checkout-path')).toHaveText(repos[0]);
    await pages[0].screenshot({ path: info.outputPath('explicit-target.png') });
    await pages[1].screenshot({ path: info.outputPath('menu-target.png') });
  } finally {
    await client.close();
    await rm(temporary, { recursive: true, force: true });
  }
});
