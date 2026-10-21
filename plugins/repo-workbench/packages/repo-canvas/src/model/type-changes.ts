import { fieldAccepts, type Architecture } from './document';
/** Surface destructive definition edits before accepting human or agent proposals. */
export function typeChanges(before: Architecture, after: Architecture): string[] {
  const changes: string[] = [];
  for (const node of before.modules) {
    if (!node.typeId) continue;
    const old = before.nodeTypes?.find((t) => t.id === node.typeId);
    const next = after.nodeTypes?.find((t) => t.id === node.typeId);
    if (!next) {
      if (old)
        changes.push(`${node.name}: remove type ${old.label}; keep values as untyped fields`);
      continue;
    }
    if (next.baseKind !== node.kind)
      changes.push(`${node.name}: base kind ${node.kind} → ${next.baseKind}`);
    for (const [key, value] of Object.entries(node.fields ?? {})) {
      const field = old?.fields.find((f) => f.id === key);
      const replacement = next.fields.find((f) => f.id === key);
      if (
        (field && !replacement) ||
        (replacement &&
          (!fieldAccepts(replacement, value) || (field && replacement.kind !== field.kind)))
      ) {
        const proposed = after.modules.find((m) => m.id === node.id)?.fields?.[key];
        const kept = replacement && fieldAccepts(replacement, value);
        changes.push(
          `${node.name} · ${field?.label ?? replacement?.label ?? key}: ${JSON.stringify(value)} → ${kept ? 'retained after type change' : proposed !== undefined && replacement && fieldAccepts(replacement, proposed) ? JSON.stringify(proposed) : 'remove value'}`,
        );
      }
    }
  }
  return changes;
}
export function migrateTypes(before: Architecture, after: Architecture): Architecture {
  return {
    ...after,
    modules: after.modules.map((node) => {
      const old = before.nodeTypes?.find((t) => t.id === node.typeId),
        next = after.nodeTypes?.find((t) => t.id === node.typeId);
      if (!next) return node;
      const fields = { ...node.fields };
      for (const [key, value] of Object.entries(fields)) {
        const replacement = next.fields.find((f) => f.id === key);
        if (replacement ? !fieldAccepts(replacement, value) : old?.fields.some((f) => f.id === key))
          delete fields[key];
      }
      return { ...node, kind: next.baseKind, fields };
    }),
  };
}
