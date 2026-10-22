import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
import { CallToolResultSchema, ReadResourceResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
const token = document.querySelector<HTMLMetaElement>('meta[name=preview-token]')?.content;
if (!token) throw new Error('Missing preview token');
async function post(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-preview-token': token! },
    body: JSON.stringify(body),
  });
  const data: unknown = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}
const hostStatus = document.getElementById('host-status')!;
let bridge: AppBridge | undefined,
  frame: HTMLIFrameElement | undefined,
  dark = false,
  opening = false;
function report(value: unknown) {
  hostStatus.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}
async function open() {
  if (opening) return;
  opening = true;
  try {
    if (bridge) await bridge.close();
    frame?.remove();
    const data = z
      .object({ html: z.string(), result: CallToolResultSchema })
      .parse(await post('/bootstrap', {}));
    frame = document.createElement('iframe');
    frame.title = 'Example MCP App';
    frame.sandbox.add('allow-scripts', 'allow-downloads');
    document.getElementById('mount')!.replaceChildren(frame);
    const child = frame.contentWindow;
    if (!child) throw new Error('Missing iframe window');
    const limited = new URLSearchParams(location.search).has('limited');
    const current = new AppBridge(
      null,
      { name: 'Test host (simulated conversation)', version: '0.2.0' },
      {
        serverTools: {},
        serverResources: {},
        ...(limited ? {} : { message: { text: {} }, updateModelContext: { text: {} } }),
      },
      {
        hostContext: {
          theme: dark ? 'dark' : 'light',
          displayMode: 'inline',
          availableDisplayModes: ['inline', 'fullscreen'],
          locale: 'en',
        },
      },
    );
    bridge = current;
    const view = frame;
    current.addEventListener('sizechange', ({ height }) => {
      if (height !== undefined) view.style.height = `${Math.min(10000, Math.max(300, height))}px`;
    });
    current.oncalltool = async (params) => {
      if (params.name === 'example_trace' && new URLSearchParams(location.search).has('old-build'))
        return {
          content: [],
          structuredContent: { build: 'previous-build', instance: 'old-server', events: [] },
        };
      if (
        params.name === 'example_trace' &&
        new URLSearchParams(location.search).has('trace-error')
      )
        return {
          isError: true,
          content: [{ type: 'text', text: 'Simulated trace unavailability' }],
        };
      return CallToolResultSchema.parse(await post('/rpc', { method: 'tools/call', params }));
    };
    current.onreadresource = async (params) =>
      ReadResourceResultSchema.parse(await post('/rpc', { method: 'resources/read', params }));
    current.onmessage = async (params) => {
      const mode = document.querySelector<HTMLSelectElement>('#message-mode')!.value;
      if (mode === 'reject') {
        report('Simulated host rejected the message.');
        return { isError: true };
      }
      report({
        simulation: 'Message captured locally. No model turn was started.',
        message: params,
      });
      if (mode === 'timeout') await new Promise((resolve) => setTimeout(resolve, 12000));
      return {};
    };
    current.onupdatemodelcontext = (params) => {
      report({ simulation: 'Context stored in test host only.', context: params });
      return Promise.resolve({});
    };
    current.onrequestdisplaymode = ({ mode }) => {
      current.setHostContext({
        theme: dark ? 'dark' : 'light',
        displayMode: mode,
        availableDisplayModes: ['inline', 'fullscreen'],
      });
      report(`Display mode acknowledged: ${mode} (test host)`);
      return Promise.resolve({ mode });
    };
    current.onrequestteardown = () => {
      void current
        .teardownResource({}, { timeout: 3000 })
        .then(() => report('Test host cleanup acknowledged.'))
        .catch((error) => report(String(error)));
    };
    current.oninitialized = () => {
      void (async () => {
        await current.sendToolInputPartial({ arguments: {} });
        await current.sendToolInput({ arguments: {} });
        await current.sendToolResult(data.result);
        report(
          'App connected. Tool/resource requests reach the real server. Chat messages stay in this test host.',
        );
      })().catch((error) => report(String(error)));
    };
    await current.connect(new PostMessageTransport(child, child));
    const csp =
      "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'\">";
    frame.srcdoc = data.html.replace('<head>', `<head>${csp}`);
  } catch (error) {
    report(String(error));
  } finally {
    opening = false;
  }
}
document.getElementById('theme')!.onclick = () => {
  dark = !dark;
  bridge?.setHostContext({
    theme: dark ? 'dark' : 'light',
    availableDisplayModes: ['inline', 'fullscreen'],
  });
};
document.getElementById('teardown')!.onclick = () => {
  void (async () => {
    if (!bridge) return;
    await bridge.teardownResource({}, { timeout: 3000 });
    report(
      'Teardown acknowledged. Frame retained for trace inspection; Reopen creates a new app lifetime.',
    );
  })().catch((error) => report(String(error)));
};
document.getElementById('reopen')!.onclick = () => {
  void open();
};
void open();
