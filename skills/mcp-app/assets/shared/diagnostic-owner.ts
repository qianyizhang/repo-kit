export type Principal = Readonly<{ kind: "chat" | "local"; id: string }>;

// The adapter must supply trusted host metadata, never tool arguments.
export function hostChatPrincipal(
  meta: Record<string, unknown> | undefined,
): Principal | undefined {
  const id = meta?.threadId ?? meta?.thread_id;
  if (
    (meta?.threadId != null &&
      meta.thread_id != null &&
      meta.threadId !== meta.thread_id) ||
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)
  )
    return undefined;
  return Object.freeze({ kind: "chat", id: id.toLowerCase() });
}

export const LOCAL_PRINCIPAL: Principal = Object.freeze({
  kind: "local",
  id: "standalone",
});

export function diagnosticOwner(principal: Principal) {
  return `${principal.kind}:${principal.id}`;
}
export const LOCAL_DIAGNOSTIC_OWNER = diagnosticOwner(LOCAL_PRINCIPAL);

export function eventsForOwner<T extends { owner?: string }>(
  events: readonly T[],
  owner: string | undefined,
) {
  return events.filter((event) => event.owner === owner);
}
