import { rootOf, type Architecture } from './document';

export interface DraftView {
  scope: string;
  selection: string | null;
  selections: string[];
}
export interface DraftState extends DraftView {
  document: Architecture | null;
  history: Architecture[];
  dirty: boolean;
}
export const initialDraft: DraftState = {
  document: null,
  scope: 'repo',
  selection: null,
  selections: [],
  history: [],
  dirty: false,
};
type Action =
  | { type: 'load'; document: Architecture; view?: DraftView; dirty?: boolean }
  | { type: 'refresh' | 'edit'; document: Architecture }
  | { type: 'saved'; document: Architecture; expected: Architecture }
  | { type: 'undo' | 'startFresh' }
  | { type: 'enter' | 'locate'; id: string }
  | { type: 'select'; id: string | null; additive?: boolean }
  | { type: 'selectMany'; ids: string[] };

/** Keep inspected nodes distinct from the selected children in the current scope. */
function validView(document: Architecture, view: DraftView): DraftView {
  const scope = document.modules.some((m) => m.id === view.scope)
    ? view.scope
    : rootOf(document).id;
  return {
    scope,
    selection: document.modules.some((m) => m.id === view.selection) ? view.selection : null,
    selections: [...new Set(view.selections)].filter((id) =>
      document.modules.some((m) => m.id === id && m.parent === scope),
    ),
  };
}

/** All document/navigation transitions cross this seam, including human and agent actions. */
export function transitionDraft(state: DraftState, action: Action): DraftState {
  if (action.type === 'load') {
    return {
      document: action.document,
      ...validView(
        action.document,
        action.view ?? { scope: rootOf(action.document).id, selection: null, selections: [] },
      ),
      history: [],
      dirty: action.dirty ?? false,
    };
  }
  const document = state.document;
  if (!document) return state;
  switch (action.type) {
    case 'refresh':
      return {
        ...state,
        document: action.document,
        ...validView(action.document, state),
        history: [],
        dirty: false,
      };
    case 'edit':
      return {
        ...state,
        document: action.document,
        ...validView(action.document, state),
        history: [...state.history.slice(-39), document],
        dirty: true,
      };
    case 'undo': {
      const previous = state.history.at(-1);
      return previous
        ? {
            ...state,
            document: previous,
            ...validView(previous, state),
            history: state.history.slice(0, -1),
            dirty: true,
          }
        : state;
    }
    case 'saved':
      return document === action.expected
        ? {
            ...state,
            document: action.document,
            ...validView(action.document, state),
            dirty: false,
          }
        : state;
    case 'startFresh':
      return { ...state, dirty: true };
    case 'enter':
      return document.modules.some((m) => m.id === action.id)
        ? { ...state, scope: action.id, selection: null, selections: [] }
        : state;
    case 'locate': {
      const node = document.modules.find((m) => m.id === action.id);
      return node
        ? {
            ...state,
            ...validView(document, {
              scope: node.parent ?? node.id,
              selection: node.id,
              selections: [node.id],
            }),
          }
        : state;
    }
    case 'select': {
      if (action.id !== null && !document.modules.some((m) => m.id === action.id)) return state;
      const ids =
        action.id === null
          ? []
          : action.additive
            ? state.selections.includes(action.id)
              ? state.selections.filter((id) => id !== action.id)
              : [...state.selections, action.id]
            : [action.id];
      return {
        ...state,
        ...validView(document, { ...state, selection: ids.at(-1) ?? null, selections: ids }),
      };
    }
    case 'selectMany': {
      const view = validView(document, { ...state, selections: action.ids });
      return { ...state, ...view, selection: view.selections.at(-1) ?? null };
    }
  }
}
