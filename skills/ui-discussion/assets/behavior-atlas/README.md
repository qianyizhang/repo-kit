# Behavior atlas scaffold

An agent supplies a source-grounded JSON graph, fixed screen fixtures and named
journeys. The scaffold validates them and renders a behavior workbench: Journey,
Exploration and proposal-only Comparison, with App major / Map major views.
The browser runtime has no third-party dependencies. Node 24.21+ builds a single
HTML file; TypeScript and Node types are development-only dependencies.

```sh
node build.ts --input example.json --check
node build.ts --input example.json --out atlas.html
# For development checks:
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run preview # Supplied example.json, loopback only; stop with Ctrl+C.
node serve.ts --input ez-example.json # Full historical EZ demonstration.
```

Open the generated HTML locally or serve it on loopback. Outputs must be new;
`--replace` explicitly replaces named generated files. To bind an existing app,
use `--runtime-out DIR` and import its generated `renderer.js` and `atlas.css`.
The emitted TypeScript companions are generated for consumer type checking.
Edit this scaffold's sources, then regenerate; do not edit those companions.

## Author the IR

Use `example.json` as a small workflow or `ez-example.json` for the full workbench.
The EZ fixture records the earlier design study, not today's native application.
`schema.ts` owns the v1 contract
and field diagnostics. IDs are stable references; visible labels use the user's
words. Keep guards as explanatory text and include source locations and coverage
limits. A source-derived model is not proof of runtime behavior.

- `regions` group screens or contexts. `plane: false` keeps an external context
  outside the screen planes.
- `states` name observable states, their region, source and optional description.
  `terminal` means no outgoing transition exists. `outcome` names a meaningful
  stopping point while allowing further work after explicit continuation.
  `preview` contains plain-text `title`, `body` and optional `{ label, value }`
  fields for a fixed schematic app view. Optional ordered `blocks` compose text,
  headings, fields, notices and action groups; `overlay` models a dialog above an
  inert background. Every action names an outgoing transition ID. Action IDs in a group retain their declared order. Unknown kinds,
  duplicate placements and references to another state's actions are rejected.
  Unplaced outgoing actions remain visible. The main view applies the controller's
  enabled/disabled status; the passive companion has no controls. No markup,
  scripts, expressions, custom CSS or live inputs are accepted.
- `transitions` name source, destination, event kind and optional guard/source.
  Optional `action` identifies a shared command; it is never executed as code.
  `proposed: true` excludes a transition from exploration and route suggestions;
  it can participate in an explicitly authored proposal replay.
- `journeys` contain `id`, `label`, optional `description`, `start` and ordered
  transition IDs in `steps`. Author major routes in discovery order, including
  recovery loops. Repeated visits are separate replay points. The first
  non-proposal journey opens by default. Without authored journeys, the viewer
  suggests routes from the initial state to modeled outcomes when reachable.
- `comparisons` name two journey IDs in `before` and `after`, with `id`, `label`
  and optional `detail`. They must share a start and final state. Comparison stays
  absent when there is no authored proposal; it never invents an optimization.
- `source` names the revision and baseline. `coverage` records included and omitted
  behavior. Unknowns remain visible instead of being inferred as working states.
- `layout` is optional presentation data for a previously reviewed map. New maps
  need no coordinates: layout uses sorted IDs and a bounded deterministic graph
  placement. Edges draw relationships; coordinates imply neither time nor rank.

Keep the IR within 24 regions, 240 states and 1,200 transitions. Split a larger
model into named review scopes. Those bounds limit rendering work; they are not
claims about the application being modeled.

### Screen fixture example

```json
{
  "title": "Retained question",
  "fields": [{ "label": "Preset", "value": "Standard" }],
  "blocks": [
    { "kind": "actions", "transitions": ["open-details"] },
    { "kind": "notice", "tone": "warning", "text": "An edit is pending." }
  ],
  "overlay": {
    "title": "Discard edits?",
    "body": "The original question will be kept.",
    "blocks": [{ "kind": "actions", "transitions": ["keep", "discard"] }]
  }
}
```

Here `open-details`, `keep` and `discard` must be outgoing transitions of that
state. Place only actions that belong to the screen; availability is still owned
by the controller. Overlay states normally place their current actions inside
`overlay.blocks`. Supported block kinds are `text`, `heading`, `fields`, `notice`
(with `neutral`, `success`, `warning` or `danger` tone), and `actions`.

## Use the workbench

Journey scrubs a recorded sequence. The main app or map enables only its next
transition; other reachable actions remain visible and disabled. Exploration
enables actual unguarded outgoing transitions and keeps every modeled state in
the same position. Reaching an outcome preserves the exact path and offers
Review as journey / Keep exploring. A terminal state permits review or rewind.
The companion is passive: its miniature retains the full topology and puts
readable current/next names below the map instead of shrinking every label.

Custom journey first suggests a valid start–end route. Trace manually, or remove
steps from a suggestion, to add alternate actions and loops. Save requires reaching
the declared end. Saved custom journeys stay in browser storage for this exact
model; stale or malformed records are rejected without changing authored routes.
Storage failure keeps the route in the current session and offers export.

Comparison shows two apps or two maps. Its merged timeline aligns shared visits
in order, retains forks and repeated visits, and scrubs either branch independently.
Click a shared stop to align both cursors. Copy review for agent / Export review
include the original action sequence and provenance; neither contacts an agent.

Names are visible by default; N or Names toggles current/next names only.
Inspection reveals a distant name without navigation. Small stable landmark IDs,
neutral raised planes and curved hops form the map overview.
Inspecting a landmark highlights its connections without moving the current
state. The current plane, static halo and arrows remain legible with motion off.
The deterministic layout is a review aid, not a graph-planarity guarantee; inspect
dense authored models and supply reviewed layout hints when needed.

## Bind an app

`compileAtlas(unknown)` validates the IR once and owns deterministic layout.
`paintAtlas(root, atlas, frame, view)` renders a snapshot and replaces stale output
with a diagnostic on invalid input. `connectAtlas(root, handlers)` wires pointer,
keyboard and visibility handling; call its returned cleanup when unmounting.

The app adapter supplies the frame: current state, exact available transitions,
remaining route and taken path. It owns guards, effects, drafts and history.
The renderer cannot run a model action. On an emitted action ID, the adapter must
recheck availability and apply the action through the existing model owner.
Inspecting a destination must not change the application's state. The `state`
handler inspects a landmark; the `action` handler receives the only direct action
for that destination. When multiple actions share a destination, inspection leaves
choosing the action to the host's action list.

`renderApp()` and `renderActions()` in `screen.ts` render the validated fixed
screen blocks; their options come from `Workbench.options()`.

The same landscape is used by default in the workbench and adapter. View options
are `names` (`"all"` or `"nearby"`), `compact`, `passive`, `motion` and `idPrefix`.
Use `{ compact: true, passive: true }` for the fixed overview. Give each map a
unique `idPrefix` when rendering more than one on a page. `workbench.ts` owns
standalone route semantics and can be imported from the generated runtime.
Runtime generation includes landscape and screen styles in generated `atlas.css`;
the standalone page adds the workbench controls.

The standalone viewer can follow unguarded graph transitions only. A textual
guard is **not evaluated** and never becomes enabled just because it is present.
For stateful behavior, use an app adapter or expand the IR into exact states.
The scaffold does not infer UI windows, implement arbitrary guard expressions,
run code extraction, or claim formal verification.

All modeled states keep fixed positions; proposed connections appear only in their
explicit replay. Taken paths change emphasis without adding nodes. Transitions
between the same pair of states share a hop; same-state events stay in the action
list. The host supplies readable action controls with `renderActions()` when
binding a map. `frame.selected` highlights an inspected landmark and its connections
without changing the current plane.

Only currently available paths animate. Pause motion and `prefers-reduced-motion`
retain a static halo, arrows, labels and active-plane outline. Motion pauses while
the document is hidden and retains no data.

## Reference

Adapted the model/view/renderer separation and reader-facing labels from
[pstack's statechart skill](https://github.com/backnotprop/pstack/tree/6c75f4e67546c2ddbf9634734c1e3ebbea34861a/skills/statechart),
reviewed 3 November 2026: `SKILL.md`, `scripts/ir.ts`, and `scripts/pipeline.ts`.
Its TLA+/TLC checking remains outside this lightweight scaffold. No pstack code,
renderer or toolchain was copied or installed.
