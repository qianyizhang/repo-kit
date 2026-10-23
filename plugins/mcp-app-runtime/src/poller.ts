import { immutable } from "./definition.ts";

/** One owned timer, one in-flight read, bounded retry and explicit disposal. */
export function poll(
  task: (signal: AbortSignal) => Promise<void>,
  options: {
    interval: number;
    maxBackoff?: number;
    immediate?: boolean;
    visibility?: Document;
  },
) {
  const policy = immutable({
    interval: options.interval,
    maxBackoff: options.maxBackoff ?? options.interval * 8,
    immediate: options.immediate ?? true,
  });
  if (!(policy.interval > 0 && policy.maxBackoff >= policy.interval))
    throw new Error("Invalid polling policy");
  const visibility =
    options.visibility ??
    (typeof document === "undefined" ? undefined : document);
  const lifetime = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined,
    flight = false,
    delay = policy.interval;
  const schedule = (wait: number) => {
    if (!lifetime.signal.aborted) timer = setTimeout(() => void tick(), wait);
  };
  const tick = async () => {
    if (flight || lifetime.signal.aborted) return;
    clearTimeout(timer);
    if (visibility?.visibilityState === "hidden") return;
    flight = true;
    try {
      await task(lifetime.signal);
      delay = policy.interval;
    } catch {
      delay = Math.min(delay * 2, policy.maxBackoff);
    } finally {
      flight = false;
      schedule(delay);
    }
  };
  const visible = () => {
    if (visibility?.visibilityState !== "hidden") void tick();
    else clearTimeout(timer);
  };
  visibility?.addEventListener("visibilitychange", visible);
  if (policy.immediate) void tick();
  else schedule(delay);
  return () => {
    lifetime.abort();
    clearTimeout(timer);
    visibility?.removeEventListener("visibilitychange", visible);
  };
}
