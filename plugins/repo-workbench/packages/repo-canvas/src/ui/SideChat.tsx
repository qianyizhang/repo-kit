import { useEffect, useState, useRef, useImperativeHandle, type Ref } from 'react';
import { type Architecture, type ContextComment } from '../model/document';
import { ProposalReview } from './ProposalReview';
import type { Output } from '../model/contracts';
import { request } from './api';
import { discussionContext } from '../model/discussion-context';
import { initializationPrompt } from '../model/initialization';
import { hosted, requireMessaging, sendToChat } from './host';
export interface ChatActions {
  initialize: () => void;
  addComment: (comment: ContextComment) => boolean;
}
interface Props {
  actions?: Ref<ChatActions>;
  document: Architecture;
  scope: string;
  selection: string | null;
  selections: string[];
  token: string;
  apply: (document: Architecture) => void;
  close: () => void;
}
export function SideChat({
  document,
  scope,
  selection,
  selections,
  token,
  apply,
  close,
  actions,
}: Props) {
  const [data, setData] = useState<Output<'discussion_read'> | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [dismissed, setDismissed] = useState('');
  const [includeContext, setIncludeContext] = useState(false);
  const current = useRef(data);
  current.current = data;
  const dirty = useRef(false),
    queue = useRef<Promise<void>>(Promise.resolve()),
    sending = useRef(false);
  const context = document.modules.find((m) => m.id === (selection ?? scope));
  useEffect(() => {
    let active = true;
    async function refresh() {
      if (dirty.current || sending.current) return;
      try {
        const next = await request('discussion_read', token);
        if (active && !dirty.current && !sending.current) {
          current.current = next;
          setData(next);
        }
      } catch (e) {
        if (active) setError(String(e));
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token]);
  function persist(composer: string, comments: ContextComment[]) {
    if (!current.current) return;
    dirty.current = true;
    const optimistic = { ...current.current, composer, comments };
    current.current = optimistic;
    setData(optimistic);
    queue.current = queue.current
      .then(async () => {
        const latest = current.current;
        if (!latest) return;
        try {
          const saved = await request('discussion_write', token, {
            revision: latest.revision,
            composer,
            comments,
          });
          const now = current.current!;
          current.current = { ...saved, composer: now.composer, comments: now.comments };
          setData(current.current);
          if (
            now.composer === composer &&
            JSON.stringify(now.comments) === JSON.stringify(comments)
          )
            dirty.current = false;
        } catch (e) {
          setError(String(e));
          throw e;
        }
      })
      .catch(() => {});
  }
  const exchange = data?.history.at(-1),
    pending = exchange?.status === 'pending',
    proposal = exchange?.response?.proposal;
  async function send(text = data?.composer ?? '', attached = includeContext) {
    if (
      !hosted ||
      sending.current ||
      !data ||
      (pending && attached) ||
      (!text.trim() && !data.comments.length)
    )
      return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      await queue.current;
      if (dirty.current) throw new Error('Save the local draft before sending.');
      await requireMessaging();
      if (!attached) {
        if (!text.trim()) throw new Error('Enter a message or attach the selected notes.');
        await sendToChat(text.trim());
        persist('', current.current!.comments);
        await queue.current;
        return;
      }
      const next = await request('send', token, {
        canvasId: 'discussion',
        document,
        scope,
        selection,
        selections,
        messages: [
          { role: 'user', text: text.trim() || 'Please review the attached contextual comments.' },
        ],
        comments: current.current!.comments,
      });
      const saved = await request('discussion_read', token);
      current.current = saved;
      setData(saved);
      await sendToChat(
        next.context.messages.at(-1)!.text +
          '\n\nSelected canvas context (frozen data):\n' +
          JSON.stringify(discussionContext(next)) +
          '\nUse canvas_reply if a panel reply or proposal is needed. Additional map, comments and provenance are available through their scoped tools.',
      );
      setIncludeContext(false);
      persist('', []);
      await queue.current;
    } catch (e) {
      setError(
        String(e) + ' The local draft is retained. Delivery is never retried automatically.',
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  useImperativeHandle(actions, () => ({
    initialize: () => {
      if (current.current) {
        persist(initializationPrompt, current.current.comments);
        void send(initializationPrompt, true);
      }
    },
    addComment: (comment) => {
      if (!current.current) return false;
      setIncludeContext(true);
      persist(current.current.composer, [...current.current.comments, comment]);
      return true;
    },
  }));
  async function reload() {
    try {
      const next = await request('discussion_read', token);
      current.current = next;
      setData(next);
      dirty.current = false;
      setError('');
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <aside className="side-chat">
      <div className="panel-heading">
        <h2>Discuss</h2>
        <button aria-label="Close side chat" onClick={close}>
          ×
        </button>
      </div>
      <div className="context-chip">
        {selections.length > 1 ? `${selections.length} selected nodes` : context?.name}
        <label>
          <input
            type="checkbox"
            checked={includeContext}
            onChange={(e) => setIncludeContext(e.target.checked)}
          />{' '}
          Attach selection and notes
        </label>
      </div>
      {data && data.history.length > 1 && (
        <details className="chat-history">
          <summary>{data.history.length - 1} earlier exchanges</summary>
          {data.history
            .slice(0, -1)
            .toReversed()
            .map((e) => (
              <details key={e.id}>
                <summary>
                  {e.context.messages.at(-1)?.text.slice(0, 100)} · {e.status}
                </summary>
                <p>{e.context.messages.at(-1)?.text}</p>
                {e.context.comments?.map((c) => (
                  <p key={c.id}>
                    {c.label}: {c.instruction}
                  </p>
                ))}
                <p>{e.response?.reply}</p>
              </details>
            ))}
        </details>
      )}
      <div className="chat-log" aria-live="polite">
        {exchange && (
          <>
            <article className="message user">
              <b>CURRENT QUERY</b>
              <p>{exchange.context.messages.at(-1)?.text}</p>
              {exchange.context.comments?.map((c) => (
                <details key={c.id}>
                  <summary>{c.label}</summary>
                  <p>{c.instruction}</p>
                  <pre>{c.captured}</pre>
                </details>
              ))}
            </article>
            {exchange.response && (
              <article className="message assistant">
                <b>CODEX</b>
                <p>{exchange.response.reply}</p>
              </article>
            )}
            {exchange.status === 'cancelled' && <p>Request closed locally.</p>}
          </>
        )}
        {!exchange && (
          <p className="muted">
            Ask about this map, or right-click a node, relationship or note to attach a contextual
            comment.
          </p>
        )}
      </div>
      {pending && (
        <section className="proposal">
          <b>Awaiting the main chat</b>
          <p>Check the main chat if delivery is uncertain. This request will not be resent.</p>
          <button
            onClick={() =>
              void queue.current
                .then(() => {
                  if (dirty.current)
                    throw new Error('Save or reload the local draft before closing the request.');
                  return request('cancel', token, { canvasId: exchange.canvasId, id: exchange.id });
                })
                .then(reload)
                .catch((e) => setError(String(e)))
            }
          >
            Close request
          </button>
        </section>
      )}
      {proposal && exchange && dismissed !== exchange.id && (
        <ProposalReview
          current={document}
          proposal={{
            id: exchange.id,
            baseDocument: exchange.context.document,
            document: proposal,
          }}
          origin="discussion"
          intent={{
            question: exchange.context.messages.at(-1)?.text ?? '',
            comments: exchange.context.comments ?? [],
          }}
          explanation={exchange.response?.reply}
          apply={apply}
          dismiss={() => setDismissed(exchange.id)}
        />
      )}
      {error && (
        <div className="chat-error" role="alert">
          <p>{error}</p>
          <button
            onClick={() => {
              if (window.confirm('Reload the local discussion? Copy any unsaved text first.'))
                void reload();
            }}
          >
            Reload discussion
          </button>
          <button
            onClick={() => {
              const value = current.current;
              if (value) persist(value.composer, value.comments);
            }}
          >
            Retry local save
          </button>
        </div>
      )}
      {data && (
        <form
          className="chat-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {data.comments.map((c) => (
            <details className="queued-comment" key={c.id}>
              <summary>{c.label}</summary>
              <p>{c.instruction}</p>
              <small>
                Frozen in {c.scope} · {c.documentRevision.slice(0, 10)}
              </small>
              <pre>{c.captured}</pre>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  persist(
                    data.composer,
                    data.comments.filter((n) => n.id !== c.id),
                  )
                }
              >
                Remove comment
              </button>
            </details>
          ))}
          <textarea
            aria-label="Message Codex"
            rows={3}
            maxLength={12000}
            disabled={busy}
            placeholder={`Discuss ${context?.name ?? 'this map'}…`}
            value={data.composer}
            onChange={(e) => persist(e.target.value, data.comments)}
          />
          <footer>
            <button
              type="submit"
              className="primary"
              disabled={
                !hosted ||
                busy ||
                (pending && includeContext) ||
                (!data.composer.trim() && !data.comments.length)
              }
            >
              Send to chat ↑
            </button>
            <button
              type="button"
              disabled={pending || busy}
              onClick={() => {
                if (
                  window.confirm(
                    'Clear this repository/chat’s local discussion, draft and comment queue?',
                  )
                )
                  void queue.current
                    .then(() =>
                      request('discussion_clear', token, { revision: current.current!.revision }),
                    )
                    .then((next) => {
                      current.current = next;
                      setData(next);
                      dirty.current = false;
                    })
                    .catch((e) => setError(String(e)));
              }}
            >
              Clear history
            </button>
          </footer>
        </form>
      )}
      {!hosted && (
        <p className="muted">
          Local draft saved on this device. Open this repository in Codex’s Repo Canvas app to send
          to the main chat.
        </p>
      )}
    </aside>
  );
}
