import { App, applyDocumentTheme, type McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { ErrorCode, McpError, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { VERSION } from '../model/build';

/** Standard host protocol only. Repository binding and recovery live in host.ts. */
export class HostClient {
  private readonly app = new App(
    { name: 'Repo Canvas', version: VERSION },
    { availableDisplayModes: ['inline', 'fullscreen'] },
    { autoResize: true, strict: true },
  );
  private initialization?: Promise<void>;
  private readonly lifetime = new AbortController();
  private sequence = 0;
  private readonly events: Array<{
    time: string;
    requestId: number;
    method: string;
    action?: string;
    status: string;
    elapsedMs: number;
    error?: string;
  }> = [];
  constructor(onTarget: (value: unknown) => void) {
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
    action: string | undefined,
    run: () => Promise<T>,
  ): Promise<T> {
    const started = Date.now(),
      requestId = ++this.sequence;
    const record = (status: string, error?: string) => {
      this.events.push({
        time: new Date().toISOString(),
        requestId,
        method,
        action,
        status,
        elapsedMs: Date.now() - started,
        ...(error ? { error: error.slice(0, 2000) } : {}),
      });
      if (this.events.length > 200) this.events.shift();
    };
    record('sent');
    try {
      const result = await run();
      record(result.isError ? 'tool-error' : 'received');
      return result;
    } catch (error) {
      const closed = this.lifetime.signal.aborted;
      const timeout =
        !closed && error instanceof McpError && error.code === Number(ErrorCode.RequestTimeout);
      const message = closed
        ? 'Canvas closed'
        : timeout
          ? 'The host did not acknowledge the request. Delivery is uncertain; inspect the main chat before sending again.'
          : String(error);
      record(closed ? 'closed' : timeout ? 'timeout' : 'rpc-error', message);
      throw new Error(message, { cause: error });
    }
  }
  async call(request: object, contextId?: string, timeout = 30000): Promise<CallToolResult> {
    await this.ready();
    return this.observed(
      'tools/call',
      'action' in request ? String(request.action) : undefined,
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
    const result = await this.observed('ui/message', undefined, () =>
      this.app.sendMessage(
        { role: 'user', content: [{ type: 'text', text }] },
        { timeout: 30000, signal: this.lifetime.signal },
      ),
    );
    if (result.isError) throw new Error('The host did not accept the message.');
  }
  diagnostics() {
    return [...this.events];
  }
}
