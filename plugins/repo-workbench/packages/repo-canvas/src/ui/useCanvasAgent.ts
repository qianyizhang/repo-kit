import { useEffect, useRef, useState } from 'react';
import type { CanvasCommand, CanvasView, CanvasProposal } from '../model/session';
import { parseDocument } from '../model/document';
import { request } from './api';

/** One serialized channel for observations, command receipts and reviewed proposals. */
export function useCanvasAgent(
  view: CanvasView | null,
  token: string | undefined,
  execute: (command: CanvasCommand, id: string) => void,
) {
  const current = useRef({ view, execute });
  current.current = { view, execute };
  const [proposal, setProposal] = useState<CanvasProposal | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!token) return;
    let active = true,
      busy = false;
    let published = '',
      revision = '';
    let lastPublished = 0;
    let receipt: { id: string; status: 'applied' | 'rejected'; message: string } | null = null;
    async function tick() {
      if (busy || !active || !current.current.view) return;
      busy = true;
      try {
        // Read commands before publishing a newer UI state: reject work based on an old view.
        const inbox = await request('agent_read', token);
        if (!active) return;
        setProposal(inbox.proposal);
        const queued = inbox.command;
        if (queued?.status === 'pending') {
          if (receipt?.id !== queued.id) {
            const fresh =
              queued.expectedRevision === revision &&
              published === JSON.stringify(current.current.view);
            receipt = {
              id: queued.id,
              status: 'rejected',
              message: 'The panel changed before this command arrived. Read a fresh snapshot.',
            };
            if (fresh) {
              try {
                current.current.execute(queued.command, queued.id);
                receipt = { id: queued.id, status: 'applied', message: 'View command applied.' };
              } catch (error) {
                receipt.message = String(error);
              }
            }
          }
          // Retry a lost acknowledgment without executing the command twice.
          await request('command_ack', token, receipt);
        }
        receipt = null;
        const next = current.current.view;
        if (!next) return;
        const sent = JSON.stringify(next);
        if (published === sent && Date.now() - lastPublished < 5000) return;
        const result = await request('view_write', token, {
          view: { ...next, document: parseDocument(next.document) },
        });
        published = sent;
        revision = result.revision;
        lastPublished = Date.now();
        if (active) setError('');
      } catch (error) {
        if (active) setError(String(error));
      } finally {
        busy = false;
      }
    }
    void tick();
    const timer = setInterval(() => void tick(), 750);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token]);
  async function dismiss() {
    if (!proposal) return;
    try {
      await request('proposal_dismiss', token, { id: proposal.id });
      setProposal(null);
    } catch (error) {
      setError(String(error));
    }
  }
  return { proposal, dismiss, error };
}
