import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
import type { CallToolRequest, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { McpUiMessageRequest, McpUiMessageResult } from '@modelcontextprotocol/ext-apps';

declare global {
  interface Window {
    canvasTool: (params: CallToolRequest['params']) => Promise<CallToolResult>;
    canvasMessage?: (params: McpUiMessageRequest['params']) => Promise<McpUiMessageResult>;
    chatRequests: McpUiMessageRequest['params'][];
    dropDiagnostics?: boolean;
    dropMessages?: boolean;
    testHost: AppBridge;
    hostCalls: string[];
    hostSizes: Array<{ width?: number; height?: number }>;
    hostOptions: { messaging: boolean; theme: 'light' | 'dark' };
    resourceHtml: string;
  }
}
const frame = document.querySelector('iframe')!;
window.chatRequests = [];
window.hostSizes = [];
window.hostCalls = [];
const bridge = new AppBridge(
  null,
  { name: 'Workbench SDK host fixture', version: '1' },
  {
    serverTools: {},
    ...(window.hostOptions.messaging ? { message: { text: {} } } : {}),
  },
  {
    hostContext: {
      theme: window.hostOptions.theme,
      displayMode: 'fullscreen',
      availableDisplayModes: ['inline', 'fullscreen'],
      locale: 'en-US',
    },
  },
);
bridge.oncalltool = async (params) => {
  window.hostCalls.push(String((params.arguments?.request as { action?: string })?.action));
  if (
    window.dropDiagnostics &&
    (params.arguments?.request as { action?: string })?.action === 'diagnostics'
  )
    return new Promise(() => {});
  return window.canvasTool(params);
};
if (window.hostOptions.messaging)
  bridge.onmessage = async (params) => {
    window.chatRequests.push(params);
    if (window.dropMessages) return new Promise(() => {});
    return window.canvasMessage ? window.canvasMessage(params) : {};
  };
bridge.onsizechange = (size) => {
  window.hostSizes.push(size);
};
window.testHost = bridge;
void bridge
  .connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!))
  .then(() => {
    frame.srcdoc = window.resourceHtml.replace(
      '<head>',
      `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'">`,
    );
  });
