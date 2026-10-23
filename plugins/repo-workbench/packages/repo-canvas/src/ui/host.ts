/** Repository connection and recovery, independent of MCP Apps wire details. */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Operation } from '../model/operations';
import {
  contracts,
  parseOutput,
  targetSchema,
  type Action,
  type Input,
  type Output,
  type ConnectionState,
  type ServerInfo,
  type Draft,
} from '../model/contracts';
import type { CanvasView } from '../model/session';
import { BUILD, VERSION } from '../model/build';
import { RuntimeError } from '../../../../../mcp-app-runtime/src/definition.ts';
import { HostClient } from './host-client';
export type { ServerInfo } from '../model/contracts';
export const hosted = !!document.querySelector('meta[name="repo-canvas-mcp-app"]');
let contextId: string | undefined;
let repository: string | undefined;
const panelId = crypto.randomUUID();
let bindingGeneration = 0;
let latestDraft: Draft | null | undefined;
let latestView: CanvasView | undefined;
let connectionState: ConnectionState | undefined;
let connecting: Promise<boolean> | undefined;
const client = new HostClient(
  (value) => {
    const target = targetSchema.safeParse(value);
    if (!contextId && target.success) {
      contextId = target.data.contextId;
      repository = target.data.repo;
      window.dispatchEvent(new Event('repo-canvas-target'));
    }
  },
  () => connectionStatus(),
);
export const interactionDiagnostics = client.inspection;
export function inspectLastMessage() {
  client.inspection.show('Interactions', client.lastMessageInteraction);
}
export function hasMessageObservation() {
  return !!client.lastMessageInteraction;
}
export function connectionStatus() {
  return {
    uiVersion: VERSION,
    uiBuild: BUILD,
    panelId,
    repository,
    contextId,
    server: connectionState?.server,
    threadId: connectionState?.threadId,
    binding: connectionState?.binding,
    reason: connectionState?.reason,
  };
}
function toolError(result: CallToolResult): string | undefined {
  return result.isError
    ? (result.content?.find((c) => c.type === 'text')?.text ?? 'Canvas tool failed')
    : undefined;
}
async function appCall<K extends Action>(
  action: K,
  args: Input<K>,
  timeout?: number,
  interaction?: string,
) {
  const input = contracts[action].input.parse(args);
  return client.call({ action, args: input }, contextId, timeout, interaction);
}
export async function hostTool<K extends Operation>(
  action: K,
  args: Input<K>,
  interaction?: string,
): Promise<Output<K>> {
  if (action === 'draft_write') latestDraft = contracts.draft_write.input.parse(args).draft;
  if (action === 'view_write') latestView = contracts.view_write.input.parse(args).view;
  const previousContext = contextId;
  const generation = bindingGeneration;
  let result = await appCall(action, args, undefined, interaction);
  if (generation !== bindingGeneration)
    throw new RuntimeError('stale', 'Canvas target changed before the operation completed.');
  if (result.isError && result._meta?.['repo-kit/error'] === 'expired') {
    // Only retry a confirmed pre-operation context rejection, never an uncertain transport failure.
    if (contextId === previousContext) {
      connecting ??= connectRepository(repository, true).finally(() => {
        connecting = undefined;
      });
      await connecting;
    }
    if (generation !== bindingGeneration)
      throw new RuntimeError('stale', 'Canvas target changed during recovery.');
    result = await appCall(action, args, undefined, interaction);
  }
  if (generation !== bindingGeneration)
    throw new RuntimeError('stale', 'Canvas target changed before the operation completed.');
  const error = toolError(result);
  if (error) throw new RuntimeError('unavailable', error);
  if (!result.structuredContent) throw new Error('Canvas tool returned no data');
  return parseOutput(action, result.structuredContent.value);
}
export async function requireMessaging() {
  if (!hosted) throw new Error('Open Repo Canvas from a supported host to send messages.');
  await client.requireMessaging();
}
export async function sendToChat(text: string, interaction?: string) {
  await requireMessaging();
  await client.sendMessage(text, interaction);
}

async function connectRepository(repo?: string, recover = false): Promise<boolean> {
  const result = await appCall('connect', { panelId, ...(repo ? { repo } : {}) });
  const error = toolError(result);
  if (error) throw new Error(error);
  const value = parseOutput('connect', result.structuredContent?.value);
  connectionState = value;
  client.requireBuild(value.server.build);
  if (!value.target) {
    window.dispatchEvent(new Event('repo-canvas-connection'));
    return false;
  }
  contextId = value.target.contextId;
  repository = value.target.repo;
  if (recover) {
    if (latestDraft !== undefined) {
      const restored = await appCall('draft_write', { draft: latestDraft });
      const error = toolError(restored);
      if (error) throw new Error(error);
      parseOutput('draft_write', restored.structuredContent?.value);
    }
    if (latestView !== undefined) {
      const restored = await appCall('view_write', { view: latestView });
      const error = toolError(restored);
      if (error) throw new Error(error);
      parseOutput('view_write', restored.structuredContent?.value);
    }
  }
  window.dispatchEvent(new Event('repo-canvas-connection'));
  return true;
}
export async function openRepository(repo: string) {
  // Let an in-flight automatic lookup finish before honoring the explicit choice.
  await connecting?.catch(() => undefined);
  bindingGeneration++;
  connecting = connectRepository(repo).finally(() => {
    connecting = undefined;
  });
  await connecting;
}
export async function prepareHost(): Promise<boolean> {
  connecting ??= connectRepository(repository).finally(() => {
    connecting = undefined;
  });
  return connecting;
}
export async function repositoryChoices() {
  const result = await appCall('catalog', {});
  const error = toolError(result);
  if (error) throw new Error(error);
  return parseOutput('catalog', result.structuredContent?.value);
}
export async function rememberRepository() {
  const result = await appCall('remember', {});
  const error = toolError(result);
  if (error) throw new Error(error);
}
export async function connectionDiagnostics() {
  let server: ServerInfo | { error: string };
  try {
    const result = await appCall('diagnostics', {}, 5000);
    const error = toolError(result);
    if (error) throw new Error(error);
    server = parseOutput('diagnostics', result.structuredContent?.value);
    if (connectionState) connectionState.server = server;
  } catch (error) {
    server = { error: String(error) };
  }
  return {
    ...connectionStatus(),
    capturedAt: new Date().toISOString(),
    client: client.diagnostics(),
    server,
  };
}
