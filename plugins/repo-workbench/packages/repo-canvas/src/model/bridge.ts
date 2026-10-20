import type { ChatReply, ChatRequest } from './document';

export interface CanvasExchange {
  id: string;
  canvasId: string;
  context: ChatRequest;
  status: 'pending' | 'answered' | 'cancelled';
  response: ChatReply | null;
}
