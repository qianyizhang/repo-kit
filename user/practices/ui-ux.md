# UI and UX

Reviewed 2026-10-22. Use for user-visible flows, wording, controls, layout and
interaction in browser or native surfaces. The product's design contract owns
visual identity; these defaults govern how to make and assess the change.

## Frame the experience

Inspect the current rendered surface and its design owner before changing it.
Identify the user task, the decision/action the screen supports, and which
record, draft or result it describes. Include affected sibling surfaces.
For a new design direction, establish principles before scaffolding and themes;
keep experiments isolated until a direction is accepted.

Assign each fact/control to the default view, a named disclosure or settings.
The first read should expose the primary action and necessary status. Remove
repeated facts, pair labels with values/units, and keep populated fields
identifiable. Use conventional symbols where understandable, with accessible
names; minimalism does not make unlabeled controls accessible.

## Review real states

Choose meaningful cases from the affected surface: empty, populated, long,
loading, streaming, error, offline, disabled, selected, dirty and recovered.
Use realistic content, including tables/images/code and bilingual text where the
product supports them. Check narrow/wide layouts, applicable themes, text scaling
and reduced motion. This is a selection by changed behavior, not a fixed quota.

Keep status truthful and preserve context through navigation, disclosure and
failure. A loading indication should distinguish waiting from useful progress.
Visible recovery actions should match the actual failure and preserve drafts.

## Access and input

- Use semantic controls, persistent names and understandable state announcements.
  Preserve focus visibility/order and a usable keyboard path through the flow.
- Communicate meaning through more than color. Check contrast and text/target
  sizing against applicable platform and accessibility requirements.
- Exercise the full intended target, not just its text or icon. Check scrolling,
  overflow, selection, tooltips and touch/pointer behavior where applicable.
- Respect the host's theme, accessibility settings and platform input conventions.
  Shared contracts can have different native and browser implementations.

## Acceptance

Exercise the built browser UI or actual native views through the user's task.
Capture current rendered evidence for meaningful visual changes. Compare the
whole screen and sibling surfaces; fix observed confusion, crowding, duplicate
information and lost context before repeating the affected case.

Automated accessibility/layout checks support this review but do not establish
full accessibility or aesthetic quality. Distinguish source/build, rendered,
interaction, installed and live-service evidence. Keep a named limitation for
an unexercised state rather than treating a screenshot or green test as full
acceptance.

## References

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and
  [WAI evaluation](https://www.w3.org/WAI/test-evaluate/): web accessibility criteria
  and the role of human evaluation, separate from personal visual taste.
- [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/) and
  [task-based accessibility testing](https://developer.apple.com/documentation/accessibility/performing-accessibility-testing-for-your-app):
  apply the conventions of the actual platform.
- [pstack experience-first](https://github.com/cursor/plugins/blob/d1453c11d1dde9714d4c313c97d3a68432265c7f/pstack/skills/principle-experience-first/SKILL.md):
  Lauren Tan, MIT; selective influence on experience/verification judgment.
  The local Saul workflow and product design contracts remain their own owners.
