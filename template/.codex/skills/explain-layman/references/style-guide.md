# Layman explainer style guide

Use this reference for the editorial and visual craft shared across repositories.
Repository-specific language, roles, invariants, terms, paths, and source URLs
belong only in `repo-bindings.md`.

## Editorial posture

Write for responsible non-engineers: product, operations, domain experts,
reviewers, content owners, and sponsors. They do not need implementation detail,
but they do need clear responsibility and authority boundaries.

Make one teaching job easier to explain in a meeting. Do not sell the system;
make its operating model accountable.

## Default page rhythm

Use this sequence when the chosen shape is a page and the topic does not demand
another order:

1. **Hero:** audience eyebrow, literal H1, short lead naming what the page
   answers and how to read it.
2. **One-line answer:** the smallest accurate statement of the boundary.
3. **Primary visual:** one process, relationship, object, or responsibility map.
4. **Concept split:** separate terms readers commonly conflate.
5. **Main body:** what it contains, who owns it, and how it changes.
6. **Boundary:** what can be automated, proposed, reviewed, released, or acted on.
7. **Check questions:** meeting-ready questions that expose uncertainty.
8. **Reusable sentence:** a line suitable for cross-team explanation.
9. **Footer:** title, freshness notice, canonical source, and artifact path from
   the local binding.

The filename, `<title>`, H1, and footer title must describe the same concept.

## Useful teaching patterns

- **Concept:** separate the words → what the concept governs → what it is not.
- **Process:** transformation → why not the direct shortcut → how it is checked.
- **Role:** separate roles → responsibility map → required handoff.
- **Safety:** separate content classes → why authority matters → operational use.
- **Landscape:** full terrain → project focus → explicit non-focus.
- **Migration:** fair baseline → authority shift → resulting capability and cost.
- **Implementation:** parallel capability lanes → vertical integration →
  progressive releases along coverage and capability axes.

## Tone and word choice

Prefer concrete operational phrasing. Avoid unbounded claims such as “fully
automated,” “intelligent closed loop,” “replaces the expert,” or any wording that
moves decision authority from the repository's declared owner.

Run a separate word-choice pass after structure settles:

- Replace literal calques and bare non-canonical English with the reader's
  natural language.
- Lead with reader-language and show the canonical name once when it carries a
  contract or code meaning.
- Reuse the local glossary exactly; do not create private translations.
- Apply the local avoid-list consistently, including headings, diagrams,
  tooltips, and captions.

## Contextual tooltips

Use a dependency-free, keyboard-focusable pattern:

```html
<span class="term" tabindex="0"
  data-tip="Plain meaning; why the term matters at this exact point.">
  Reader wording (CanonicalTerm)
</span>
```

Tooltip coverage includes first meaningful uses of clinical, scientific,
regulatory, coding, and repository-canonical terms. A tooltip must:

- explain both meaning and contextual relevance;
- stay short enough to scan;
- derive from the local glossary or authority source;
- remain supplementary—the sentence must still work without hover;
- be reachable with keyboard focus and readable at narrow widths.

## Visual style

Keep the artifact quiet and operational:

- warm neutral background, white surfaces, near-black ink, muted borders;
- small radii and semantic accent colors;
- no decorative gradients, floating orbs, or marketing hero art;
- diagrams only for process, hierarchy, ownership, comparison, or state change;
- labels and shapes must carry meaning without relying on color alone;
- invented counts and examples must be marked illustrative;
- mobile layouts stack cleanly and remove misleading connector arrows.

## One visual spine

Render a sequence exactly once as the primary visual. Other sections may show
roles, evidence, failure modes, or scale, but should not walk the same spine a
second time. Repetition makes an explainer feel long without adding intuition.

## Role, scale, and omission

- Make “who acts” visible through a consistent role-chip legend. Keep software
  permission distinct from real-world responsibility.
- Show scale when a small governed artifact represents a much larger source
  funnel. Mark illustrative numbers and truncated lists honestly.
- When a mock surface omits real fields, state the omission and route to a schema
  sample rather than implying the fields do not exist.
- Show rejected and missing-data cases as well as successful matches. “Not
  selected” and “unknown” should remain visible states.

## Interaction

Use interaction only when exploration materially improves understanding. Good
fits include an artifact gallery, layer map, comparison toggle, or one clickable
process feeding a shared detail panel.

Keep important content visible in the default state. Use vanilla HTML/CSS/JS,
obvious controls, keyboard access, and mobile fallbacks. Avoid motion unless it
clarifies a state change; honor `prefers-reduced-motion`.

## Structural variants

Compare labeled variants when the user requests a choice or an unresolved
information-design decision materially affects the teaching job. Reuse the real
visual shell and relevant constraints. A settled format choice needs no further
selection round; proceed through polishing and verification. Remove temporary
previews when they no longer serve review or implementation.

## Safety and authority checklist

When relevant, make visible:

- who proposes, assures, releases, computes, presents, and acts;
- which object is canonical and which surfaces are projections;
- what is immutable and how a changed version is created;
- how the current result can be reconstructed;
- what missing information or missing coverage means;
- which outputs are findings, prompts, requests, or actions rather than silently
  collapsing them into one conclusion.
