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
  const load = useCallback(async (recover = false) => {
    try {
      if (hosted && !(await prepareHost())) {
        setLookupReason(connectionStatus().reason ?? undefined);
        setNeedsRepository(true);
        setError('');
        return;
      }
      const data = await request('state', undefined);
      if ('needsRepository' in data) {
        setNeedsRepository(true);
        return;
      }
      setNeedsRepository(false);
      data.document = parseDocument(data.document);
      if (hosted)
        void rememberRepository().catch(() => {
          setNotice('Opened this repository, but could not remember it on this device.');
        });
      if (recover && !data.problem) {
        try {
          const transferred = hosted ? await request('draft_read', data.token) : null;
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
              return;
            }
          }
        } catch {
          /* A corrupt cache must not prevent loading the authoritative map. */
        }
      }
      setSession(data);
      dispatch({ type: 'load', document: data.document });
      setConflict(false);
      setError('');
    } catch (error) {
      setError(String(error));
    }
  }, []);
  useEffect(() => {
    void load(true);
    const selected = () => {
      void load(true);
    };
    window.addEventListener('repo-canvas-target', selected);
    return () => window.removeEventListener('repo-canvas-target', selected);
  }, [load]);
  useEffect(() => {
    if (!hosted || !needsRepository) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      if (window.document.visibilityState !== 'hidden') await load(true);
      if (!cancelled) timer = setTimeout(() => void check(), 5000);
    };
    timer = setTimeout(() => void check(), 5000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
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
    const timer = setInterval(() => {
      const revision = state.current.revision;
      if (!revision) return;
      void request('state', undefined)
        .then((data) => {
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
        .catch((error: unknown) => setError(String(error)));
    }, 3000);
    return () => clearInterval(timer);
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
