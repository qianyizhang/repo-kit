# UI / UX

## Before proposing or building

- Inspect the existing rendered product, source and design owner when available.
  Name the user goal, visible parts and roles in plain language. Use the same names
  in the proposal, UI and tests; a panel is not inherently a chat or an agent.
- Sketch two dimensions: spatial layout (regions, facts, actions and their owners)
  and temporal journey (cue, deliberate action, outcome and recovery). Check the
  affected surface and its neighbors before adding controls. Scale this to the
  change; a small edit needs no exhaustive audit or review artifact.
- Establish principles before choosing a visual direction. Record accepted
  terminology and decisions in the product's existing design owner; code remains
  the source of truth for implemented behavior. Use `ui-discussion` when a full
  shared map and review are needed.

## Layout and disclosure

- Let layout explain relationships. Remove repeated facts, unnecessary secondary
  labels and descriptions; keep essential labels, values and units identifiable.
- Give each selection or action one clear home; retain alternate access when it
  serves a distinct context. Avoid competing selectors for the same choice.
  For a journey containing several interactions,
  show the applicable actions at each step. Compare alternate outcomes in place;
  for long journeys, highlight the current phase without losing context.
- Show enough to reveal what the user can do next. Keep short facts and inputs
  visible; an accordion for one sentence adds work. Reveal substantial details
  after deliberate interest. Use hover/focus previews for brief supplemental
  context, with a touch-accessible equivalent; keep essential instructions visible
  and long payloads readable/selectable in an inspector.
- Choose a familiar visual form for the relationship: for exchanges over time,
  use actor lanes and ordered events. Avoid unrelated cards when the question is
  how parts connect. Name each destination and distinguish observation from inference.
- Give diagnostics a concrete purpose and scope, such as investigating a failed
  run. Reveal unrelated housekeeping only when relevant or requested.
- Prefer familiar symbols (ℹ, ↻) over text when recognizable. Give controls
  accessible names; use visible labels when the action would otherwise be ambiguous.
- Use short action labels: “Save”, “Retry”, “Copy”. Prefer one sentence to a paragraph;
  keep instructions only where the interface cannot explain the action.

## Verify the journey

- Before implementation, list each primary action's real route and expected
  outcomes, including failure, unavailable capability and uncertain completion.
  Verify the wiring through that route; a clickable prototype establishes only
  simulated behavior. Evidence refresh must not repeat the underlying action.
- Preserve drafts, navigation context and truthful loading/error/recovery states.
  Test realistic content and affected empty, long, loading, error and dirty states.
- Check keyboard/focus, contrast, non-color cues, target size, overflow, text scaling,
  themes and reduced motion where affected. Respect platform input conventions.
- Exercise the actual flow and inspect the whole screen and sibling surfaces.
  Capture meaningful visual changes; automated checks alone do not establish
  accessibility or visual quality.

References: [WCAG](https://www.w3.org/TR/WCAG22/),
[WAI evaluation](https://www.w3.org/WAI/test-evaluate/),
[Apple HIG](https://developer.apple.com/design/human-interface-guidelines/).

User-feedback provenance: `docs/reviews/2026-10-23-ui-build-prevention.md` in repo-kit.
