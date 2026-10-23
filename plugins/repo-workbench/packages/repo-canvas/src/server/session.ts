import { createHash, randomUUID } from 'node:crypto';
import { parseDocument } from '../model/document.ts';
import type { CanvasView, CanvasCommand, QueuedCommand, CanvasProposal } from '../model/session.ts';
import { viewSchema, commandSchema } from '../model/contracts.ts';
export { commandSchema } from '../model/contracts.ts';
/** Per-context observation and bounded commands. Never saves or executes source. */
export class CanvasSession {
  private state: { view: CanvasView; revision: string; observedAt: string } | null = null;
  private command: QueuedCommand | null = null;
  private proposal: CanvasProposal | null = null;
  observe(value: unknown) {
    const input = viewSchema.parse(value),
      document = parseDocument(input.document);
    const ids = new Set(document.modules.map((m) => m.id));
    if (
      !ids.has(input.scope) ||
      input.selections.some((id) => !ids.has(id)) ||
      new Set(input.selections).size !== input.selections.length
    )
      throw new Error('Invalid view selection or scope');
    const view = { ...input, document };
    if (Buffer.byteLength(JSON.stringify(view)) > 2_000_000) throw new Error('View exceeds 2 MB');
    const revision = createHash('sha256').update(JSON.stringify(view)).digest('hex');
    this.state = { view, revision, observedAt: new Date().toISOString() };
    return { revision };
  }
  touch(expected: string) {
    if (!this.state || this.state.revision !== expected)
      throw new Error('Conflict: canvas state changed. Publish a fresh view.');
    this.state = { ...this.state, observedAt: new Date().toISOString() };
    return { revision: expected };
  }
  snapshot(includeDocument = false) {
    if (!this.state)
      return { available: false, reason: 'The panel has not reported its live state.' };
    const { view, ...meta } = this.state;
    const { document, ...ui } = view;
    return {
      available: true,
      ...meta,
      stale: Date.now() - Date.parse(meta.observedAt) > 15000,
      ...ui,
      visibleNodes: document.modules.filter((m) => m.parent === view.scope),
      counts: {
        nodes: document.modules.length,
        relationships: document.connections.length,
        annotations: document.annotations.length,
      },
      ...(includeDocument ? { document } : {}),
      command: this.command,
      proposalId: this.proposal?.id ?? null,
      capabilities: [
        'focus',
        'select',
        'fit',
        'fit_selection',
        'read',
        'panel',
        'navigation',
        'propose',
      ],
      visualInspection:
        'Use the connected browser DOM/screenshot tools for rendered pixels, hover, dialogs and accessibility.',
    };
  }
  private current(expected: string) {
    if (!this.state || Date.now() - Date.parse(this.state.observedAt) > 15000)
      throw new Error(
        'Live panel state is unavailable or stale. Open the panel and read a fresh snapshot.',
      );
    if (expected !== this.state.revision)
      throw new Error('Conflict: canvas state changed. Read a fresh snapshot.');
    return this.state.view;
  }
  enqueue(expected: string, input: CanvasCommand) {
    const view = this.current(expected),
      command = commandSchema.parse(input);
    const targets =
      command.action === 'focus'
        ? [command.target]
        : command.action === 'select'
          ? command.targets
          : [];
    if (targets.some((id) => !view.document.modules.some((m) => m.id === id)))
      throw new Error('Unknown target');
    if (
      command.action === 'select' &&
      targets.some((id) => view.document.modules.find((m) => m.id === id)?.parent !== view.scope)
    )
      throw new Error('Select nodes in the current scope; focus their parent first.');
    if (new Set(targets).size !== targets.length) throw new Error('Duplicate target');
    if (this.command?.status === 'pending')
      throw new Error('A command is still pending. Read its result before sending another.');
    this.command = { id: randomUUID(), expectedRevision: expected, command, status: 'pending' };
    return this.command;
  }
  acknowledge(id: unknown, status: unknown, message: unknown) {
    if (!this.command || this.command.id !== id || this.command.status !== 'pending')
      throw new Error('No matching pending command');
    if (status !== 'applied' && status !== 'rejected') throw new Error('Invalid command result');
    this.command = {
      ...this.command,
      status,
      message: typeof message === 'string' ? message.slice(0, 1000) : undefined,
    };
    return this.command;
  }
  propose(expected: string, value: unknown, explanation: string) {
    const view = this.current(expected);
    if (this.proposal) throw new Error('Review or dismiss the existing proposal first.');
    const document = parseDocument(value);
    if (Buffer.byteLength(JSON.stringify(document)) > 2_000_000)
      throw new Error('Proposal exceeds 2 MB');
    this.proposal = { id: randomUUID(), baseDocument: view.document, document, explanation };
    return { id: this.proposal.id, status: 'awaiting_review' };
  }
  dismiss(id: unknown) {
    if (this.proposal?.id !== id) throw new Error('Unknown proposal');
    this.proposal = null;
    return { dismissed: true };
  }
  inbox() {
    return { command: this.command, proposal: this.proposal };
  }
}
