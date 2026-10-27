# Review surface

One report contains **UI map** and **UX journeys**. The map's tree and table
inspect the same component records. Findings and proposals stay beside the
component or journey step they concern.

## Terms

| Term         | Meaning                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------- |
| Component    | A named UI part with one identity across states and proposals.                                 |
| Region       | A component that contains other components.                                                    |
| Leaf         | A component without children.                                                                  |
| Peer level   | Components shown together within one visual context.                                           |
| Context view | The capture, crop and scale used to understand a region and its peers.                         |
| Capture      | An image of an observed, fixture or proposed state.                                            |
| ROI          | A component's region of interest within a capture. It is distinct from the wider context view. |

Region/leaf describe navigation depth; **nature** describes a component's
purpose. A **state** is a rendered condition, such as a closed or expanded
disclosure. A capture records that condition; a proposed image illustrates a
suggested state.

## Inspection rules

- Begin with a resting **Overview**. Selecting a region reveals its children;
  selecting a leaf highlights it in the parent's context view. Preserve capture,
  crop and scale when the current view already contains the leaf. Change capture
  only to reveal an unavailable state. Explicit visual ownership may use another
  ancestor when the inventory parent is not the useful context.
- Cap magnification at 1.5× logical size, including comparisons. Small controls
  keep toolbar or parent context. Focused state captures replace repeated whole
  windows; separate full-width/actual-size routes add no inspection value.
- Use quiet neutral report chrome. Every displayed peer has its own outline and
  compact ID, including regions. Blue marks peers; yellow marks active/changed
  components. Show one level at a time so parent hit targets do not cover
  children.
- Keep names off the image pixels. Hover/focus updates an attached bottom-left
  caption with ID/name and opens the text info card. Selection keeps the
  identity available. Cards allow pointer travel, leave their trigger clickable
  and dismiss with Escape. Failed or missing captures identify the current
  target and never retain a previous target's caption.
- **Tree:** the image is primary; hover/focus reveals text. **Table:** text is
  primary; the left pane filters search, nature, region and proposed changes.
  Rows show name/nature, purpose/actions, state/location and a preview cue.
  Hover/focus shows the component highlighted in its context; click/tap pins the
  image in the table. Long source and instance details stay behind a disclosure.
- Put **Covered** and **Missing** bullets in one collapsed **Coverage**
  disclosure, with source/build/capture provenance one level deeper. An overview
  may be small; the chosen context must remain useful at the user's panel width.
- Journey overlays highlight the active step's components. Their crop must match
  the step's actual before/after state, rather than showing unrelated root
  peers.
- Use host browser annotations. Resolve feedback against revision, view,
  component, state and journey step; keep dispositions in the round README. The
  report has no second comment form or export system.

## Comparison rules

The local **Changes** strip names authored findings. Offer comparison only for a
change affecting the selection or its descendants, not every component present
in a proposed capture. Closing Changes closes its comparison.

Label **Before** and **Proposed**, explain what to look for, and mark changed
ROIs with the same IDs in both images. Frame related parts together: a spacing
change needs both neighbors. Match state, framing and logical scale, accounting
for capture density. Record dimensions/density before a comparison is ready;
incomplete reports visibly identify unverified scale. Keep proposed pixels
labelled as a model.

Distinguish observation, current impact, proposed benefit and trade-off. A
negative finding is not itself a benefit. Keep wider context reachable from
Overview. A comparison may stack at narrow widths; it must remain readable and
truthful.

## Inline data

Populate the scaffold's `review-data` JSON from inspected evidence. One record
owns each component ID across tree, table, journey and finding.

- `revision`, `scope`, `baseline`: identity, inclusions/exclusions,
  source/build, capture time, viewport and fixture/live origin. `covered[]` and
  `missing[]` hold short display bullets; `coverageGaps[]` holds full
  `{scope, reason}` limits.
- `overviewScreen`: current capture ID for the resting overview. Each
  `screens[]` record has `id`, `name`, `kind` (`current` or `proposed`),
  `image`, `coverage` and `marks[]`. Optional `role` is `overview` or `detail`;
  `shortName` names a local state. `focus` is a contextual `{x,y,w,h}` crop in
  capture percentages. `note` supplies supplemental context in the source
  badge's tooltip; `origin` labels Capture/Fixture/Model. A proposed screen's
  `basedOn` names its current counterpart.
- Comparison captures require pixel `width`, `height` and `pixelRatio` (device
  pixels per logical point). Match logical scale rather than independently
  stretching each crop to fill its pane.
- Each mark has `element` plus `{x,y,w,h}` percentages of the complete capture,
  even when cropped. Legacy `labelX`/`labelY` remain accepted input; the current
  frame places compact IDs automatically. Reconcile regions and children
  manually; record repeated patterns and exceptions in the component's
  `instances`.
- `elements[]`: `id`, `name`, `parent`, `location`, `purpose`, `nature`,
  `facts[]`, `actions[]`, `reveal`, `source`, `instances`. Nature is
  `container`, `navigation`, `control`, `content`, `metadata`, `status` or
  `region`. Optional `screen` chooses a current capture; `states[]` lists
  meaningful local states. `focus` supplies a region's context crop. Optional
  `view` names an ancestor owning visual context; leaves default to their
  parent. Sibling selection preserves that context.
- `journeys[]`: `id`, `name`, `goal`, `start`, `success`, `steps[]`. A step has
  `name`, `screen`, `elements[]`, `before`, `cue`, `action`, `after`,
  `deferred`, `recovery` and optional `focus`. Distinguish observed and
  simulated transitions.
- `findings[]`: `id`, short `title`, `kind`, `elements[]`, `screen`, optional
  `journey` and zero-based `step`, `evidence`, `effect`, `proposal`, `status`.
  `effect` is current impact; optional `benefit` and `tradeoff` describe the
  proposal. `proposedScreen` links the comparison; `changedElements[]` narrows
  highlights to changed parts. Comparisons require `beforeLabel`, `afterLabel`
  and `lookFor`. Preserve IDs' meaning; record splits/merges explicitly.

A faithful HTML reconstruction may bind these records to its real components. It
remains a discussion model, not live product acceptance.

## Ready to show

For the capture-based frame:

```sh
python3 /path/to/ui-discussion/scripts/validate.py /absolute/round/index.html --stage ready --json
```

Use `--stage structure` during spatial authoring or when journey work is
explicitly deferred. Existing journeys need not be rewritten for a UI-only
report refinement.

Validation checks captures, IDs, parent/view ownership, ROI/crop bounds, local
states, journey targets and comparison references/scale/guidance. Readiness also
requires named source owners, coverage and complete primary journeys/findings.
Results are `ready`, `ready-with-gaps`, `blocked`, or `structurally-valid` for
the structural stage. Blocking diagnostics exit 1 and identify the field and
repair. Gaps never waive required evidence. The SHA-256 binds HTML bytes, not
external captures, the installed app, usability or acceptance.

Inspect the render: overview, folding, stable sibling context, visible peer
cues, caption placement, table filters/previews/pinning, keyboard/touch access,
journey markers, comparison framing and close behavior. Exercise missing/failed
captures; check responsive ROI alignment and prevent overlays from blocking
child targets.
