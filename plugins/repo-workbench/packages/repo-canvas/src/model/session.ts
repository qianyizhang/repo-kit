import type { z } from 'zod';
import type {
  viewSchema,
  commandSchema,
  queuedCommandSchema,
  proposalSchema,
  inboxSchema,
} from './contracts';
export type CanvasView = z.output<typeof viewSchema>;
export type CanvasCommand = z.output<typeof commandSchema>;
export type QueuedCommand = z.output<typeof queuedCommandSchema>;
export type CanvasProposal = z.output<typeof proposalSchema>;
export type AgentInbox = z.output<typeof inboxSchema>;
