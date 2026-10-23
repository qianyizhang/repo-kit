import { App, applyDocumentTheme, type McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { ErrorCode, McpError, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { BUILD, VERSION } from '../model/build';
import { AppDiagnostics, plainMessageFlow } from '../../../diagnostics/client';
import { eventMetadataSchema } from '../../../diagnostics/events';

/** Standard host protocol only. Repository binding and recovery live in host.ts. */
export class HostClient {
  private readonly app = new App(
    { name: 'Repo Canvas', version: VERSION },
    { availableDisplayModes: ['inline', 'fullscreen'] },
    { autoResize: true, strict: true },
  );
  private initialization?: Promise<void>;
  private readonly lifetime = new AbortController();
  readonly inspection = new AppDiagnostics({
    name: 'Repo Canvas',
    version: VERSION,
    build: BUILD,
    mode: 'hosted',
    info: () => ({
      host: this.app.getHostVersion(),
      capabilities: this.app.getHostCapabilities(),
      closed: this.lifetime.signal.aborted,
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
          'An agent reply can propose changes; Apply to draft and Save remain deliberate actions',
        ],
        request: { text: 'Review this module', selected: 'Chosen module and explicit notes only' },
        reads: ['Request details, source and provenance are read separately only when needed'],
      },
    ],
  });
  lastMessageInteraction?: string;
  constructor(onTarget: (value: unknown) => void) {
    this.inspection.remote = async (name, args) => {
      await this.ready();
      const result = await this.app.callServerTool(
        { name, arguments: args },
        { timeout: 5000, signal: this.lifetime.signal },
      );
      if (result.isError)
        throw new Error(
          result.content?.find((item) => item.type === 'text')?.text ?? 'Diagnostics unavailable',
        );
      return result.structuredContent;
    };
    this.app.ontoolresult = (result) => onTarget(result.structuredContent);
    this.app.onhostcontextchanged = (context) => this.present(context);
    this.app.onteardown = () => {
      this.lifetime.abort(new Error('Canvas closed'));
      return {};
    };
  }
  private present(context?: Partial<McpUiHostContext>) {
    if (context?.theme) applyDocumentTheme(context.theme);
    if (context?.locale) document.documentElement.lang = context.locale;
    if (context?.displayMode) document.documentElement.dataset.displayMode = context.displayMode;
  }
  async ready() {
    if (this.lifetime.signal.aborted) throw new Error('Canvas closed');
    this.initialization ??= this.app
      .connect(undefined, { timeout: 30000, signal: this.lifetime.signal })
      .then(() => this.present(this.app.getHostContext()))
      .catch((error: unknown) => {
        this.initialization = undefined;
        throw error;
      });
    return this.initialization;
  }
  private async observed<T extends { isError?: boolean }>(
    method: string,
    request: unknown,
    run: () => Promise<T>,
  ): Promise<T> {
    return this.inspection.observe(method, request, async () => {
      try {
        return await run();
      } catch (error) {
        const closed = this.lifetime.signal.aborted;
        const timeout =
          !closed && error instanceof McpError && error.code === Number(ErrorCode.RequestTimeout);
        const message = closed
          ? 'Canvas closed'
          : timeout
            ? 'The host did not acknowledge the request. Delivery is uncertain; inspect the main chat before sending again.'
            : String(error);
        throw new Error(message, { cause: error });
      }
    });
  }
  async call(request: object, contextId?: string, timeout = 30000): Promise<CallToolResult> {
    await this.ready();
    return this.observed(
      'tools/call',
      { name: 'canvas_app', arguments: { request, ...(contextId ? { contextId } : {}) } },
      () =>
        this.app.callServerTool(
          { name: 'canvas_app', arguments: { request, ...(contextId ? { contextId } : {}) } },
          { timeout, signal: this.lifetime.signal },
        ),
    );
  }
  async requireMessaging() {
    await this.ready();
    if (!this.app.getHostCapabilities()?.message)
      throw new Error('This host does not support app messages.');
  }
  async sendMessage(text: string) {
    await this.requireMessaging();
    const payload = { role: 'user' as const, content: [{ type: 'text' as const, text }] };
    const pending = this.observed('ui/message', payload, () =>
      this.app.sendMessage(payload, { timeout: 30000, signal: this.lifetime.signal }),
    );
    this.lastMessageInteraction = this.inspection.lastInteraction;
    const result = await pending;
    if (result.isError) throw new Error('The host did not accept the message.');
  }
  diagnostics() {
    return this.inspection.log.events.map((event) => eventMetadataSchema.parse(event));
  }
}
