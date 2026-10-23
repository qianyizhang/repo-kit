import type { CanvasExchange } from './bridge.ts';

export function discussionContext(exchange: CanvasExchange) {
  const context = exchange.context;
  const selected = new Set(
    context.selections?.length ? context.selections : [context.selection ?? context.scope],
  );
  const modules = context.document.modules.filter((module) => selected.has(module.id));
  return {
    requestId: exchange.id,
    title: context.document.title,
    scope: context.scope,
    selectedCount: modules.length,
    nodes: modules.slice(0, 5).map((module) => ({
      id: module.id,
      name: module.name,
      kind: module.kind,
      summary: module.summary.slice(0, 400),
    })),
    commentCount: context.comments?.length ?? 0,
    comments: context.comments?.slice(0, 3).map((comment) => ({
      id: comment.id,
      label: comment.label,
      instruction: comment.instruction.slice(0, 400),
      excerpt: comment.captured.slice(0, 400),
    })),
  };
}
