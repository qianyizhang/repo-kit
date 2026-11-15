import { renderApp, renderActions } from "./screen.ts";
import { compileAtlas, escapeText } from "./renderer.ts";
import {
  Workbench,
  alignVisits,
  visitsFor,
  type Operation,
  type MajorView,
} from "./workbench.ts";
import type { Frame, Journey } from "./schema.ts";

// An optional preview override; normal use follows the system appearance.
if (new URLSearchParams(location.search).get("appearance") === "light")
  document.documentElement.dataset.appearance = "light";
const root = document.getElementById("atlas-root")!;
try {
  const atlas = compileAtlas(
    JSON.parse(document.getElementById("atlas-data")!.textContent!),
  );
  const work = new Workbench(atlas.ir),
    e = escapeText;
  const stateLabel = (id: string) =>
    atlas.ir.states.find((s) => s.id === id)!.label;
  let allNames = true;
  let chooser = false;
  let motion = true,
    notice = "",
    inspection: string | undefined,
    pinned = false,
    builder = false,
    manualCopy = "";
  let routeStart = atlas.ir.initial,
    routeEnd =
      atlas.ir.states.find((s) => s.outcome || s.terminal)?.id ??
      atlas.ir.states.at(-1)!.id,
    routeName = "Custom journey";
  const storageKey = `behavior-atlas:${atlas.ir.title}:${atlas.ir.source.revision}`;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) work.restoreSaved(saved);
  } catch {
    notice =
      "Saved journeys could not be loaded for this model. The authored journeys remain available.";
  }
  const persist = () => {
    try {
      localStorage.setItem(storageKey, work.exportSaved());
      notice = "Journey saved on this device.";
    } catch {
      notice =
        "Journey kept for this session. Device storage is unavailable; export the review to keep it.";
    }
  };
  const optionList = (selected: string) =>
    atlas.ir.states
      .map(
        (s) =>
          `<option value="${s.id}" ${s.id === selected ? "selected" : ""}>${e(s.label)}</option>`,
      )
      .join("");
  const proposals = new Set(atlas.ir.comparisons?.map((c) => c.after) ?? []);
  function actions(side?: 0 | 1): string {
    return (
      renderActions(work.options(side), side) ||
      '<p class="quiet">End of this route.</p>'
    );
  }
  function app(frame: Frame, passive = false, side?: 0 | 1): string {
    const state = atlas.ir.states.find((s) => s.id === frame.current)!;
    return renderApp(
      state,
      atlas.ir.regions.find((r) => r.id === state.region)!,
      work.options(side),
      passive,
      side,
    );
  }
  function nameToggle(): string {
    return `<button data-command="names" aria-label="Show all state names" aria-pressed="${allNames}" aria-keyshortcuts="N">Names <b>${allNames ? "All" : "Current + next"}</b> <kbd>N</kbd></button>`;
  }
  function toggleNames(): void {
    allNames = !allNames;
    root
      .querySelectorAll<SVGElement>(".landscape")
      .forEach((el) => (el.dataset.names = allNames ? "all" : "nearby"));
    root
      .querySelectorAll<HTMLElement>('[data-command="names"]')
      .forEach((el) => {
        el.setAttribute("aria-pressed", String(allNames));
        el.innerHTML = `Names <b>${allNames ? "All" : "Current + next"}</b> <kbd>N</kbd>`;
      });
  }
  function map(frame: Frame, passive = false, side?: 0 | 1): string {
    const prefix =
      side === undefined ? (passive ? "companion" : "main") : `compare-${side}`;
    return `<div class="map-shell ${passive ? "passive-map" : ""}" data-map-side="${side ?? "main"}"><div class="landscape-scroll">${atlas.render(frame, { compact: passive, passive, motion, names: allNames ? "all" : "nearby", idPrefix: prefix })}</div>${passive ? `<div class="map-location"><small>YOU ARE HERE</small><b>${e(stateLabel(frame.current))}</b><span>${e(atlas.ir.regions.find((r) => r.id === atlas.ir.states.find((s) => s.id === frame.current)!.region)!.label)}</span></div><p class="next-summary">${frame.available.length ? `Next: ${frame.available.map((x) => e(stateLabel(x.to))).join(" · ")}` : work.mode === "exploration" ? (work.paused ? "Outcome reached" : "No available transition") : frame.ended ? "End of this replay" : "Next step needs its condition checked"}</p>` : `<div class="map-legend"><span>● Current</span><span class="green">⇢ Available next</span><span class="purple">— Route</span><span>◎ Outcome</span></div><div class="inspection-slot" aria-live="polite"><span>Inspect a landmark; highlighted destinations follow an available action.</span></div>${actions(side)}`}</div>`;
  }
  function timeline(j: Journey, cursor: number): string {
    return `<div class="journey-timeline" aria-label="Recorded journey steps">${visitsFor(
      atlas.ir,
      j,
    )
      .map(
        (id, i) =>
          `<button data-scrub="${i}" aria-current="${i === cursor ? "step" : "false"}"><span class="step-dot">${i + 1}</span><span>${e(stateLabel(id))}<small>${i ? e(work.edge(j.steps[i - 1]!).label) : "Start"}</small></span></button>`,
      )
      .join('<span class="step-connector" aria-hidden="true">→</span>')}</div>`;
  }
  function metro(): string {
    const c = work.comparison(),
      a = visitsFor(atlas.ir, work.journey(c.before)),
      b = visitsFor(atlas.ir, work.journey(c.after)),
      columns = alignVisits(a, b);
    const width = Math.max(700, columns.length * 145),
      x = (i: number) =>
        55 + (i * (width - 110)) / Math.max(1, columns.length - 1),
      y = (col: { a?: number; b?: number }, side: 0 | 1) =>
        col.a !== undefined && col.b !== undefined ? 85 : side ? 140 : 30;
    let svg = "";
    for (const side of [0, 1] as const) {
      const coords = columns.flatMap((col, i) =>
        (side ? col.b : col.a) === undefined ? [] : [[x(i), y(col, side)]],
      );
      svg += `<path class="metro-line side-${side}" d="${coords.map((p, i) => `${i ? "L" : "M"}${p.join(",")}`).join(" ")}"/>`;
    }
    columns.forEach((col, i) => {
      const both = col.a !== undefined && col.b !== undefined,
        side: 0 | 1 = col.a === undefined ? 1 : 0,
        index = col.a ?? col.b!,
        label = stateLabel((side ? b : a)[index]!);
      const active =
        (col.a !== undefined && col.a === work.comparisonCursors[0]) ||
        (col.b !== undefined && col.b === work.comparisonCursors[1]);
      svg += `<g class="metro-stop ${active ? "selected" : ""}" role="button" tabindex="0" data-column="${i}" ${col.a === undefined ? "" : `data-compare-a="${col.a}"`} ${col.b === undefined ? "" : `data-compare-b="${col.b}"`} aria-label="${both ? "Shared" : side ? "Proposed" : "Original"} step ${index + 1}: ${e(label)}">${(
        [0, 1] as const
      )
        .map((lane) => {
          const step = lane === 0 ? col.a : col.b;
          return step !== undefined && step === work.comparisonCursors[lane]
            ? `<circle class="comparison-cursor side-${lane}" role="button" tabindex="0" data-column="${i}" ${lane === 0 ? `data-compare-a="${step}"` : `data-compare-b="${step}"`} aria-label="Drag ${lane === 0 ? "original" : "proposed"} cursor" cx="${x(i) + (both ? (lane ? 14 : -14) : 0)}" cy="${y(col, lane) + 17}" r="10"/>`
            : "";
        })
        .join(
          "",
        )}<circle cx="${x(i)}" cy="${y(col, side)}" r="${active ? 12 : 8}"/><text x="${x(i)}" y="${y(col, side) + (side ? 30 : -20)}" text-anchor="middle">${e(label)}</text></g>`;
    });
    return `<section class="metro" aria-label="Shared and forked journey timeline"><p><b>Original</b><span>Shared stops merge; drag either branch to scrub.</span><b>Proposed</b></p><div class="metro-scroll"><svg viewBox="0 0 ${width} 180" style="min-width:${width}px" role="group" aria-label="Comparison timeline">${svg}</svg></div></section>`;
  }
  function journeyChooser(): string {
    return `<section class="journey-chooser"><div class="view-title"><h2>Choose a journey</h2><button data-command="journeys">Close</button></div><div class="journey-catalog">${work.journeys
      .filter((j) => !proposals.has(j.id))
      .map(
        (j) =>
          `<button data-journey="${j.id}"><span><b>${e(j.label)}</b><small>${e(j.description ?? "Recorded route")}</small></span><span>${j.steps.length} transitions →</span></button>`,
      )
      .join(
        "",
      )}</div><button data-command="new-route">Trace a journey between two states</button></section>`;
  }
  function routeEditor(): string {
    return `<section class="route-editor" aria-label="Custom journey"><div class="route-fields"><label>Name<input id="route-name" value="${e(routeName)}" maxlength="240"/></label><label>Start<select id="route-start">${optionList(routeStart)}</select></label><label>Outcome<select id="route-end">${optionList(routeEnd)}</select></label><button data-command="suggest">Suggest route</button><button data-command="trace">Trace manually</button><button data-command="cancel-trace">Close</button></div>${work.trace ? `<p>Tracing <b>${e(stateLabel(work.trace.start))}</b> → <b>${e(stateLabel(work.trace.end))}</b>. Use the main view to add valid actions, including loops.</p><div class="trace-record">${[work.trace.start, ...work.trace.steps.map((id) => work.edge(id).to)].map((id) => `<span>${e(stateLabel(id))}</span>`).join(" → ")}</div><button data-command="back" ${work.trace.steps.length ? "" : "disabled"}>Remove last step</button><button data-command="save-trace" ${work.current() === work.trace.end && work.trace.steps.length ? "" : "disabled"}>Save journey</button>` : "<p>A suggestion is a valid starting route. Trace manually to choose a different path or include recovery.</p>"}</section>`;
  }
  function draw(focus?: string): void {
    inspection = undefined;
    pinned = false;
    const comparison = work.mode === "comparison",
      replay = work.mode === "journey" ? work.replay() : undefined;
    let body = "";
    if (comparison) {
      const c = work.comparison();
      body = `${metro()}<div class="comparison-views">${([0, 1] as const)
        .map((side) => {
          const frame = work.frame(side),
            r = work.replay(side);
          return `<section class="main-view"><div class="view-title"><h2>${side ? "Proposed" : "Original"}</h2><span>${e(stateLabel(frame.current))} · ${r.cursor + 1}/${r.journey.steps.length + 1}</span></div>${work.view === "map" ? map(frame, false, side) : app(frame, false, side)}</section>`;
        })
        .join(
          "",
        )}</div><p class="comparison-note">${e(c.detail ?? "An authored proposal. No product changes are applied by this review.")}</p>`;
    } else {
      const frame = work.frame();
      body = `<div class="workspace"><section class="main-view" aria-label="Main ${work.view} view">${work.view === "map" ? map(frame) : app(frame)}</section><aside class="companion" aria-label="Synchronized passive ${work.view === "map" ? "app" : "map"} preview"><div class="view-title"><h2>${work.view === "map" ? "App" : "Map"}</h2><small>Synced preview</small></div>${work.view === "map" ? app(frame, true) : map(frame, true)}</aside></div>`;
      if (!work.trace)
        body = replay
          ? timeline(replay.journey, replay.cursor) + body
          : body +
            `<div class="exploration-trail"><span>Route so far</span><p>${[work.exploration.start, ...work.exploration.steps.map((id) => work.edge(id).to)].map((id) => e(stateLabel(id))).join(" → ")}</p><button data-command="back" ${work.exploration.steps.length ? "" : "disabled"}>← Back</button></div>`;
    }
    const outcome =
      work.mode === "exploration" && work.paused && !work.trace
        ? atlas.ir.states.find((s) => s.id === work.current())
        : undefined;
    document.title = `${atlas.ir.title} · ${work.mode}`;
    const scrolls = [
      ...root.querySelectorAll<HTMLElement>(
        ".journey-timeline,.metro-scroll,.landscape-scroll",
      ),
    ].map((el) => el.scrollLeft);
    root.innerHTML = `<header class="work-header"><div class="work-brand"><b>◉</b><span>${e(atlas.ir.title)}</span></div><nav aria-label="Operation mode">${(
      ["journey", "exploration", "comparison"] as const
    )
      .filter((m) => m !== "comparison" || atlas.ir.comparisons?.length)
      .map(
        (m) =>
          `<button data-mode="${m}" aria-pressed="${work.mode === m}" ${m === "journey" && !work.journeys.length ? "disabled" : ""}>${m[0]!.toUpperCase() + m.slice(1)}</button>`,
      )
      .join(
        "",
      )}</nav><nav aria-label="Major view">${(["app", "map"] as const).map((v) => `<button data-view="${v}" aria-pressed="${work.view === v}">${v === "app" ? "App" : "Map"} major</button>`).join("")}</nav></header>
    <main class="work-main"><div class="work-heading"><div><p class="eyebrow">${work.trace ? "Trace a journey" : comparison ? "Review a proposed change" : replay ? "Replay a fixed journey" : "Explore available transitions"}</p><h1>${e(comparison ? work.comparison().label : replay && !work.trace ? replay.journey.label : stateLabel(work.current()))}</h1><p>${e(replay && !work.trace ? (replay.journey.description ?? "Scrub recorded steps. Actions follow this route.") : comparison ? "Compare the same start and outcome, with each branch under your control." : "Only available transitions move you. Other states stay visible for orientation.")}</p></div><div class="context-controls">${
      replay
        ? '<button data-command="journeys">Journeys ⌄</button>'
        : comparison && atlas.ir.comparisons!.length > 1
          ? `<label>Proposal<select id="comparison-picker">${atlas.ir.comparisons!.map((c) => `<option value="${c.id}" ${c.id === work.comparisonId ? "selected" : ""}>${e(c.label)}</option>`).join("")}</select></label>`
          : ""
    }${work.view === "map" ? nameToggle() : ""}${work.mode === "exploration" && !work.trace ? '<button data-command="restart">Restart exploration</button>' : ""}</div></div>
    ${notice ? `<p class="work-notice" role="status">${e(notice)} <button data-command="dismiss-notice" aria-label="Dismiss message">×</button></p>` : ""}${builder ? routeEditor() : ""}${outcome ? `<section class="outcome-banner" aria-label="Exploration outcome"><div><b>✓ ${e(outcome.outcome ?? outcome.label)}</b><p>${work.exploration.steps.length} transitions recorded, including repeated visits.</p></div><button class="primary" data-command="capture">Review as journey</button>${outcome.terminal ? "" : '<button data-command="continue">Keep exploring</button>'}</section>` : ""}${chooser ? journeyChooser() : body}
    ${replay && !work.trace && !chooser ? `<div class="travel-controls"><button data-command="back" ${work.cursor ? "" : "disabled"}>← Previous step</button><span>Step ${work.cursor + 1} of ${replay.journey.steps.length + 1}</span><button data-command="copy">Copy review for agent</button><button data-command="export">Export review</button></div>` : ""}${work.mode === "exploration" && !outcome && work.exploration.steps.length ? '<button class="quiet-button" data-command="capture">Save this route as a journey</button>' : ""}
    ${manualCopy ? `<section class="copy-fallback"><label>Copy this review<textarea readonly>${e(manualCopy)}</textarea></label><button data-command="close-copy">Close</button></section>` : ""}</main>
    <footer class="work-footer"><span>Model simulation · fixed fixtures · ${atlas.ir.states.length} states</span><button data-command="motion" aria-pressed="${!motion}">${motion ? "Pause motion" : "Resume motion"}</button><details><summary>Coverage &amp; source</summary><p>${e(atlas.ir.source.description)} · ${e(atlas.ir.source.revision)}</p><b>Included</b><ul>${atlas.ir.coverage.included.map((s) => `<li>${e(s)}</li>`).join("")}</ul><b>Omitted</b><ul>${atlas.ir.coverage.omitted.map((s) => `<li>${e(s)}</li>`).join("")}</ul><p>Conditions are explanatory and are not evaluated here. Saved custom journeys stay on this device and are checked against this exact model. Copy/export creates a review brief; no agent is contacted.</p></details></footer>`;
    root
      .querySelectorAll<HTMLElement>(
        ".journey-timeline,.metro-scroll,.landscape-scroll",
      )
      .forEach((el, i) => {
        el.scrollLeft = scrolls[i] ?? 0;
      });
    if (focus)
      root
        .querySelector<HTMLElement | SVGElement>(focus)
        ?.focus({ preventScroll: true });
  }
  function inspect(id: string, pin = false): void {
    inspection = id;
    if (pin) pinned = true;
    for (const shell of root.querySelectorAll<HTMLElement>(
      ".map-shell:not(.passive-map)",
    )) {
      shell.querySelectorAll<SVGElement>(".landscape-edge").forEach((g) => {
        const related = g.dataset.from === id || g.dataset.to === id;
        g.classList.toggle("inspected", related);
        g.classList.toggle("subdued", !related);
      });
      shell
        .querySelectorAll<SVGElement>(".landscape-node,.landmark-label")
        .forEach((g) =>
          g.classList.toggle(
            "inspected",
            g.dataset.node === id || g.dataset.label === id,
          ),
        );
      const state = atlas.ir.states.find((s) => s.id === id)!,
        slot = shell.querySelector<HTMLElement>(".inspection-slot")!;
      slot.innerHTML = `<span><b>${e(state.label)}</b> · ${e(atlas.ir.regions.find((r) => r.id === state.region)!.label)}${state.detail ? ` · ${e(state.detail)}` : ""}${state.source ? `<small class="inspection-source">Source: ${e(state.source)}</small>` : ""}</span><button data-command="unpin" aria-label="Close inspection">×</button>`;
    }
  }
  const clearInspection = () => {
    inspection = undefined;
    pinned = false;
    root
      .querySelectorAll(".inspected,.subdued")
      .forEach((el) => el.classList.remove("inspected", "subdued"));
    root.querySelectorAll(".inspection-slot").forEach((el) => {
      el.textContent =
        "Inspect a landmark; highlighted destinations follow an available action.";
    });
  };
  async function activate(target: Element): Promise<void> {
    const t = target.closest<HTMLElement>(
      "button,[data-atlas-action],[data-atlas-state],[data-column]",
    );
    if (!t || t.hasAttribute("disabled")) return;
    try {
      if (t.dataset.atlasState) {
        inspect(t.dataset.atlasState, true);
        return;
      }
      if (t.dataset.atlasAction || t.dataset.take) {
        const side =
          t.dataset.side ??
          t.closest<HTMLElement>("[data-map-side]")?.dataset.mapSide;
        work.take(
          (t.dataset.atlasAction ?? t.dataset.take)!,
          side === "0" ? 0 : side === "1" ? 1 : undefined,
        );
        draw(
          work.view === "map"
            ? `[data-map-side="${side ?? "main"}"] [aria-current="location"]`
            : side === "0" || side === "1"
              ? `[data-side="${side}"]:not(:disabled)`
              : ".app-content button:not(:disabled)",
        );
        return;
      }
      if (t.dataset.journey) {
        work.selectJourney(t.dataset.journey);
        chooser = false;
        builder = false;
        draw();
        return;
      }
      if (t.dataset.mode) {
        chooser = false;
        work.setMode(t.dataset.mode as Operation);
        builder = false;
        draw(`[data-mode="${work.mode}"]`);
        return;
      }
      if (t.dataset.view) {
        work.view = t.dataset.view as MajorView;
        draw(`[data-view="${work.view}"]`);
        return;
      }
      if (t.dataset.scrub !== undefined) {
        work.scrub(Number(t.dataset.scrub));
        draw(`[data-scrub="${work.cursor}"]`);
        return;
      }
      if (t.dataset.column !== undefined) {
        if (t.dataset.compareA !== undefined)
          work.scrub(Number(t.dataset.compareA), 0);
        if (t.dataset.compareB !== undefined)
          work.scrub(Number(t.dataset.compareB), 1);
        draw();
        return;
      }
      switch (t.dataset.command) {
        case "names":
          toggleNames();
          return;
        case "unpin":
          clearInspection();
          return;
        case "journeys":
          chooser = !chooser;
          break;
        case "new-route":
          chooser = false;
          builder = !builder;
          if (!builder) work.trace = null;
          break;
        case "cancel-trace":
          builder = false;
          work.trace = null;
          break;
        case "suggest":
          work.startTrace(routeStart, routeEnd);
          break;
        case "trace":
          work.startTrace(routeStart, routeEnd, false);
          break;
        case "save-trace":
          work.saveTrace(routeName);
          builder = false;
          persist();
          break;
        case "back":
          work.back();
          break;
        case "capture":
          work.capture();
          persist();
          break;
        case "continue":
          work.continueExploration();
          break;
        case "restart":
          work.restart();
          break;
        case "motion":
          motion = !motion;
          break;
        case "dismiss-notice":
          notice = "";
          break;
        case "copy": {
          const text = work.review();
          try {
            await navigator.clipboard.writeText(text);
            notice =
              "Review copied. Paste it into your agent conversation to request an optimization.";
          } catch {
            manualCopy = text;
            notice = "Clipboard unavailable. Select and copy the review below.";
          }
          break;
        }
        case "export": {
          const url = URL.createObjectURL(
              new Blob([work.review()], { type: "text/plain;charset=utf-8" }),
            ),
            a = document.createElement("a");
          a.href = url;
          a.download = "journey-review.txt";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          notice = "Review exported.";
          break;
        }
        case "close-copy":
          manualCopy = "";
          break;
        default:
          return;
      }
      draw();
    } catch (error) {
      notice = error instanceof Error ? error.message : String(error);
      draw();
    }
  }
  root.addEventListener("click", (event) => {
    if (ignoreClick) {
      ignoreClick = false;
      return;
    }
    if (event.target instanceof Element) void activate(event.target);
  });
  root.addEventListener("change", (event) => {
    const t = event.target as HTMLSelectElement;
    if (t.id === "journey-picker") {
      work.selectJourney(t.value);
      draw("#journey-picker");
    } else if (t.id === "comparison-picker") {
      work.comparisonId = t.value;
      work.comparisonCursors = [0, 0];
      draw("#comparison-picker");
    } else if (t.id === "route-start") routeStart = t.value;
    else if (t.id === "route-end") routeEnd = t.value;
  });
  root.addEventListener("input", (event) => {
    const t = event.target as HTMLInputElement;
    if (t.id === "route-name") routeName = t.value;
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key.toLowerCase() === "n" &&
      !event.repeat &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      work.view === "map" &&
      !(
        event.target instanceof Element &&
        event.target.closest("input,textarea,select,[contenteditable]")
      )
    ) {
      event.preventDefault();
      toggleNames();
      return;
    }
    if (event.key === "Escape") {
      clearInspection();
      return;
    }
    if (
      event.target instanceof SVGElement &&
      event.target.getAttribute("role") === "button" &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      void activate(event.target);
    }
    const step =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-scrub]")
        : null;
    if (step && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      work.scrub(
        Math.max(
          0,
          Math.min(
            work.journey().steps.length,
            work.cursor + (event.key === "ArrowRight" ? 1 : -1),
          ),
        ),
      );
      draw(`[data-scrub="${work.cursor}"]`);
    }
  });
  root.addEventListener("pointerover", (event) => {
    if (pinned) return;
    const node =
      event.target instanceof Element
        ? event.target.closest<SVGElement>(".landscape-node")
        : null;
    if (node && !node.closest(".passive-map")) inspect(node.dataset.node!);
  });
  root.addEventListener("focusin", (event) => {
    const node =
      event.target instanceof Element
        ? event.target.closest<SVGElement>(".landscape-node")
        : null;
    if (node && !pinned) inspect(node.dataset.node!);
  });
  root.addEventListener("pointerout", (event) => {
    const next =
      event.relatedTarget instanceof Element ? event.relatedTarget : null;
    if (!pinned && inspection && !next?.closest(".map-shell"))
      clearInspection();
  });
  root.addEventListener("focusout", (event) => {
    if (
      !pinned &&
      event.relatedTarget instanceof Element &&
      !event.relatedTarget.closest(".map-shell")
    )
      clearInspection();
  });
  let drag:
    | {
        side: 0 | 1;
        left: number;
        width: number;
        columns: ReturnType<typeof alignVisits>;
        startX: number;
      }
    | undefined;
  let ignoreClick = false;
  root.addEventListener("pointerdown", (event) => {
    const t =
      event.target instanceof Element
        ? event.target.closest<SVGElement>("[data-column]")
        : null;
    if (!t || work.mode !== "comparison") return;
    const rect = t.closest("svg")!.getBoundingClientRect(),
      c = work.comparison();
    drag = {
      side: t.dataset.compareA === undefined ? 1 : 0,
      startX: event.clientX,
      left: rect.left,
      width: rect.width,
      columns: alignVisits(
        visitsFor(atlas.ir, work.journey(c.before)),
        visitsFor(atlas.ir, work.journey(c.after)),
      ),
    };
  });
  root.addEventListener("pointermove", (event) => {
    if (!drag || !event.buttons) return;
    if (Math.abs(event.clientX - drag.startX) < 4 && !ignoreClick) return;
    ignoreClick = true;
    if (!root.hasPointerCapture(event.pointerId))
      root.setPointerCapture(event.pointerId);
    const d = drag,
      w = Math.max(700, d.columns.length * 145),
      x = ((event.clientX - d.left) / d.width) * w;
    let best: number | undefined,
      cost = Infinity;
    d.columns.forEach((col, i) => {
      const index = d.side ? col.b : col.a;
      if (index === undefined) return;
      const distance = Math.abs(
        x - (55 + (i * (w - 110)) / Math.max(1, d.columns.length - 1)),
      );
      if (distance < cost) {
        cost = distance;
        best = index;
      }
    });
    if (best !== undefined && best !== work.comparisonCursors[d.side]) {
      work.scrub(best, d.side);
      draw();
    }
  });
  root.addEventListener("pointerup", () => {
    drag = undefined;
    setTimeout(() => {
      ignoreClick = false;
    }, 0);
  });
  root.addEventListener("pointercancel", () => {
    drag = undefined;
  });
  document.addEventListener("visibilitychange", () => {
    root.dataset.visibility = document.hidden ? "hidden" : "visible";
  });
  draw();
} catch (error) {
  root.replaceChildren();
  const p = document.createElement("p");
  p.setAttribute("role", "alert");
  p.className = "atlas-error";
  p.textContent = `Workbench unavailable: ${error instanceof Error ? error.message : String(error)}`;
  root.append(p);
}
