import type {
  Region,
  StateNode,
  ScreenBlock,
  ScreenField,
  Transition,
} from "./schema.ts";
import { escapeText } from "./landscape.ts";
export interface ActionOption {
  edge: Transition;
  enabled: boolean;
  reason: string;
  destination: string;
}
export function renderActions(options: ActionOption[], side?: 0 | 1): string {
  if (!options.length) return "";
  return `<div class="work-actions">${options.map(({ edge, enabled, reason, destination }) => `<button data-take="${edge.id}" ${side === undefined ? "" : `data-side="${side}"`} ${enabled ? "" : "disabled"} class="${edge.kind === "system" ? "system" : ""}" ${reason ? `title="${escapeText(reason)}"` : ""}><span>${edge.kind === "system" ? "◇ " : ""}${escapeText(edge.label)}</span><small>${reason && edge.guard ? escapeText(reason) : `→ ${escapeText(destination)}`}</small></button>`).join("")}</div>`;
}
/** Fixed, text-only screen fixtures. All enabled actions come from the controller. */
export function renderApp(
  state: StateNode,
  region: Region,
  options: ActionOption[],
  passive = false,
  side?: 0 | 1,
): string {
  const p = state.preview,
    e = escapeText;
  const fields = (items: ScreenField[]) =>
    items.length
      ? `<dl>${items.map((f) => `<div><dt>${e(f.label)}</dt><dd>${e(f.value)}</dd></div>`).join("")}</dl>`
      : "";
  const placed = new Set<string>();
  const blocks = (items: ScreenBlock[], interactive: boolean) =>
    items
      .map((b) => {
        switch (b.kind) {
          case "heading":
            return `<h3>${e(b.text)}</h3>`;
          case "text":
            return `<p class="fixture-body">${e(b.text)}</p>`;
          case "fields":
            return fields(b.fields);
          case "notice":
            return `<p class="fixture-notice tone-${b.tone}">${e(b.text)}</p>`;
          case "actions":
            if (!interactive) return "";
            b.transitions.forEach((id) => placed.add(id));
            return renderActions(
              b.transitions.flatMap((id) =>
                options.filter((o) => o.edge.id === id),
              ),
              side,
            );
        }
      })
      .join("");
  if (passive)
    return `<div class="app-window app-summary" data-app-state="${state.id}"><div class="app-chrome">${e(region.label)}</div><div class="app-content"><p class="eyebrow">${e(state.label)}</p><h2>${e(p?.overlay?.title ?? p?.title ?? state.label)}</h2><p class="fixture-body">${e(p?.overlay?.body || p?.body || state.detail || "No screen fixture supplied.")}</p></div></div>`;
  const background = `<h2>${e(p?.title ?? state.label)}</h2>${p?.body ? `<p class="fixture-body">${e(p.body)}</p>` : ""}${fields(p?.fields ?? [])}${blocks(p?.blocks ?? [], !p?.overlay)}`;
  const overlay = p?.overlay;
  const content = overlay
    ? `<div class="fixture-underlay" inert aria-hidden="true">${background}</div><div class="fixture-shade"></div><section class="fixture-overlay" role="dialog" aria-label="${e(overlay.title)}"><h2>${e(overlay.title)}</h2>${overlay.body ? `<p>${e(overlay.body)}</p>` : ""}${blocks(overlay.blocks, true)}${renderActions(
        options.filter((o) => !placed.has(o.edge.id)),
        side,
      )}</section>`
    : `${background}${renderActions(
        options.filter((o) => !placed.has(o.edge.id)),
        side,
      )}`;
  return `<div class="app-window" data-app-state="${state.id}"><div class="app-chrome"><span aria-hidden="true">● ● ●</span><span>${e(region.label)}</span><small>Fixed fixture</small></div><div class="app-content ${overlay ? "has-overlay" : ""}">${content}</div></div>`;
}
