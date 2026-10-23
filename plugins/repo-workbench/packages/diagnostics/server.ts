import { hostedPrincipal } from '../../../mcp-app-runtime/src/registry.ts';
import {
  McpServer,
  type RegisteredTool,
  type ToolCallback,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema, ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { toJsonSchemaCompat } from '@modelcontextprotocol/sdk/server/zod-json-schema-compat.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { Recorder, type EventContext } from '../../../mcp-app-runtime/src/events.ts';
import { RuntimeError, immutable } from '../../../mcp-app-runtime/src/definition.ts';
import { diagnosticOperations } from './operations.ts';
import { LogStore } from '../../../mcp-app-runtime/src/store.ts';

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
    { interaction: string; method: string; observer: boolean; context: EventContext }
  >();
  #identity: Readonly<{ name: string; version: string; build: string }>;
  get identity() {
    return this.#identity;
  }
  #principal: typeof hostedPrincipal;
  constructor(
    appId: string,
    identity: { name: string; version: string; build: string },
    options?: ConstructorParameters<typeof McpServer>[1],
    store = new LogStore(appId),
    principal: typeof hostedPrincipal = hostedPrincipal,
  ) {
    super(identity, options);
    this.#identity = immutable(identity);
    this.#principal = principal;
    this.diagnostics = store;
    this.recorder = new Recorder('server', (event) => store.append(event));
    this.registerDiagnostics();
  }
  private owner(meta: Record<string, unknown> | undefined) {
    const principal = this.#principal(meta);
    return `${principal.kind}:${principal.id}`;
  }
  override registerTool<
    O extends ZodRawShapeCompat | AnySchema,
    I extends undefined | ZodRawShapeCompat | AnySchema = undefined,
  >(name: string, config: Configuration<O, I>, callback: ToolCallback<I>): RegisteredTool {
    const guarded = (async (...args: Parameters<ToolCallback<I>>) => {
      try {
        return await (callback as (...values: unknown[]) => ReturnType<ToolCallback<I>>)(...args);
      } catch (error) {
        if (!(error instanceof RuntimeError)) throw error;
        return {
          isError: true,
          content: [{ type: 'text' as const, text: error.message }],
          _meta: { 'repo-kit/error': error.code },
        };
      }
    }) as unknown as ToolCallback<I>;
    const tool = super.registerTool<O, I>(name, config, guarded);
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
        (args, extra) => ({
          content: [],
          structuredContent: operation.run(
            args,
            ['diagnostics_info', 'diagnostics_tools'].includes(operation.name)
              ? ''
              : this.owner(extra._meta),
          ),
        }),
      );
  }
  callDiagnostics(name: string, args: unknown) {
    const operation = this.operations.find((operation) => operation.name === name);
    if (!operation) throw new Error('Unknown diagnostic operation');
    return operation.run(args, 'local:standalone');
  }
  async observeOperation<T>(
    method: string,
    args: unknown,
    run: () => T | Promise<T>,
    retention: EventContext['retention'] = 'user',
  ): Promise<T> {
    const interaction = crypto.randomUUID();
    this.recorder.record(interaction, method, 'HTTP → Server', 'request', 'received', args, {
      retention,
      owner: 'local:standalone',
    });
    try {
      const result = await run();
      this.recorder.record(interaction, method, 'Server → HTTP', 'result', 'completed', result, {
        retention,
        owner: 'local:standalone',
      });
      return result;
    } catch (error) {
      this.recorder.record(interaction, method, 'Server → HTTP', 'error', 'failed', String(error), {
        retention,
        owner: 'local:standalone',
      });
      throw error;
    }
  }
  httpStatus(method: string, request: unknown) {
    const interaction = crypto.randomUUID();
    this.recorder.record(interaction, method, 'HTTP → Server', 'request', 'received', request, {
      owner: 'local:standalone',
    });
    return (status: number) =>
      this.recorder.record(
        interaction,
        method,
        'Server → HTTP',
        'result',
        status < 400 ? 'completed' : 'failed',
        { status, body: 'Not recorded at this server boundary; inspect the decoded app response' },
        { owner: 'local:standalone' },
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
      const supplied = message.params?._meta?.['repo-kit/interaction'];
      const trace =
        supplied && typeof supplied === 'object' ? (supplied as Record<string, unknown>) : {};
      const uuid = (value: unknown): value is string =>
        typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
      const interaction = uuid(trace.interaction) ? trace.interaction : crypto.randomUUID();
      const args = message.params?.arguments as { request?: { action?: unknown } } | undefined;
      const declared = this.catalogEntries.get(name)?._meta?.['repo-kit/background-actions'];
      const background = Array.isArray(declared) && declared.includes(args?.request?.action);
      let owner: string | undefined;
      try {
        owner = this.owner(message.params?._meta);
      } catch {
        /* Unidentified traffic has no caller-scoped payload access. */
      }
      const context: EventContext = {
        owner,
        retention: background ? 'background' : 'user',
        ...(uuid(trace.callId) ? { callId: trace.callId } : {}),
        ...(uuid(trace.parentId) ? { parentId: trace.parentId } : {}),
      };
      if (id !== undefined) {
        this.pending.set(`${incoming}:${typeof id}:${id}`, {
          interaction,
          method,
          observer,
          context,
        });
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
          context,
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
          request.context,
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
