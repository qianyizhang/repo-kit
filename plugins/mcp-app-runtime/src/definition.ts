/** Declarations and snapshots are plain data. Maps, instances and callbacks are not declarations. */
export function immutable<T>(value: T): Readonly<T> {
  const copy = structuredClone(value);
  function freeze(item: unknown): void {
    if (!item || typeof item !== "object") return;
    if (
      !Array.isArray(item) &&
      Object.getPrototypeOf(item) !== Object.prototype
    )
      throw new TypeError("A runtime declaration must contain only plain data");
    for (const child of Object.values(item)) freeze(child);
    Object.freeze(item);
  }
  freeze(copy);
  return copy;
}

export const PROTOCOL_VERSION = 1;
const failureCodes = immutable([
  "unavailable",
  "closed",
  "incompatible",
  "rejected",
  "uncertain",
  "busy",
  "expired",
  "forbidden",
  "stale",
  "limit",
  "not_found",
] as const);
export type FailureCode = (typeof failureCodes)[number];
export function failureCode(value: unknown): FailureCode | undefined {
  return failureCodes.find((code) => code === value);
}
export class RuntimeError extends Error {
  readonly code: FailureCode;
  constructor(code: FailureCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RuntimeError";
    this.code = code;
  }
}
