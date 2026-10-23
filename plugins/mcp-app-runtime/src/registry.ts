import { immutable, RuntimeError } from "./definition.ts";

export type Principal = Readonly<{ kind: "chat" | "local"; id: string }>;
export function hostedPrincipal(
  meta: Record<string, unknown> | undefined,
): Principal {
  const id = meta?.threadId ?? meta?.thread_id;
  if (
    (meta?.threadId && meta.thread_id && meta.threadId !== meta.thread_id) ||
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)
  )
    throw new RuntimeError(
      "forbidden",
      "Hosted access requires a caller chat identity. Reopen in a supported host or use standalone mode.",
    );
  return immutable({ kind: "chat" as const, id: id.toLowerCase() });
}
export const LOCAL_PRINCIPAL: Principal = immutable({
  kind: "local",
  id: "standalone",
});
type Policy = {
  maxEntries: number;
  maxBytes: number;
  maxAgeMs: number;
  overflow: "reject" | "evict";
};
type Entry<T> = {
  id: string;
  owner: Principal;
  value: T;
  bytes: number;
  touched: number;
};
const same = (a: Principal, b: Principal) => a.kind === b.kind && a.id === b.id;

/** Authorization is inseparable from lookup. Values stay private to the domain owner. */
export class ScopedRegistry<T> {
  #policy: Readonly<Policy>;
  get policy() {
    return this.#policy;
  }
  #entries = new Map<string, Entry<T>>();
  #closed = false;
  #dispose: (value: T) => void;
  #clock: () => number;
  constructor(
    policy: Policy,
    dispose: (value: T) => void = () => {},
    clock = Date.now,
  ) {
    if (
      ![policy.maxEntries, policy.maxBytes, policy.maxAgeMs].every(
        (n) => Number.isSafeInteger(n) && n > 0,
      )
    )
      throw new Error("Registry limits must be positive safe integers");
    this.#policy = immutable(policy);
    this.#dispose = dispose;
    this.#clock = clock;
  }
  #active() {
    if (this.#closed)
      throw new RuntimeError("closed", "Session registry is closed");
    for (const entry of this.#entries.values())
      if (this.#clock() - entry.touched >= this.policy.maxAgeMs)
        this.#remove(entry.id);
  }
  #remove(id: string) {
    const entry = this.#entries.get(id);
    if (!entry) return;
    this.#entries.delete(id);
    this.#dispose(entry.value);
  }
  create(
    owner: Principal,
    value: T,
    bytes = 0,
    id: string = crypto.randomUUID(),
  ): string {
    this.#active();
    if (!owner.id || !["chat", "local"].includes(owner.kind))
      throw new RuntimeError("forbidden", "Missing context owner");
    if (
      !Number.isSafeInteger(bytes) ||
      bytes < 0 ||
      bytes > this.policy.maxBytes
    )
      throw new RuntimeError(
        "limit",
        "Context exceeds its declared memory budget",
      );
    if (this.#entries.has(id)) throw new Error("Duplicate context identity");
    const full = () =>
      this.#entries.size >= this.policy.maxEntries ||
      [...this.#entries.values()].reduce((n, e) => n + e.bytes, bytes) >
        this.policy.maxBytes;
    while (full()) {
      if (this.policy.overflow === "reject")
        throw new RuntimeError(
          "limit",
          "Session limit reached. Close an unused context before opening another.",
        );
      this.#remove(this.#entries.keys().next().value!);
    }
    this.#entries.set(id, {
      id,
      owner: immutable(owner),
      value,
      bytes,
      touched: this.#clock(),
    });
    return id;
  }
  resolve(id: string, owner: Principal): T {
    this.#active();
    const entry = this.#entries.get(id);
    if (!entry || !same(entry.owner, owner))
      throw new RuntimeError(
        "expired",
        "Context unavailable for this caller. Reopen the selected app.",
      );
    entry.touched = this.#clock();
    return entry.value;
  }
  update(id: string, owner: Principal, value: T, bytes: number) {
    this.resolve(id, owner);
    if (
      !Number.isSafeInteger(bytes) ||
      bytes < 0 ||
      bytes > this.policy.maxBytes
    )
      throw new RuntimeError(
        "limit",
        "Context exceeds its declared memory budget",
      );
    const total = () =>
      [...this.#entries.values()].reduce(
        (n, e) => n + (e.id === id ? bytes : e.bytes),
        0,
      );
    while (total() > this.policy.maxBytes) {
      if (this.policy.overflow === "reject")
        throw new RuntimeError("limit", "Session memory budget reached");
      const victim = [...this.#entries.keys()].find((key) => key !== id);
      if (!victim)
        throw new RuntimeError("limit", "Session memory budget reached");
      this.#remove(victim);
    }
    const entry = this.#entries.get(id)!;
    entry.value = value;
    entry.bytes = bytes;
  }
  list(owner: Principal): Array<{ id: string; value: T }> {
    this.#active();
    return [...this.#entries.values()]
      .filter((e) => same(e.owner, owner))
      .map(({ id, value }) => ({ id, value }));
  }
  release(id: string, owner: Principal) {
    this.resolve(id, owner);
    this.#remove(id);
  }
  close() {
    if (this.#closed) return;
    this.#closed = true;
    for (const id of this.#entries.keys()) this.#remove(id);
  }
}
