/** Standard MCP Apps bridge, shared with the hosting conversation (no agent process). */
import type { Operation } from '../model/operations';
interface ToolResult {
  structuredContent?: { value?: unknown; contextId?: string; repo?: string };
  content?: { type: string; text?: string }[];
  isError?: boolean;
}
interface Initialization {
  hostCapabilities?: { message?: unknown };
}
export const hosted = !!document.querySelector('meta[name="repo-canvas-mcp-app"]');
let sequence = 0;
let contextId: string | undefined;
const pending = new Map<
  number,
  {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
function post(message: object) {
  window.parent.postMessage({ jsonrpc: '2.0', ...message }, '*');
}
class HostTimeoutError extends Error {}
function rpc<T>(method: string, params: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(
        new HostTimeoutError(
          'Codex did not acknowledge the request. Delivery is uncertain; inspect the main chat before sending again.',
        ),
      );
    }, 30000);
    pending.set(id, { resolve: (value) => resolve(value as T), reject, timer });
    post({ id, method, params });
  });
}
if (hosted)
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    const message = event.data as {
      jsonrpc?: string;
      id?: number;
      method?: string;
      result?: unknown;
      params?: { structuredContent?: { contextId?: string } };
      error?: { message: string };
    } | null;
    if (message?.jsonrpc !== '2.0') return;
    if (
      message.method === 'ui/notifications/tool-result' &&
      !contextId &&
      message.params?.structuredContent?.contextId
    ) {
      contextId = message.params.structuredContent.contextId;
      window.dispatchEvent(new Event('repo-canvas-target'));
    }
    const item = message.method || message.id === undefined ? undefined : pending.get(message.id);
    if (item) {
      clearTimeout(item.timer);
      pending.delete(message.id!);
      if (message.error) item.reject(new Error(message.error.message));
      else item.resolve(message.result);
    }
    if (message.method === 'ui/resource-teardown') {
      for (const item of pending.values()) {
        clearTimeout(item.timer);
        item.reject(new Error('Canvas closed'));
      }
      pending.clear();
      post({ id: message.id, result: {} });
    }
  });
let initialization: Promise<Initialization> | undefined;
export function initializeHost() {
  initialization ??= rpc<Initialization>('ui/initialize', {
    appInfo: { name: 'Repo Canvas', version: '0.1.2' },
    appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] },
    protocolVersion: '2026-01-26',
  }).then((result) => {
    post({ method: 'ui/notifications/initialized', params: {} });
    post({ method: 'ui/notifications/size-changed', params: { height: 1000 } });
    return result;
  });
  return initialization;
}
export async function hostTool<T>(action: Operation, args: object = {}): Promise<T> {
  await initializeHost();
  const result = await rpc<ToolResult>('tools/call', {
    name: 'canvas_app',
    arguments: { action, contextId, ...args },
  });
  if (result.isError)
    throw new Error(result.content?.find((c) => c.type === 'text')?.text ?? 'Canvas tool failed');
  if (!result.structuredContent) throw new Error('Canvas tool returned no data');
  return result.structuredContent.value as T;
}
export async function requireMessaging() {
  if (!hosted) throw new Error('Open Repo Canvas from the Codex apps menu to send messages.');
  const host = await initializeHost();
  if (!host.hostCapabilities?.message) throw new Error('This host does not support app messages.');
}
export async function sendToChat(text: string) {
  await requireMessaging();
  const result = await rpc<{ isError?: boolean }>('ui/message', {
    role: 'user',
    content: [{ type: 'text', text }],
  });
  if (result?.isError) throw new Error('Codex did not accept the message.');
}

export async function openRepository(repo: string) {
  await cancelRepositoryRequest();
  await initializeHost();
  const result = await rpc<ToolResult>('tools/call', {
    name: 'canvas_app',
    arguments: { action: 'open', repo },
  });
  if (result.isError)
    throw new Error(
      result.content?.find((c) => c.type === 'text')?.text ?? 'Cannot open repository',
    );
  const value = result.structuredContent?.value as { contextId?: string } | undefined;
  if (!value?.contextId) throw new Error('Missing repository context');
  contextId = value.contextId;
}

async function connectionTool<T>(action: string, args: object = {}): Promise<T> {
  await initializeHost();
  const result = await rpc<ToolResult>('tools/call', {
    name: 'canvas_app',
    arguments: { action, ...args },
  });
  if (result.isError)
    throw new Error(
      result.content?.find((c) => c.type === 'text')?.text ?? 'Cannot connect canvas',
    );
  return result.structuredContent?.value as T;
}
export async function prepareHost(): Promise<boolean> {
  await initializeHost();
  if (!contextId) {
    const target = await connectionTool<{ contextId: string } | null>('bootstrap');
    if (target) contextId = target.contextId;
  }
  return !!contextId;
}
let generation = 0;
let pendingBinding: string | undefined;
export async function cancelRepositoryRequest() {
  generation++;
  const id = pendingBinding;
  pendingBinding = undefined;
  if (id) await connectionTool('binding_cancel', { bindingId: id }).catch(() => {});
}
export async function resolveRepositoryFromChat(
  onDeliveryWarning: (message: string) => void,
): Promise<boolean> {
  await requireMessaging();
  const current = ++generation;
  const { bindingId } = await connectionTool<{ bindingId: string }>('binding_create');
  if (current !== generation) {
    await connectionTool('binding_cancel', { bindingId });
    return false;
  }
  pendingBinding = bindingId;
  try {
    // Message acknowledgment can lag behind delivery. Keep polling the same ticket;
    // never cancel it or resend the message solely because acknowledgment timed out.
    void sendToChat(
      `Repo Canvas is waiting for this chat's repository. Call canvas_bind with bindingId ${bindingId} and the absolute current working directory from this chat's trusted environment, unless I explicitly requested another repository. This connects the existing waiting panel; do not open another canvas. If the repository is ambiguous, ask me here.`,
    ).catch(() => {
      if (current === generation)
        onDeliveryWarning(
          'The chat has not acknowledged the request yet. Still waiting here; check the chat or choose a repository below.',
        );
    });
    while (current === generation) {
      let target: { contextId: string } | null;
      try {
        target = await connectionTool<{ contextId: string } | null>('binding_read', { bindingId });
      } catch (error) {
        if (!(error instanceof HostTimeoutError)) throw error;
        if (current === generation)
          onDeliveryWarning(
            'The host is taking longer to respond. Still waiting for this chat; you can choose a repository below.',
          );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      if (current !== generation) return false;
      if (target) {
        contextId = target.contextId;
        await cancelRepositoryRequest();
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return false;
  } catch (error) {
    if (current !== generation) return false;
    await cancelRepositoryRequest();
    throw error;
  }
}
export async function repositoryChoices<T>(): Promise<T> {
  return connectionTool<T>('catalog');
}

export async function rememberRepository() {
  return connectionTool('remember', { contextId });
}
