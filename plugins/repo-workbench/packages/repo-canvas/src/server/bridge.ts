import { randomUUID } from 'node:crypto';
import { parseReply, parseDocument, type ChatRequest } from '../model/document.ts';
import type { CanvasExchange } from '../model/bridge.ts';

function canvasKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value))
    throw new Error('Invalid canvas tab ID');
  return value;
}

/** A bounded local mailbox. Only the connected agent supplies answers; no model runs here. */
export class CanvasBridge {
  private recovery: {
    document: ChatRequest['document'];
    revision: string;
    scope: string;
    selection: string | null;
  } | null = null;

  draft() {
    return this.recovery;
  }
  storeDraft(value: unknown) {
    if (value === null) {
      this.recovery = null;
      return { stored: false };
    }
    if (!value || typeof value !== 'object') throw new Error('Invalid draft');
    const data = value as Record<string, unknown>;
    const document = parseDocument(data.document);
    if (
      typeof data.revision !== 'string' ||
      data.revision.length > 100 ||
      typeof data.scope !== 'string' ||
      !document.modules.some((m) => m.id === data.scope) ||
      (data.selection !== null && !document.modules.some((m) => m.id === data.selection))
    )
      throw new Error('Invalid draft context');
    this.recovery = {
      document,
      revision: data.revision,
      scope: data.scope,
      selection: data.selection as string | null,
    };
    return { stored: true };
  }
  private exchanges = new Map<string, CanvasExchange>();

  current(canvasId: unknown): CanvasExchange | null {
    return this.exchanges.get(canvasKey(canvasId)) ?? null;
  }

  enqueue(canvasId: unknown, context: ChatRequest): CanvasExchange {
    const key = canvasKey(canvasId);
    if (this.current(key)?.status === 'pending')
      throw new Error('Conflict: This tab already has a pending request');
    if (!this.exchanges.has(key) && this.exchanges.size >= 20)
      throw new Error('Canvas tab limit reached. Restart the local server to clear old requests.');
    const exchange: CanvasExchange = {
      id: randomUUID(),
      canvasId: key,
      context,
      status: 'pending',
      response: null,
    };
    this.exchanges.set(key, exchange);
    return exchange;
  }

  list() {
    return [...this.exchanges.values()].map(({ id, status, context }) => ({
      id,
      status,
      scope: context.scope,
      selection: context.selection,
      question: context.messages.at(-1)!.text,
    }));
  }

  read(id: string): CanvasExchange {
    const exchange = [...this.exchanges.values()].find((entry) => entry.id === id);
    if (!exchange)
      throw new Error('Request not found. It may have been replaced or the server restarted.');
    return exchange;
  }

  reply(id: string, value: unknown): CanvasExchange {
    const exchange = this.read(id);
    if (exchange.status !== 'pending') throw new Error('Conflict: Request is no longer pending');
    const response = parseReply(value);
    const updated: CanvasExchange = { ...exchange, status: 'answered', response };
    this.exchanges.set(exchange.canvasId, updated);
    return updated;
  }

  cancel(canvasId: unknown, id: unknown): CanvasExchange {
    const current = this.current(canvasId);
    if (!current || current.id !== id || current.status !== 'pending')
      throw new Error('Conflict: Request is no longer pending');
    const updated: CanvasExchange = { ...current, status: 'cancelled' };
    this.exchanges.set(current.canvasId, updated);
    return updated;
  }
}
