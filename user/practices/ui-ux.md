# UI / UX

## Before proposing or building

- **Device scope** · Design, build and verify for desktop and laptop by default, including relevant window and embedded panel sizes. Include mobile when the user explicitly asks for it. If there is a strong reason to include mobile, ask the user to confirm before adding it to scope.
- **Web guidance** · Run the pinned CLI with `search` or `retrieve`. If unavailable, use official platform documentation.

```sh
DISABLE_TELEMETRY=1 "$HOME/.local/share/modern-web-guidance/node_modules/.bin/modern-web-guidance" search "<query>"
```

- **Shared terms** · Inspect the rendered product, source and design owner when available. Name the goal, visible parts and roles in plain words. Use the same names in proposal, UI and tests.
- **Purpose** · Operate to complete a task, read to understand, persuade to decide and act, or experience to engage with the work. Set density, type, motion and expression per surface. For a new visual direction, specify imagery and typography in the design brief.
- **Scope** · Polish fixes local defects within current visual identity and intended behavior. Redesign can replace the direction with authorization. Preserve product facts, core functions and platform conventions.
- **Map** · Cover both spatial layout (regions, facts, actions, owners) and the journey (cue, action, outcome, recovery). Check neighbors before adding controls. Match review depth to the change. Use `ui-discussion` for a full map and shared review.
- **Decision owner** · Establish principles before choosing direction. Record accepted terms and decisions in the product design owner. Code shows implemented behavior.
- **Review** · Distinguish accessibility requirements from style heuristics. Judge density, type and motion against intent and demonstrated failures. Compare the rendered result with the agreed visual reference when there is one.

## Layout and disclosure

| Goal | Outcome |
| --- | --- |
| Clear ownership | Layout shows relationships. One clear home per action, selection and fact. Alternate access earns its place in a distinct context. Essential labels, values and units remain visible. |
| Useful copy | Use grouping, alignment and spacing to show what belongs together. Omit secondary labels that repeat a heading or control name, and descriptions that restate what the layout already makes clear. Keep copy that adds information people need to understand, act or recover. |
| Continuous journey | Actions fit the current phase. Compare outcomes in place. Highlight the current phase of long journeys with context still visible. |
| Useful stage controls | Show controls that affect this stage. Explain dependency-disabled controls briefly. Keep values across stages and prioritize the current experiment over upstream settings. |
| Stable workbench | Primary viewport, controls and effects share a stable frame. Inspector owns long scrolling. Shared selections have one persistent home. Floating panels reserve space, preserve context and support dismissal. |
| Progressive detail | Visible short facts, inputs and next actions. Disclose substantial detail on demand. Keep essential content visible and provide a touch equivalent for hover/focus when touch input is in scope. Long payloads remain readable and selectable in the inspector. |
| Meaningful relationships | Familiar form fits the question. Actor lanes and ordered events show exchanges over time. Name destinations and label observations and inference. |
| Scoped diagnostics | Show evidence relevant to the failure, action or request. Disclose housekeeping when useful. |
| Clear controls | Short action labels such as “Save”, “Retry”, “Copy”. Familiar symbols with accessible names. Visible labels for ambiguous actions. |

## Verify the journey

| Evidence | Acceptance |
| --- | --- |
| Real route | Before implementation, identify each primary action's route and expected success, failure, unavailable capability and uncertain completion. Verify wiring through that route. Refresh evidence without repeating effects. |
| Real states | Realistic empty, long, loading, error and dirty states. Preserve drafts, navigation context and truthful recovery. |
| Accessibility | Keyboard/focus, rendered contrast, non-color cues, targets, overflow, text scaling, themes and reduced motion where affected. Respect platform input conventions. |
| Hover/focus | Verify real opening, pointer travel into supplemental content and dismissal without moving focus when it obscures content. |
| Contrast | Measure text and necessary control cues against rendered adjacent colors. Distinguish functional boundaries from decorative dividers. Fix the affected role. |
| Field and form errors | Associate field errors with their inputs and make correction reachable. Form failures, conflicts and uncertain saves have distinct recovery. Prevent unsafe repeats. |
| Window size and text enlargement | Check reflow at in-scope window and panel sizes. Check text enlargement separately. Bound necessary two-dimensional scrolling to its region. Verify readable cells, full values and cues to hidden content. |
| Staged tools | Every enabled control changes its viewport or live data observably. Check dependencies, retained selection and a stable viewport across navigation, inspector scroll and text scaling. |
| Visual and access verdict | Exercise the actual flow, whole screen and neighbors. Capture meaningful visual change. Assess visual quality and accessibility on the rendered flow. |

[WCAG](https://www.w3.org/TR/WCAG22/) · [WAI evaluation](https://www.w3.org/WAI/test-evaluate/) · [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/)
