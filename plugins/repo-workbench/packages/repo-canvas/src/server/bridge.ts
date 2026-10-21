import { DiscussionStore } from './discussion.ts';
import { CanvasSession } from './session.ts';
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
  readonly session = new CanvasSession();
  readonly discussion: DiscussionStore;
  constructor(identity?: { repo: string; chat: string; directory?: string }) {
    this.discussion = new DiscussionStore(identity);
  }
  private recovery: {
    document: ChatRequest['document'];
    revision: string;
    scope: string;
    selection: string | null;
    selections?: string[];
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
    const selections = data.selections;
    if (
      selections !== undefined &&
      (!Array.isArray(selections) ||
        selections.length > 500 ||
        selections.some((id) => !document.modules.some((m) => m.id === id)) ||
        new Set(selections).size !== selections.length)
    )
      throw new Error('Invalid draft selections');
    this.recovery = {
      document,
      revision: data.revision,
      scope: data.scope,
      selection: data.selection as string | null,
      ...(selections === undefined ? {} : { selections: selections as string[] }),
    };
    return { stored: true };
  }

  current(canvasId: unknown): CanvasExchange | null {
    return (
      this.discussion.read().history.findLast((e) => e.canvasId === canvasKey(canvasId)) ?? null
    );
  }

  enqueue(canvasId: unknown, context: ChatRequest): CanvasExchange {
    const key = canvasKey(canvasId);
    const exchange: CanvasExchange = {
      id: randomUUID(),
      canvasId: key,
      context,
      status: 'pending',
      response: null,
    };
    this.discussion.change((value) => {
      if (value.history.some((e) => e.canvasId === key && e.status === 'pending'))
        throw new Error('Conflict: Request is already pending');
      if (value.history.length >= 100)
        throw new Error('Local history is full. Clear it explicitly before sending more requests.');
      return { ...value, history: [...value.history, exchange] };
    });
    return exchange;
  }

  list() {
    return this.discussion.read().history.map(({ id, status, context }) => ({
      id,
      status,
      scope: context.scope,
      selection: context.selection,
      selections: context.selections ?? (context.selection ? [context.selection] : []),
      question: context.messages.at(-1)!.text,
    }));
  }

  read(id: string): CanvasExchange {
    const exchange = this.discussion.read().history.find((entry) => entry.id === id);
    if (!exchange)
      throw new Error('Request not found. It may have been replaced or the server restarted.');
    return exchange;
  }

  reply(id: string, value: unknown): CanvasExchange {
    const exchange = this.read(id);
    if (exchange.status !== 'pending') throw new Error('Conflict: Request is no longer pending');
    const response = parseReply(value);
    const updated: CanvasExchange = { ...exchange, status: 'answered', response };
    this.discussion.change((value) => {
      if (value.history.find((e) => e.id === id)?.status !== 'pending')
        throw new Error('Conflict: Request is no longer pending');
      return { ...value, history: value.history.map((e) => (e.id === id ? updated : e)) };
    });
    return updated;
  }

  cancel(canvasId: unknown, id: unknown): CanvasExchange {
    const current = this.current(canvasId);
    if (!current || current.id !== id || current.status !== 'pending')
      throw new Error('Conflict: Request is no longer pending');
    const updated: CanvasExchange = { ...current, status: 'cancelled' };
    this.discussion.change((value) => {
      if (value.history.find((e) => e.id === id)?.status !== 'pending')
        throw new Error('Conflict: Request is no longer pending');
      return { ...value, history: value.history.map((e) => (e.id === id ? updated : e)) };
    });
    return updated;
  }
}
