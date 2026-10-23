import {
  McpServer,
  type RegisteredTool,
  type ToolCallback,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema, ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { toJsonSchemaCompat } from '@modelcontextprotocol/sdk/server/zod-json-schema-compat.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { Recorder } from './events.ts';
import { diagnosticOperations } from './operations.ts';
import { LogStore } from './store.ts';

type Configuration<
  O extends ZodRawShapeCompat | AnySchema,
  I extends undefined | ZodRawShapeCompat | AnySchema,
> = Pick<RegisteredTool, 'title' | 'description' | 'annotations' | '_meta'> & {
  inputSchema?: I;
  outputSchema?: O;
};

/** Registration metadata and transport observations share the actual server owner. */
export class ObservableServer extends McpServer {
  readonly diagnostics: LogStore;
  private readonly recorder: Recorder;
  private readonly catalogEntries = new Map<string, RegisteredTool>();
  private readonly pending = new Map<
    string,
    { interaction: string; method: string; observer: boolean }
  >();
  readonly identity: { name: string; version: string; build: string };
  constructor(
    appId: string,
    identity: { name: string; version: string; build: string },
    options?: ConstructorParameters<typeof McpServer>[1],
    store = new LogStore(appId),
  ) {
    super(identity, options);
    this.identity = identity;
    this.diagnostics = store;
    this.recorder = new Recorder('server', (event) => store.append(event));
    this.registerDiagnostics();
  }
  override registerTool<
    O extends ZodRawShapeCompat | AnySchema,
    I extends undefined | ZodRawShapeCompat | AnySchema = undefined,
  >(name: string, config: Configuration<O, I>, callback: ToolCallback<I>): RegisteredTool {
    const tool = super.registerTool<O, I>(name, config, callback);
    this.catalogEntries.set(name, tool);
    return tool;
  }
  catalog() {
    return [...this.catalogEntries]
      .filter(([, tool]) => tool.enabled)
      .map(([name, tool]) => ({
        name,
        description: tool.description ?? '',
        inputSchema: tool.inputSchema ? toJsonSchemaCompat(tool.inputSchema) : { type: 'object' },
        outputSchema: tool.outputSchema ? toJsonSchemaCompat(tool.outputSchema) : null,
        outputNote: tool.outputSchema
          ? 'Registered output schema'
          : 'MCP CallToolResult; no separate output schema registered',
        annotations: tool.annotations ?? {},
        metadata: tool._meta ?? {},
      }));
  }
  private operations = [] as ReturnType<typeof diagnosticOperations>;
  private registerDiagnostics() {
    this.operations = diagnosticOperations(this.diagnostics, this.identity, () => this.catalog());
    for (const operation of this.operations)
      this.registerTool(
        operation.name,
        {
          description: operation.description,
          inputSchema: operation.input,
          annotations: {
            readOnlyHint: !operation.writes,
            destructiveHint: false,
            openWorldHint: false,
          },
          _meta: { ui: { visibility: ['app'] } },
        },
        (args) => ({ content: [], structuredContent: operation.run(args) }),
      );
  }
  callDiagnostics(name: string, args: unknown) {
    const operation = this.operations.find((operation) => operation.name === name);
    if (!operation) throw new Error('Unknown diagnostic operation');
    return operation.run(args);
  }
  async observeOperation<T>(method: string, args: unknown, run: () => T | Promise<T>): Promise<T> {
    const interaction = crypto.randomUUID();
    this.recorder.record(interaction, method, 'HTTP → Server', 'request', 'received', args);
    try {
      const result = await run();
      this.recorder.record(interaction, method, 'Server → HTTP', 'result', 'completed', result);
      return result;
    } catch (error) {
      this.recorder.record(interaction, method, 'Server → HTTP', 'error', 'failed', String(error));
      throw error;
    }
  }
  httpStatus(method: string, request: unknown) {
    const interaction = crypto.randomUUID();
    this.recorder.record(interaction, method, 'HTTP → Server', 'request', 'received', request);
    return (status: number) =>
      this.recorder.record(
        interaction,
        method,
        'Server → HTTP',
        'result',
        status < 400 ? 'completed' : 'failed',
        { status, body: 'Not recorded at this server boundary; inspect the decoded app response' },
      );
  }
  private observe(message: JSONRPCMessage, incoming: boolean) {
    const id = 'id' in message ? message.id : undefined;
    if ('method' in message) {
      const name =
        message.method === 'tools/call' && typeof message.params?.name === 'string'
          ? message.params.name
          : '';
      const observer = name.startsWith('diagnostics_');
      const method = name ? `${message.method}:${name}` : message.method;
      const interaction = crypto.randomUUID();
      if (id !== undefined) {
        this.pending.set(`${incoming}:${typeof id}:${id}`, { interaction, method, observer });
        if (this.pending.size > 250) this.pending.delete(this.pending.keys().next().value!);
      }
      if (!observer)
        this.recorder.record(
          interaction,
          method.slice(0, 120),
          incoming ? 'Host → Server' : 'Server → Host',
          'request',
          'received',
          message,
        );
    } else if (id !== undefined) {
      const key = `${!incoming}:${typeof id}:${id}`,
        request = this.pending.get(key);
      this.pending.delete(key);
      if (request && !request.observer)
        this.recorder.record(
          request.interaction,
          request.method.slice(0, 120),
          incoming ? 'Host → Server' : 'Server → Host',
          'result',
          'error' in message || message.result.isError === true ? 'failed' : 'completed',
          message,
        );
    }
  }
  override async connect(inner: Transport) {
    const wrapper: Transport = {
      get sessionId() {
        return inner.sessionId;
      },
      start: async () => {
        inner.onmessage = (message, extra) => {
          this.observe(message, true);
          wrapper.onmessage?.(message, extra);
        };
        inner.onerror = (error) => wrapper.onerror?.(error);
        inner.onclose = () => wrapper.onclose?.();
        await inner.start();
      },
      send: async (message, options) => {
        this.observe(message, false);
        await inner.send(message, options);
      },
      close: () => inner.close(),
      setProtocolVersion: (version) => inner.setProtocolVersion?.(version),
    };
    return super.connect(wrapper);
  }
}
