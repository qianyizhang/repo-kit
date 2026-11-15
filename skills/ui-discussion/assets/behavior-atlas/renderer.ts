import { readIR, readFrame, type ViewOptions } from "./schema.ts";
import { layoutAtlas } from "./layout.ts";
import { compileLandscape } from "./landscape.ts";
export { escapeText } from "./landscape.ts";
/** One stable landscape for both the standalone workbench and app adapters. */
export function compileAtlas(input: unknown) {
  const ir = readIR(input),
    layout = layoutAtlas(ir),
    landscape = compileLandscape(ir, layout);
  return {
    ir,
    layout,
    landscape,
    render(value: unknown, options: ViewOptions = {}): string {
      return landscape.render(readFrame(ir, value), options);
    },
  };
}
export type Atlas = ReturnType<typeof compileAtlas>;
export function paintAtlas(
  root: HTMLElement,
  atlas: Atlas,
  frame: unknown,
  options: ViewOptions = {},
): boolean {
  root.classList.add("atlas-canvas");
  const previousState = root
    .querySelector("[data-current]")
    ?.getAttribute("data-current");
  const active = root.ownerDocument.activeElement;
  const focus =
    active instanceof Element && root.contains(active)
      ? (["data-atlas-action", "data-atlas-state"] as const)
          .map((key) => [key, active.getAttribute(key)] as const)
          .find(([, value]) => value)
      : undefined;
  try {
    root.innerHTML = atlas.render(frame, options);
    const currentNode = root.querySelector<HTMLElement | SVGElement>(
      '[aria-current="location"]',
    );
    if (
      root.scrollWidth > root.clientWidth &&
      previousState !==
        root.querySelector("[data-current]")?.getAttribute("data-current") &&
      currentNode
    ) {
      const dot = (
        currentNode.querySelector(".landmark-dot") ?? currentNode
      ).getBoundingClientRect();
      root.scrollLeft +=
        dot.x +
        dot.width / 2 -
        root.getBoundingClientRect().x -
        root.clientWidth / 2;
    }
    if (focus)
      (
        root.querySelector<HTMLElement>(`[${focus[0]}="${focus[1]}"]`) ??
        root.querySelector<HTMLElement>('[aria-current="location"]')
      )?.focus({ preventScroll: true });
    return true;
  } catch (error) {
    const message = root.ownerDocument.createElement("p");
    message.className = "atlas-error";
    message.setAttribute("role", "alert");
    message.textContent = `Map unavailable: ${error instanceof Error ? error.message : String(error)}`;
    message.tabIndex = -1;
    root.replaceChildren(message);
    if (focus) message.focus({ preventScroll: true });
    return false;
  }
}
export function connectAtlas(
  root: HTMLElement,
  handlers: {
    state: (id: string) => void;
    action: (id: string) => void;
  },
): () => void {
  const activate = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return;
    const control = target.closest<SVGElement>(
      "[data-atlas-action],[data-atlas-state]",
    );
    if (!control || !root.contains(control)) return;
    if (control.dataset.atlasAction)
      handlers.action(control.dataset.atlasAction);
    else if (control.dataset.atlasState)
      handlers.state(control.dataset.atlasState);
  };
  const click = (event: MouseEvent) => activate(event.target);
  const key = (event: KeyboardEvent) => {
    if (
      (event.key === "Enter" || event.key === " ") &&
      event.target instanceof SVGElement &&
      event.target.getAttribute("role") === "button"
    ) {
      event.preventDefault();
      activate(event.target);
    }
  };
  const visibility = () => {
    root.dataset.visibility = root.ownerDocument.hidden ? "hidden" : "visible";
  };
  visibility();
  root.addEventListener("click", click);
  root.addEventListener("keydown", key);
  root.ownerDocument.addEventListener("visibilitychange", visibility);
  return () => {
    root.removeEventListener("click", click);
    root.removeEventListener("keydown", key);
    root.ownerDocument.removeEventListener("visibilitychange", visibility);
    delete root.dataset.visibility;
  };
}
