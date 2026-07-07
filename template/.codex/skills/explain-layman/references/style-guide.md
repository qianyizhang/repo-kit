# Layman Explainer Style Guide

> Seeded from the governance kit — portable explainer craft. Replace the
> word-choice examples and safety reminders with your repo's real terms and
> boundaries; keep the posture, rhythm, and visual/interaction patterns.

Use this reference when creating or revising a non-technical stakeholder
explainer page, especially `docs/background/*.html`.

## Editorial posture

Write for responsible non-engineers: product, operations, domain experts,
reviewers, content owners, and sponsors. They do not need implementation detail,
but they do need clear responsibility boundaries.

The page should make one practical confusion easier to explain in a meeting. It
should **not sell the system**; it should make the operating model accountable.

Default artifact language is the repo's stakeholder-reader language. Keep canonical
source-object names and real schema field names in English when they matter for
traceability (they match code).

## Page rhythm

Use this sequence unless the topic strongly suggests another order:

1. **Hero**: audience eyebrow, literal H1, one short lead. Split the lead into two
   lines — first *what the page answers*, then *how to read it*. Trim connective
   filler; a single dense multi-clause lead reads as tiring.
2. **One-line answer**: one concise answer that names the boundary.
3. **Flow strip**: 5-7 nodes showing the process, handoff, or transformation.
4. **Term split**: "first separate these" for concepts people conflate.
5. **Main body cards**: what it contains, who owns it, or how it works.
6. **Boundary section**: what can be automated vs what needs human review.
7. **Check questions**: meeting-ready reliability or readiness questions.
8. **Reusable quote**: a line usable for training or cross-team sync.
9. **Footer**: page title and `last_update`.

The HTML filename, `<title>`, H1, and footer title should describe the same page
concept.

## Useful section patterns

Pick the pattern that matches the topic:

- Concept explainer: separate the words → what it really governs → what it is not.
- Process explainer: step-by-step transform → why not the direct way → is it
  reliable.
- Role explainer: separate the two roles → responsibility map → what must be
  handed off.
- Safety explainer: separate the content classes → why so strict → how it lands in
  the system.

## Tone

Prefer concrete operational phrasing over marketing. Avoid overbroad claims like
"fully automated", "closed intelligent loop", "replaces the expert", and avoid
wording that implies an LLM decides where the repo says a deterministic rule or a
human gate does ("the system automatically…").

## Word choice — the mandatory jargon pass

The most common quality regression on these pages is not a wrong fact — it is
**awkward calques and bare jargon** that read as insider-speak to a non-engineer.
Two failure modes, two fixes:

- **A. Sloppy calque with a better existing form** — a literal word-for-word
  translation or untranslated English left bare in prose. There is already a
  cleaner form in the reader's language; use it, everywhere.
- **B. Canonical internal term that is still jargon to laymen** — it IS the repo's
  ubiquitous-language term (see `docs/glossary/`), correct internally, but a
  stakeholder page should render it in operational language and gloss the
  canonical word once in parentheses. Lead with the reader-language term, put the
  English in parentheses on first use — `term(English)`, never `English term`.

> Build the repo's own two-column fix tables here (「sloppy → use this」 and
> 「canonical → say it plainly」) as you hit real regressions. Canonical
> translations for domain nouns are owned by `docs/glossary/`, not invented per
> page — reuse the glossary's translation verbatim so pages don't drift.

## Visual style

Dependency-free standalone HTML with inline CSS. Keep it quiet and operational:

- Background: warm off-white (e.g. `#faf9f5`).
- Surface: white cards with `1px` muted borders.
- Ink: near-black, not pure black.
- Accent set used **semantically**: e.g. green for stable/approved/responsibility,
  blue for source/data/system, amber for caution/operations, red for
  safety/blocking.
- Cards: small radius or square; avoid decorative orbs, gradient decoration, and
  marketing-hero layouts.
- Use flow nodes, cards, and simple matrices. Diagrams explain a process,
  boundary, role, or decision path.
- Mobile: stack grids to one column and hide arrow pseudo-elements.

## Interactive visuals

Do not treat interactivity as decoration. Preserve existing load-bearing
interactive charts/diagrams; add lightweight interaction only when it helps a
non-technical reader understand a relationship that would be clumsy as static
text.

Good reasons: showing what a generated artifact looks like via a realistic mock
surface (IDs, rows, fields, traces, status, handoff routes); mapping two
vocabularies/roles/layers; a tradeoff curve; before/after or auto/human-gate
comparison; short explanations on hover/click while keeping the page calm.

Good patterns: artifact gallery (left rail of objects + right mock screen);
hover/click layer map with a pinned note; segmented controls for switching
views; inline SVG chart with short risk cards; clickable process nodes updating
one shared panel.

Constraints: dependency-free (vanilla HTML/CSS/JS + inline SVG); degrade
gracefully on mobile; never hide important text behind hover-only content;
affordances self-evident (no "click here" instructions); prefer one strong
interactive diagram over several gimmicks; no motion unless it clarifies a state
change.

## Role-forward, scale, and honest omission

These moves repeatedly fix object/process explainers:

- **Make "for whom to act" first-class.** Define one role color system (label +
  colored dot) with a legend in the hero, and reuse the *same* chips everywhere.
  The reader should never read a paragraph to learn who acts. Keep permission-role
  vs responsibility-role honest; a struck-through chip is a good way to show "may
  view, may not act".
- **Show scale for distillate artifacts.** When the thing is the reviewed end of a
  large funnel, readers under-read it as "a few checks." Add a funnel strip with
  order-of-magnitude counts; make many-to-one aggregation concrete (a count + a
  few samples + a `+N more` row). Tag invented numbers as illustrative. Never
  leave opaque codenames bare — reveal a one-line plain "what it is" on
  hover/focus (CSS tooltip; `tabindex="0"` for keyboard).
- **Omit honestly.** When a mock surface simplifies a real object, gray + footnote
  the dropped fields and link to a real schema sample in a small `Schema` appendix
  (anchored `id`s + `:target` highlight). Render each schema with the field-card
  widget below, not a raw `<pre>` dump.
- **Show matched *and* rejected.** For "how is X selected" topics, include an
  explicit rejection (with reason) and the missing-data → not-guessed case, so
  "in" and "out" are equally visible.

Anti-pattern — **one spine, walked once.** If a page has a step sequence, render
it as exactly one interactive "show" surface. Don't add a second parallel
walkthrough of the same sequence; let other lenses differ in *shape*, not repeat
the spine. Repetition is most of what makes a page read as flat.

### Standardized schema field-card widget

The `Schema` appendix should use one reusable, data-driven widget so every page
renders schema samples the same way — never hand-formatted `<pre>` dumps. Drive it
from a small JS array and one `renderSchema()` that fills anchored containers.

Field-row shapes (keep the renderer small): `{k,v}`; `{k,v,note}` (gray one-line
comment); `{k,v,enum:[...]}` (allowed options as chips, active one highlighted);
`{k,v,plain:true}` (sans, not mono, for reader-language text); `{k,list:[...]}`
(list-valued as left-bordered rows, with a trailing `+N more` for honest
truncation). Card chrome: a head (mono type name + tagline), an optional
provenance line (the real artifact path), the rows, an optional foot. Escape
`<`/`>` in `innerHTML` text. Collapse to one column on mobile. Copy this widget
forward rather than re-formatting `<pre>`.

## Iterating on a big structural change

When the right structure is a judgment call, build **two or three labeled variants
in one preview** and let the user pick before committing. Reuse the real page's
`<head>`/`<style>` verbatim and append only a variant `<body>`; keep them as
throwaway `docs/background/_*-preview.html` and delete once chosen. Bake the
cross-cutting asks into the variants so the choice is about *structure*, not
polish. Do the language pass last, after structure settles.

## Safety reminders

When the topic touches an authority/safety boundary the repo declares:

- State who owns the human gate.
- State who may view but not act.
- State which object is the source of truth.
- State what becomes a review prompt rather than a direct instruction.
- State how the current version can be reconstructed.
