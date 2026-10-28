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
  caption with ID/name and opens the text info card. Hide the on-image ID badge
  and clear the fill while hovered or focused so the underlying pixels remain
  readable; keep the outline and caption. Selection keeps the identity
  available. Cards allow pointer travel, leave their trigger clickable and
  dismiss with Escape. Failed or missing captures identify the current target
  and never retain a previous target's caption.
- **Tree:** the image is primary; hover/focus reveals text. **Table:** text is
  primary; the left pane filters search, nature, region and proposed changes.
  Rows show name/nature, purpose/actions, access path and a preview cue. Access
  paths name actual user-facing entry points and reveals, not layout coordinates
  or repeated visibility prose; note only meaningful conditions such as
  scrolling or blocked input. Hover/focus shows the component highlighted in its
  context; click/tap pins the image in the table. Long source and instance
  details stay behind a disclosure.
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

The local **Changes** toolbar groups **Original** and authored proposals with
**In place** and **Pair** modes. Offer only changes affecting the selection or
its descendants. Closing Changes returns to the normal context view.

Default to **In place**: switch Original/proposal in one registered frame, with
the same crop, scale and canvas size. Keep controls mounted and reserve image
space before loading so switches retain the viewport and keyboard focus.
**Pair** shows both states; choose columns or stacked rows from the crop's
aspect ratio and available space, keeping text readable. A wide, shallow crop
usually stacks; a tall crop usually uses columns. Window width alone is
insufficient.

Mark changed ROIs with the same code-styled IDs in both images. Frame related
parts together: a spacing change needs both neighbors. Match state, framing and
logical scale, accounting for density. Dimensions/density are readiness data;
show only an unverified-scale warning when missing, not a success badge. Label
Original and Proposed; identify the proposed image as a model. Ordinary views
use a plain image-context label, such as **Image: Answer reader**.

Comparison overlays use the attached caption for identity, leaving the images
and reasoning unobstructed by a second info card. Let aligned pixels and
highlights show the change. Show concise reasoning below at normal body size:
**Pro** in green for the benefit and **Con** in red for a material trade-off.
Labels carry the meaning independently of color. Keep a current impact labelled
**Impact** when no proposed benefit is recorded. Evidence, source notes and
authoring instructions remain in the report data, outside the comparison UI.
Wider context stays reachable from Overview.

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
  capture percentages. `note` and `origin` retain source context for authors;
  `origin` distinguishes Capture/Fixture/Model in the evidence record. A
  proposed screen's `basedOn` names its current counterpart.
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
  parent. Sibling selection preserves that context. Optional `accessPath[]`
  names the ordered entry points/reveals needed to reach the component, omitting
  the target already named by its row; an empty path means directly available.
  `accessNote` holds a specific condition such as scrolling or required input.
  Unmapped routes stay explicitly unknown rather than inferring click depth from
  inventory parents.
- `journeys[]`: `id`, `name`, `goal`, `start`, `success`, `steps[]`. A step has
  `name`, `screen`, `elements[]`, `before`, `cue`, `action`, `after`,
  `deferred`, `recovery` and optional `focus`. Distinguish observed and
  simulated transitions.
- `findings[]`: `id`, short `title`, `kind`, `elements[]`, `screen`, optional
  `journey` and zero-based `step`, `evidence`, `effect`, `proposal`, `status`.
  `effect` is current impact; optional `benefit` and `tradeoff` describe the
  proposal. `proposedScreen` links the comparison; `changedElements[]` narrows
  highlights to changed parts. Legacy `beforeLabel`, `afterLabel` and `lookFor`
  remain optional author notes; the viewer uses images and highlights. Preserve
  IDs' meaning; record splits/merges explicitly.

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
states, journey targets and comparison references/scale. Readiness also requires
named source owners, coverage and complete primary journeys/findings. Results
are `ready`, `ready-with-gaps`, `blocked`, or `structurally-valid` for the
structural stage. Blocking diagnostics exit 1 and identify the field and repair.
Gaps never waive required evidence. The SHA-256 binds HTML bytes, not external
captures, the installed app, usability or acceptance.

Inspect the render: overview, folding, stable sibling context, visible peer
cues, caption placement, table filters/previews/pinning, keyboard/touch access,
journey markers, both comparison modes, adaptive pairing, stable switching and
close behavior. Exercise missing/failed captures; check responsive ROI alignment
and prevent overlays from blocking child targets.
