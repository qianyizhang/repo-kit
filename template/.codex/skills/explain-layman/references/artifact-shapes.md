# Artifact shapes and narrative patterns

Choose the smallest shape that makes the teaching job clear. Do not default to a
long page merely because HTML is the delivery format.

## Shape decision

| Shape | Choose it when | Required contract |
|:--|:--|:--|
| Page | Readers will look up one object, role split, boundary, or stable process | One primary visual and a scannable linear reading order |
| Slides | The argument is cumulative and each idea prepares the next | Addressable slides, visible progress, linear fallback, print and keyboard support |
| Series | Several teaching jobs are independently useful but form a larger story | Numbered map plus explicit incoming and outgoing narrative handoffs |
| Interactive map | One relationship is materially clearer through exploration | Useful default state, keyboard access, no hidden essential content |

## Slides

Use slides for intuition-building, not for slicing a long document into equal
screens. Each slide should perform one move: establish, distinguish, complicate,
connect, narrow, or conclude.

Required mechanics:

- stable `#slide-N` URLs and hash-change handling;
- previous/next controls, arrow-key navigation, and a live progress counter;
- all slides readable in document order without JavaScript;
- `@media print` showing the complete deck;
- narrow-screen layout and `prefers-reduced-motion` handling;
- no essential content available only through animation or hover.

## Series transitions

A series strip answers “where am I?” A narrative handoff answers “why next?”
Every artifact in a series should make three statements legible:

1. **Incoming:** what the preceding artifact established.
2. **This artifact:** the teaching job settled here.
3. **Outgoing:** the unresolved question that motivates the next artifact.

The strip must remain informative when files are shared separately or links
break: show number, short title, and one-line purpose for every item.

## Whole landscape before selected scope

When a project implements only part of a larger domain:

1. show the complete relevant terrain at a useful level of abstraction;
2. label which regions the project builds, integrates, or defers;
3. explain why the chosen focus is valuable;
4. never depict the selected subset as the whole field.

## Fair baseline comparison

Before presenting a new paradigm, state:

- what the baseline did and why it was a reasonable first move;
- what knowledge and runtime authority it gave to people, rules, or models;
- which failure appears with scale, maintenance, assurance, or coverage;
- which authority or responsibility moves in the new design;
- which costs remain rather than implying a free improvement.

## Implementation maps

Do not force every workstream into peer cards. Identify its geometry:

- horizontal lanes accumulate reusable knowledge, cases, or capabilities;
- a vertical integration lane repeatedly assembles compatible end-to-end slices;
- parallel does not mean independent—show the typed handoffs;
- a progressive release may expand **coverage** (where the system applies),
  **capability** (what it can express or do), or both;
- progressive release never means silent mutation: keep version, provenance,
  reproducibility, monitoring, and rollback visible.
