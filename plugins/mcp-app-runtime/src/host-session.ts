import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
  applyHostFonts,
} from "@modelcontextprotocol/ext-apps";
import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { immutable, RuntimeError, PROTOCOL_VERSION } from "./definition.ts";

type Phase =
  | "created"
  | "connecting"
  | "ready"
  | "unavailable"
  | "incompatible"
  | "closed";
const transitions = immutable<Record<Phase, Phase[]>>({
  created: ["connecting", "closed"],
  connecting: ["ready", "unavailable", "incompatible", "closed"],
  ready: ["incompatible", "closed"],
  unavailable: ["closed"],
  incompatible: ["closed"],
  closed: [],
});
export type HostDefinition = {
  name: string;
  version: string;
  capabilities?: ConstructorParameters<typeof App>[1];
  timeout?: number;
};
type HandlerName =
  | "ontoolresult"
  | "ontoolinput"
  | "ontoolinputpartial"
  | "ontoolcancelled"
  | "onhostcontextchanged"
  | "onteardown"
  | "onclose"
  | "onerror";
export type HostHandlers = Partial<Pick<App, HandlerName>>;
export type HostAdapter = Pick<
  App,
  | HandlerName
  | "connect"
  | "close"
  | "getHostCapabilities"
  | "getHostVersion"
  | "getHostContext"
  | "callServerTool"
  | "readServerResource"
  | "sendMessage"
  | "updateModelContext"
  | "openLink"
  | "downloadFile"
  | "requestTeardown"
>;
const sdkAdapter = (definition: HostDefinition): HostAdapter =>
  new App(
    { name: definition.name, version: definition.version },
    definition.capabilities ?? {},
    { autoResize: true, strict: true },
  );
/** Fixed callbacks and policy; SDK ownership and effect lifecycle cannot escape this module. */
export class HostSession {
  #definition: Readonly<HostDefinition & { id: string; protocol: number }>;
  get definition() {
    return this.#definition;
  }
  #app: HostAdapter;
  #phase: Phase = "created";
  #lifetime = new AbortController();
  #connecting?: Promise<void>;
  #sending = false;
  #capabilities?: ReturnType<App["getHostCapabilities"]>;
  #handlers: Readonly<HostHandlers>;
  constructor(
    definition: HostDefinition,
    handlers: HostHandlers = {},
    create = sdkAdapter,
  ) {
    this.#definition = immutable({
      ...definition,
      id: crypto.randomUUID(),
      protocol: PROTOCOL_VERSION,
    });
    this.#handlers = Object.freeze({ ...handlers });
    this.#app = create(this.definition);
    this.#app.ontoolresult = (value) => {
      if (this.#live()) this.#handlers.ontoolresult?.(value);
    };
    this.#app.ontoolinput = (value) => {
      if (this.#live()) this.#handlers.ontoolinput?.(value);
    };
    this.#app.ontoolinputpartial = (value) => {
      if (this.#live()) this.#handlers.ontoolinputpartial?.(value);
    };
    this.#app.ontoolcancelled = (value) => {
      if (this.#live()) this.#handlers.ontoolcancelled?.(value);
    };
    this.#app.onhostcontextchanged = (value) => {
      if (!this.#live()) return;
      this.#present(value);
      this.#handlers.onhostcontextchanged?.(immutable(value));
    };
    this.#app.onteardown = async (value, extra) => {
      if (this.#phase === "closed") return {};
      this.#end();
      return (await this.#handlers.onteardown?.(value, extra)) ?? {};
    };
    this.#app.onclose = () => {
      if (this.#phase === "closed") return;
      this.#end();
      this.#handlers.onclose?.();
    };
    this.#app.onerror = (error) => {
      if (this.#live()) this.#handlers.onerror?.(error);
    };
  }
  #live() {
    return this.#phase === "connecting" || this.#phase === "ready";
  }
  #transition(next: Phase) {
    if (!transitions[this.#phase].includes(next))
      throw new RuntimeError(
        "closed",
        `Session transition ${this.#phase} → ${next} is not allowed`,
      );
    this.#phase = next;
  }
  #end() {
    if (this.#phase === "closed") return;
    this.#transition("closed");
    this.#lifetime.abort(new RuntimeError("closed", "Panel session closed"));
  }
  #present(context?: Partial<McpUiHostContext>) {
    if (typeof document === "undefined" || !context) return;
    if (context.theme) applyDocumentTheme(context.theme);
    if (context.styles?.variables)
      applyHostStyleVariables(context.styles.variables);
    if (context.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts);
    if (context.locale) document.documentElement.lang = context.locale;
    if (context.displayMode)
      document.documentElement.dataset.displayMode = context.displayMode;
  }
  get signal() {
    return this.#lifetime.signal;
  }
  snapshot() {
    return immutable({
      id: this.definition.id,
      phase: this.#phase,
      sending: this.#sending,
      capabilities: this.#capabilities,
    });
  }
  getHostCapabilities() {
    return this.#phase === "ready" && this.#capabilities
      ? immutable(this.#capabilities)
      : undefined;
  }
  getHostVersion() {
    const value = this.#app.getHostVersion();
    return value && immutable(value);
  }
  getHostContext() {
    const value = this.#app.getHostContext();
    return value && immutable(value);
  }
  async connect(
    transport?: Parameters<App["connect"]>[0],
    options?: Parameters<App["connect"]>[1],
  ) {
    if (this.#phase === "ready") return;
    if (this.#phase === "connecting") return this.#connecting;
    if (this.#phase !== "created")
      throw new RuntimeError(
        "unavailable",
        "This session ended. Create a new panel session to reconnect.",
      );
    this.#transition("connecting");
    this.#connecting = Promise.resolve()
      .then(() => this.#app.connect(transport, this.#options(options)))
      .then(() => {
        if (this.#lifetime.signal.aborted)
          throw new RuntimeError("closed", "Session closed during connection");
        this.#capabilities = immutable(this.#app.getHostCapabilities());
        this.#transition("ready");
        this.#present(this.#app.getHostContext());
      })
      .catch((cause: unknown) => {
        if (this.#phase === "connecting") this.#transition("unavailable");
        this.#lifetime.abort(cause);
        throw new RuntimeError(
          "unavailable",
          "Host connection unavailable. Reopen or retry with a new session.",
          { cause },
        );
      });
    return this.#connecting;
  }
  #options(options?: Parameters<App["connect"]>[1]) {
    return {
      ...options,
      timeout: options?.timeout ?? this.definition.timeout ?? 30000,
      signal: options?.signal
        ? AbortSignal.any([this.signal, options.signal])
        : this.signal,
    };
  }
  async #invoke<T>(
    capability:
      keyof NonNullable<ReturnType<App["getHostCapabilities"]>> | undefined,
    run: () => Promise<T>,
    effect = false,
  ): Promise<T> {
    await this.connect();
    if (this.signal.aborted)
      throw new RuntimeError("closed", "Panel session closed");
    if (capability && !this.#capabilities?.[capability])
      throw new RuntimeError(
        "unavailable",
        `This host does not support ${capability}.`,
      );
    try {
      const value = await run();
      if (this.signal.aborted)
        throw new RuntimeError(
          effect ? "uncertain" : "closed",
          effect
            ? "Delivery is uncertain after disconnect; check the conversation before retrying."
            : "Read completed after the session closed",
        );
      return value;
    } catch (cause) {
      if (cause instanceof RuntimeError) throw cause;
      const explicit =
        cause instanceof McpError &&
        cause.code !== Number(ErrorCode.RequestTimeout) &&
        !this.signal.aborted;
      throw new RuntimeError(
        effect
          ? explicit
            ? "rejected"
            : "uncertain"
          : this.signal.aborted
            ? "closed"
            : "unavailable",
        effect && !explicit
          ? "Delivery is uncertain; check the conversation before retrying."
          : String(cause),
        { cause },
      );
    }
  }
  callServerTool(...[params, options]: Parameters<App["callServerTool"]>) {
    const frozen = immutable(params);
    return this.#invoke("serverTools", () =>
      this.#app.callServerTool(frozen, this.#options(options)),
    );
  }
  readServerResource(
    ...[params, options]: Parameters<App["readServerResource"]>
  ) {
    return this.#invoke("serverResources", () =>
      this.#app.readServerResource(immutable(params), this.#options(options)),
    );
  }
  async sendMessage(...[params, options]: Parameters<App["sendMessage"]>) {
    if (this.#sending)
      throw new RuntimeError("busy", "A message is already pending");
    const frozen = immutable(params);
    this.#sending = true;
    try {
      return await this.#invoke(
        "message",
        () => this.#app.sendMessage(frozen, this.#options(options)),
        true,
      );
    } finally {
      this.#sending = false;
    }
  }
  updateModelContext(
    ...[params, options]: Parameters<App["updateModelContext"]>
  ) {
    return this.#invoke(
      undefined,
      () =>
        this.#app.updateModelContext(immutable(params), this.#options(options)),
      true,
    );
  }
  openLink(...[params, options]: Parameters<App["openLink"]>) {
    return this.#invoke("openLinks", () =>
      this.#app.openLink(immutable(params), this.#options(options)),
    );
  }
  downloadFile(...[params, options]: Parameters<App["downloadFile"]>) {
    return this.#invoke("downloadFile", () =>
      this.#app.downloadFile(immutable(params), this.#options(options)),
    );
  }
  requestTeardown(...args: Parameters<App["requestTeardown"]>) {
    return this.#invoke(undefined, () => this.#app.requestTeardown(...args));
  }
  incompatible(message: string): never {
    this.#transition("incompatible");
    this.#lifetime.abort();
    throw new RuntimeError("incompatible", message);
  }
  async dispose() {
    if (this.#phase === "closed") return;
    this.#end();
    await this.#app.close();
  }
}
