import { rootOf, type Architecture, type Module, type Target } from './document';

export interface DraftView {
  scope: string;
  selection: string | null;
  selections: string[];
}
export interface DraftState extends DraftView {
  repo: string | null;
  document: Architecture | null;
  history: Architecture[];
  dirty: boolean;
  sourceSaveNotice: string;
}
export const initialDraft: DraftState = {
  repo: null,
  document: null,
  scope: 'repo',
  selection: null,
  selections: [],
  history: [],
  dirty: false,
  sourceSaveNotice: '',
};
export type SourceSaved = (target: Target, previous: string, reference: string) => void;
type Action =
  | { type: 'load'; repo: string; document: Architecture; view?: DraftView; dirty?: boolean }
  | { type: 'refresh' | 'edit'; document: Architecture }
  | { type: 'saved'; document: Architecture; expected: Architecture }
  | { type: 'sourceSaved'; repo: string; target: Target; previous: string; reference: string }
  | { type: 'dismissSourceSave' }
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

export function moduleSourceFields(document: Architecture, module: Module) {
  return (
    document.nodeTypes
      ?.find((type) => type.id === module.typeId)
      ?.fields.filter((field) => field.kind === 'source') ?? []
  );
}

function replaceSourceReference(
  document: Architecture,
  target: Target,
  previous: string,
  reference: string,
): Architecture | undefined {
  const replace = (value: string) => (value === previous ? reference : value);
  if (target.kind === 'node') {
    const module = document.modules.find((module) => module.id === target.id);
    if (!module) return;
    const fieldIds = moduleSourceFields(document, module)
      .map((field) => field.id)
      .filter((id) => module.fields?.[id] === previous);
    if (!module.sources.includes(previous) && fieldIds.length === 0) return;
    const next = { ...module, sources: module.sources.map(replace) };
    if (fieldIds.length) {
      next.fields = { ...module.fields };
      for (const id of fieldIds) next.fields[id] = reference;
    }
    return {
      ...document,
      modules: document.modules.map((item) => (item === module ? next : item)),
    };
  }
  if (target.kind === 'connection') {
    const connection = document.connections.find((connection) => connection.id === target.id);
    if (!connection?.sources?.includes(previous)) return;
    const next = { ...connection, sources: connection.sources.map(replace) };
    return {
      ...document,
      connections: document.connections.map((item) => (item === connection ? next : item)),
    };
  }
}

/** All document/navigation transitions cross this seam, including human and agent actions. */
export function transitionDraft(state: DraftState, action: Action): DraftState {
  if (action.type === 'load') {
    return {
      repo: action.repo,
      document: action.document,
      ...validView(
        action.document,
        action.view ?? { scope: rootOf(action.document).id, selection: null, selections: [] },
      ),
      history: [],
      dirty: action.dirty ?? false,
      sourceSaveNotice: '',
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
    case 'sourceSaved': {
      if (state.repo !== action.repo) return state;
      const { target, previous, reference } = action;
      const saved = `Source file saved at ${reference}.`;
      if (previous === reference) return { ...state, sourceSaveNotice: saved };
      const next = replaceSourceReference(document, target, previous, reference);
      return next
        ? {
            ...transitionDraft(state, { type: 'edit', document: next }),
            sourceSaveNotice: `${saved} The new range is in the map draft.`,
          }
        : {
            ...state,
            sourceSaveNotice: `${saved} Map reference unchanged because the original reference is no longer on that object.`,
          };
    }
    case 'dismissSourceSave':
      return { ...state, sourceSaveNotice: '' };
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
