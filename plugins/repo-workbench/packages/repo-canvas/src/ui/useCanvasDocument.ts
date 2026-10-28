import { poll } from '../../../../../mcp-app-runtime/src/poller.ts';
import { useCallback, useEffect, useRef, useState, useReducer } from 'react';
import { parseDocument, type Architecture } from '../model/document';
import { initialDraft, transitionDraft } from '../model/draft';
import { draftSchema } from '../model/contracts';
import { request, type Session } from './api';
import { hosted, prepareHost, rememberRepository, connectionStatus } from './host';

/** Owns draft recovery, revision conflicts, save, history, and valid document navigation. */
export function useCanvasDocument() {
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [needsRepository, setNeedsRepository] = useState(false);
  const [lookupReason, setLookupReason] = useState<string>();
  const [retryingConnection, setRetryingConnection] = useState(false);
  const [connectionCheckedAt, setConnectionCheckedAt] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [draft, dispatch] = useReducer(transitionDraft, initialDraft);
  const { document, scope, selection, selections, history, dirty } = draft;
  const [conflict, setConflict] = useState(false),
    [saving, setSaving] = useState(false);
  const documentRef = useRef(document);
  documentRef.current = document;
  const state = useRef({ dirty, revision: session?.revision });
  state.current = { dirty, revision: session?.revision };
  const loadGeneration = useRef(0);
  const load = useCallback(async (recover = false, signal?: AbortSignal) => {
    if (signal?.aborted) return;
    const generation = ++loadGeneration.current;
    const stale = () => signal?.aborted || generation !== loadGeneration.current;
    try {
      const ready = !hosted || (await prepareHost());
      if (stale()) return;
      if (!ready) {
        setLookupReason(connectionStatus().reason ?? undefined);
        setNeedsRepository(true);
        setError('');
        return;
      }
      const data = await request('state', undefined);
      if (stale()) return;
      if ('needsRepository' in data) {
        setNeedsRepository(true);
        return;
      }
      data.document = parseDocument(data.document);
      if (hosted)
        void rememberRepository().catch(() => {
          if (!stale())
            setNotice('Opened this repository, but could not remember it on this device.');
        });
      if (recover && !data.problem) {
        try {
          const transferred = hosted ? await request('draft_read', data.token) : null;
          if (stale()) return;
          const raw = transferred
            ? JSON.stringify(transferred)
            : sessionStorage.getItem(`repo-canvas:draft:${data.repo}`);
          if (raw) {
            const draft = draftSchema.parse(JSON.parse(raw) as unknown);
            const restored = parseDocument(draft.document);
            if (
              typeof draft.revision === 'string' &&
              JSON.stringify(restored) !== JSON.stringify(data.document)
            ) {
              setSession({ ...data, revision: draft.revision });
              dispatch({
                type: 'load',
                document: restored,
                view: {
                  scope: draft.scope,
                  selection: draft.selection,
                  selections: draft.selections ?? (draft.selection ? [draft.selection] : []),
                },
                dirty: true,
              });
              setConflict(data.revision !== draft.revision);
              setNotice('Restored your unsaved draft in this tab.');
              setNeedsRepository(false);
              return;
            }
          }
        } catch {
          /* A corrupt cache must not prevent loading the authoritative map. */
        }
      }
      if (stale()) return;
      setSession(data);
      dispatch({ type: 'load', document: data.document });
      setConflict(false);
      setError('');
      setNeedsRepository(false);
    } catch (error) {
      if (stale()) return;
      setError(String(error));
      if (signal) throw error;
    }
  }, []);
  useEffect(() => {
    void load(true);
    const selected = () => {
      void load(true);
    };
    window.addEventListener('repo-canvas-target', selected);
    return () => {
      loadGeneration.current++;
      window.removeEventListener('repo-canvas-target', selected);
    };
  }, [load]);
  useEffect(() => {
    if (!hosted || !needsRepository) return;
    return poll((signal) => load(true, signal), { interval: 5000, immediate: false });
  }, [needsRepository, load]);
  async function retryConnection() {
    setRetryingConnection(true);
    await load(true);
    setConnectionCheckedAt(new Date().toLocaleTimeString());
    setRetryingConnection(false);
  }
  useEffect(() => {
    if (!session || !document) return;
    try {
      const key = `repo-canvas:draft:${session.repo}`;
      if (dirty)
        sessionStorage.setItem(
          key,
          JSON.stringify({ document, revision: session.revision, scope, selection, selections }),
        );
      else sessionStorage.removeItem(key);
    } catch {
      /* Persistence still works when browser storage is unavailable. */
    }
  }, [session, document, dirty, scope, selection, selections]);
  useEffect(() => {
    if (!session || !document) return;
    const timer = setTimeout(
      () => {
        void request('draft_write', session.token, {
          draft: dirty
            ? { document, revision: session.revision, scope, selection, selections }
            : null,
        }).catch(() => {
          /* Local draft remains intact if the bridge disconnects. */
        });
      },
      dirty ? 350 : 0,
    );
    return () => clearTimeout(timer);
  }, [session, document, dirty, scope, selection, selections]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (state.current.dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  useEffect(() => {
    const stop = poll(
      async (signal) => {
        const revision = state.current.revision;
        if (!revision) return;
        await request('state', undefined)
          .then((data) => {
            if (signal.aborted) return;
            if ('needsRepository' in data) return;
            setError('');
            setSession((previous) =>
              previous && previous.token !== data.token
                ? { ...previous, token: data.token, plugin: data.plugin }
                : previous,
            );
            if (revision !== state.current.revision) return;
            if (!state.current.revision || data.revision === state.current.revision) return;
            if (state.current.dirty) {
              setConflict(true);
              return;
            }
            data.document = parseDocument(data.document);
            setSession(data);
            dispatch({ type: 'refresh', document: data.document });
            setConflict(false);
            setNotice('Updated from the shared repo document.');
          })
          .catch((error: unknown) => {
            if (!signal.aborted) setError(String(error));
            throw error;
          });
      },
      { interval: 3000, immediate: false },
    );
    return stop;
  }, []);
  function edit(next: Architecture) {
    dispatch({ type: 'edit', document: next });
    setNotice('');
  }
  async function save() {
    if (!session || !document) return;
    setSaving(true);
    setError('');
    try {
      const snapshot = await request('save', session.token, {
        document: parseDocument(document),
        revision: session.revision,
      });
      state.current.revision = snapshot.revision;
      setSession({ ...session, ...snapshot });
      if (documentRef.current === document) {
        dispatch({ type: 'saved', document: snapshot.document, expected: document });
      }
      setConflict(false);
      setNotice('Saved to .repo-canvas/architecture.json');
    } catch (error) {
      setError(String(error));
    } finally {
      setSaving(false);
    }
  }
  return {
    startFresh: () => {
      if (session) {
        setSession({ ...session, problem: undefined, saved: false });
        dispatch({ type: 'startFresh' });
        setNotice('New v3 draft. The existing file is untouched until Save map.');
      }
    },
    session,
    document,
    scope,
    enter: (id: string) => dispatch({ type: 'enter', id }),
    locate: (id: string) => dispatch({ type: 'locate', id }),
    selection,
    select: (id: string | null, additive = false) => dispatch({ type: 'select', id, additive }),
    selections,
    selectMany: (ids: string[]) => dispatch({ type: 'selectMany', ids }),
    needsRepository,
    lookupReason,
    retryingConnection,
    connectionCheckedAt,
    retryConnection,
    dirty,
    conflict,
    saving,
    canUndo: history.length > 0,
    undo: () => dispatch({ type: 'undo' }),
    error,
    setError,
    notice,
    setNotice,
    load,
    edit,
    save,
  };
}
