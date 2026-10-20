import { useEffect, useState } from 'react';
import { parseDocument, type Architecture, type ChatMessage } from '../model/document';
import type { CanvasExchange } from '../model/bridge';
import { request } from './api';
import { hosted, requireMessaging, sendToChat } from './host';

interface Props {
  document: Architecture;
  scope: string;
  selection: string | null;
  token: string;
  apply: (document: Architecture) => void;
  close: () => void;
}
export function SideChat({ document, scope, selection, token, apply, close }: Props) {
  const [canvasId] = useState(() => {
    const key = 'repo-canvas:chat-tab';
    try {
      const id = sessionStorage.getItem(key) ?? crypto.randomUUID();
      sessionStorage.setItem(key, id);
      return id;
    } catch {
      return crypto.randomUUID();
    }
  });
  const [exchange, setExchange] = useState<CanvasExchange | null>(null),
    [input, setInput] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [dismissed, setDismissed] = useState('');
  const context = document.modules.find((m) => m.id === (selection ?? scope))!;
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const result = await request<CanvasExchange | null>('chat', token, { canvasId });
        if (active) setExchange(result);
      } catch (error) {
        if (active) setError(String(error));
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [canvasId, token]);
  const messages: ChatMessage[] = exchange
    ? [
        ...exchange.context.messages,
        ...(exchange.response
          ? [{ role: 'assistant' as const, text: exchange.response.reply }]
          : []),
      ]
    : [];
  const pending = exchange?.status === 'pending';
  const proposal = exchange?.response?.proposal;
  let stale = false;
  if (exchange) {
    try {
      // Compare validated values in schema order, not UI object insertion order.
      stale = JSON.stringify(exchange.context.document) !== JSON.stringify(parseDocument(document));
    } catch {
      // An incomplete source-path edit must still block applying an older proposal.
      stale = true;
    }
  }
  async function send() {
    if (!hosted || !input.trim() || busy || pending) return;
    setBusy(true);
    setError('');
    try {
      await requireMessaging();
      const next = await request<CanvasExchange>('send', token, {
        canvasId,
        document,
        scope,
        selection,
        messages: [...messages, { role: 'user', text: input.trim() }].slice(-30),
      });
      setExchange(next);
      setInput('');
      await sendToChat(
        `Use Repo Canvas in this conversation. Read request ${next.id} with canvas_read, then answer with canvas_reply, including any proposed map changes. Preserve unrelated notes and layout. My request: ${next.context.messages.at(-1)!.text}`,
      );
    } catch (error) {
      setError(String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="side-chat">
      <div className="panel-heading">
        <h2>Side chat</h2>
        <button aria-label="Close side chat" onClick={close}>
          ×
        </button>
      </div>
      <p className="muted">Discuss the selection. Review proposals before saving.</p>
      <div className="context-chip">
        {context.name}
        <span>Selection and current draft included</span>
      </div>
      <div className="chat-log" aria-live="polite">
        {!exchange && (
          <div className="chat-welcome">
            <p>Ask about responsibilities, sources or a proposed change.</p>
            <details className="discussion-prompts">
              <summary>Suggested questions</summary>
              <button
                onClick={() =>
                  setInput(
                    'Explain the selected module using source evidence. Where does its responsibility begin and end?',
                  )
                }
              >
                Explain this module ↗
              </button>
              <button
                onClick={() =>
                  setInput(
                    'Inspect this repository and propose a semantic architecture map with responsibilities and dependency relationships. Preserve existing notes and layout.',
                  )
                }
              >
                Propose an architecture map ↗
              </button>
            </details>
          </div>
        )}
        {messages.map((m, i) => (
          <article key={i} className={`message ${m.role}`}>
            <b>{m.role === 'user' ? 'YOU' : 'CODEX · MCP REPLY'}</b>
            <p>{m.text}</p>
          </article>
        ))}
        {exchange?.status === 'cancelled' && <p className="muted">Request cancelled.</p>}
      </div>
      {pending && (
        <div className="proposal">
          <b>{error ? 'Message delivery needs attention' : 'Waiting for this conversation'}</b>
          <p>
            {error
              ? 'Check the main chat before sending again. The request has not been retried.'
              : 'The request is linked to the main chat. Closing it here does not stop the chat.'}
          </p>
          <button
            onClick={() => {
              void request<CanvasExchange>('cancel', token, {
                canvasId,
                id: exchange.id,
              })
                .then(setExchange)
                .catch((e: unknown) => setError(String(e)));
            }}
          >
            Close request
          </button>
        </div>
      )}
      {proposal && dismissed !== exchange.id && (
        <div className="proposal">
          <b>Proposed map change</b>
          <p>
            {proposal.modules.length} modules · {proposal.connections.length} relationships ·{' '}
            {proposal.annotations.length} notes
          </p>
          <details>
            <summary>Review proposed document</summary>
            <pre>{JSON.stringify(proposal, null, 2)}</pre>
          </details>
          {stale && <p>The map changed after this request. Ask again with the current map.</p>}
          <button
            className="primary"
            disabled={stale}
            onClick={() => {
              apply(proposal);
              setDismissed(exchange.id);
            }}
          >
            Apply to draft
          </button>
          <button onClick={() => setDismissed(exchange.id)}>Dismiss</button>
        </div>
      )}
      {error && (
        <div className="chat-error" role="alert">
          <p>{error.replace(/^Error: /, '').slice(0, 600)}</p>
          <button onClick={() => setError('')}>Dismiss error</button>
        </div>
      )}
      {!hosted && (
        <p className="muted" role="status">
          Open Repo Canvas from Codex’s apps menu to use side chat. This browser preview only edits
          the map.
        </p>
      )}
      <form
        className="chat-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          aria-label="Message Codex"
          maxLength={12000}
          placeholder={`Discuss ${context.name}…`}
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <footer>
          <button
            className="primary"
            disabled={!hosted || !input.trim() || busy || pending}
            type="submit"
          >
            Send to chat ↑
          </button>
        </footer>
      </form>
    </aside>
  );
}
