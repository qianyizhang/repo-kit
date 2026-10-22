import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
import type { CallToolResult, CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
declare global {
  interface Window {
    reportCall(params: CallToolRequest['params']): Promise<CallToolResult>;
    boot: { html: string; result: CallToolResult; limited?: boolean };
  }
}
const frame = document.createElement('iframe');
frame.title = 'Reports';
frame.sandbox.add('allow-scripts', 'allow-downloads');
frame.style.cssText = 'width:100%;height:calc(100vh - 70px);border:0';
document.body.append(frame);
const child = frame.contentWindow!;
const bridge = new AppBridge(
  null,
  { name: 'Report test host', version: '1' },
  { serverTools: {}, openLinks: {}, ...(window.boot.limited ? {} : { message: { text: {} } }) },
  { hostContext: { theme: 'light', displayMode: 'inline', availableDisplayModes: ['inline'] } },
);
bridge.oncalltool = (params) => window.reportCall(params);
bridge.onmessage = (params) => {
  document.getElementById('sent')!.textContent = JSON.stringify(params);
  return Promise.resolve(
    document.querySelector<HTMLSelectElement>('#delivery')!.value === 'reject'
      ? { isError: true }
      : {},
  );
};
bridge.onopenlink = () => Promise.resolve({});
bridge.oninitialized = () => {
  void bridge.sendToolResult(window.boot.result);
};
let dark = false;
document.getElementById('theme')!.onclick = () => {
  dark = !dark;
  bridge.setHostContext({ theme: dark ? 'dark' : 'light' });
};
document.getElementById('close')!.onclick = () => {
  void bridge.teardownResource({});
};
void bridge.connect(new PostMessageTransport(child, child)).then(() => {
  frame.srcdoc = window.boot.html.replace(
    '<head>',
    `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'">`,
  );
});
