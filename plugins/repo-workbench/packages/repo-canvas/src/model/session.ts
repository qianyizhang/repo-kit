import type { Architecture } from './document';
import type { Viewport } from './layout';
export interface CanvasView {
  document: Architecture;
  baseRevision: string;
  scope: string;
  selections: string[];
  panel: 'inspect' | 'chat' | null;
  navigation: boolean;
  viewport: Viewport;
  dirty: boolean;
  conflict: boolean;
}
export type CanvasCommand =
  | { action: 'focus'; target: string }
  | { action: 'select'; targets: string[] }
  | { action: 'fit' | 'read' | 'fit_selection' }
  | { action: 'panel'; panel: CanvasView['panel'] }
  | { action: 'navigation'; open: boolean };
export interface QueuedCommand {
  id: string;
  expectedRevision: string;
  command: CanvasCommand;
  status: 'pending' | 'applied' | 'rejected';
  message?: string;
}
export interface CanvasProposal {
  id: string;
  baseDocument: Architecture;
  document: Architecture;
  explanation: string;
}
export interface AgentInbox {
  command: QueuedCommand | null;
  proposal: CanvasProposal | null;
}
