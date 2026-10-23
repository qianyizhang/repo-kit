import { backgroundActions } from '../model/operations.ts';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { HostSession } from '../../../../../mcp-app-runtime/src/host-session.ts';
import { RuntimeError } from '../../../../../mcp-app-runtime/src/definition.ts';
import { eventMetadataSchema } from '../../../../../mcp-app-runtime/src/events.ts';
import { BUILD, VERSION } from '../model/build';
import { AppDiagnostics, plainMessageFlow } from '../../../diagnostics/client';

/** Canvas adapter. Session policy belongs to HostSession; repository recovery to host.ts. */
export class HostClient {
  #session: HostSession;
  #onTarget: (value: unknown) => void;
  readonly inspection: AppDiagnostics;
  lastMessageInteraction?: string;
  constructor(onTarget: (value: unknown) => void, connection: () => object = () => ({})) {
    this.#onTarget = onTarget;
    this.#session = this.create();
    const remote = async (name: string, args: Record<string, unknown>) => {
      await this.ready();
      const result = await this.#session.callServerTool(
        { name, arguments: args },
        { timeout: 5000 },
      );
      if (result.isError)
        throw new Error(
          result.content?.find((item) => item.type === 'text')?.text ?? 'Diagnostics unavailable',
        );
      return result.structuredContent;
    };
    this.inspection = new AppDiagnostics({
      remote,
      name: 'Repo Canvas',
      version: VERSION,
      build: BUILD,
      mode: 'hosted',
      info: () => ({
        host: this.#session.getHostVersion(),
        ...this.#session.snapshot(),
        ...connection(),
      }),
      flows: [
        plainMessageFlow,
        {
          name: 'Selected map and notes · fixture',
          steps: [
            'App freezes selected map scope and notes',
            'App → Server: create local discussion request',
            'App → Host: text and bounded selected summary',
            'Host acknowledgment is separate from conversation response',
            'A proposal still requires Apply to draft and Save',
          ],
          request: {
            text: 'Review this module',
            selected: 'Chosen module and explicit notes only',
          },
          reads: ['Request details, source and provenance are read separately only when needed'],
        },
      ],
    });
  }
  private create() {
    return new HostSession(
      {
        name: 'Repo Canvas',
        version: VERSION,
        capabilities: { availableDisplayModes: ['inline', 'fullscreen'] },
      },
      { ontoolresult: (result) => this.#onTarget(result.structuredContent) },
    );
  }
  async ready() {
    if (this.#session.snapshot().phase === 'unavailable') {
      await this.#session.dispose();
      this.#session = this.create();
    }
    await this.#session.connect();
  }
  async call(
    request: object,
    contextId?: string,
    timeout = 30000,
    interaction?: string,
  ): Promise<CallToolResult> {
    await this.ready();
    const action = 'action' in request ? String(request.action) : '';
    const trace = { interaction: interaction ?? crypto.randomUUID(), callId: crypto.randomUUID() };
    const payload = {
      name: 'canvas_app',
      arguments: { request, ...(contextId ? { contextId } : {}) },
      _meta: { 'repo-kit/interaction': trace },
    };
    return this.inspection.observe(
      `tools/call:canvas_app:${action}`,
      payload,
      () => this.#session.callServerTool(payload, { timeout }),
      {
        ...trace,
        retention: interaction || !backgroundActions.includes(action) ? 'user' : 'background',
      },
    );
  }
  requireBuild(build: string) {
    if (build !== BUILD)
      this.#session.incompatible(
        'UI and server builds differ. Reopen the panel after refreshing the plugin.',
      );
  }
  async requireMessaging() {
    await this.ready();
    if (!this.#session.getHostCapabilities()?.message)
      throw new RuntimeError('unavailable', 'This host does not support app messages.');
  }
  async sendMessage(text: string, interaction: string = crypto.randomUUID()) {
    await this.requireMessaging();
    const payload = { role: 'user' as const, content: [{ type: 'text' as const, text }] };
    this.lastMessageInteraction = interaction;
    const result = await this.inspection.observe(
      'ui/message',
      payload,
      () => this.#session.sendMessage(payload),
      { interaction, retention: 'user' },
    );
    if (result.isError) throw new RuntimeError('rejected', 'The host did not accept the message.');
  }
  diagnostics() {
    return this.inspection.log.events.map((event) => eventMetadataSchema.parse(event));
  }
}
