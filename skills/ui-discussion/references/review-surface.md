# Review surface

The scaffold is a review frame, not a proposed product design. Populate its inline
`review-data` JSON from inspected evidence. Keep one record per component and use
IDs to join the spatial map, inventory, journeys, findings and feedback.

## Current layout

Use a faithful rendered reconstruction when interaction matters, or screenshots
with positioned overlays for initial decomposition. The bundled frame supports
the latter: each `screen.image` is a relative capture path or embedded data URL;
`marks` contains `{element, x, y, w, h}` rectangles as percentages of that capture.
Optional `labelX` / `labelY` place a badge within its rectangle (percentages);
use them to avoid overlapping parent/child labels. Keep the full layout legible. Inspect a viewport crop at its original aspect ratio;
use additional captures for scrolled/hidden states rather than squeezing an entire
long page into one unreadable image. One capture can represent multiple journey
steps only when its visible state actually matches them.

For an HTML reconstruction, replace the screenshot stage with the real layout and
bind its markers to the existing selection function. Preserve the same inventory
and step links. Review badges belong to the review frame; production controls keep
their original meaning. A reconstruction is still a model, not live acceptance.

## Inline data

- `revision`, `scope`, `baseline`: identity, explicit scope/exclusions, source/build
  and capture provenance. An empty scaffold visibly reports incomplete coverage.
- `screens[]`: `id`, `name`, `kind` (`current` or `proposed`), `image`,
  `coverage` (manual reconciliation and gaps), `marks[]`. Mark both regions and
  their child controls. Repeated-instance coverage belongs in the element record.
- `elements[]`: `id`, `name`, `parent`, `location`, `purpose`, `facts[]`,
  `actions[]`, `reveal`, `source`, `instances`. Use stable fact/action names so
  the audit can find candidate overlaps; identical wording alone proves no defect.
- `journeys[]`: `id`, `name`, `goal`, `start`, `success`, `steps[]`.
  Each step has `name`, `screen`, `elements[]`, `before`, `cue`, `action`,
  `after`, `deferred`, `recovery`. A step selects its actual screen and highlights
  participating elements; use screenshots of successive states or model the real
  transitions in HTML. This is a temporal walkthrough, not a feature taxonomy.
- `findings[]`: `id`, `kind`, `elements[]`, `screen`, optional `journey` and
  `step` (zero-based), `evidence`, `effect`, `proposal`, `status`. Cite the guide
  criterion in `kind` or evidence; retain a justified duplication when needed.

Only populate inspected content. Do not import the old scaffold's navigation /
action / result regions as an inventory. The observed product determines granularity.
Review each mapped parent for missing children before claiming exhaustive coverage.

## Feedback and proposals

The frame offers Layout, Inventory, Journeys and Audit views. Current/proposed
screen choices preserve the baseline. A proposal may introduce/remove components,
but record the mapping and rationale rather than silently reusing an ID for another
meaning. Source links identify current implementation; proposal status is separate.

Comments freeze the revision, view, screen kind, element and journey step at first
input. Exported selectable JSON is a transport, not the decision owner. Reconcile
material feedback into the round README. Preserve reviewed captures and exports
needed to interpret decisions; do not accumulate private logs or redundant copies.

## Ready to show

For the bundled capture-based frame, run
`python3 /path/to/ui-discussion/scripts/validate.py /absolute/round/index.html`
to check captured-image paths, IDs, parent chains, marker bounds and journey/finding
references. It deliberately rejects an empty scaffold. It does not certify visual
coverage, source accuracy or design quality.
For a faithful HTML reconstruction, use its DOM/component checks for these links
and inspect the render; the capture validator expects images and rectangle overlays.

Confirm screen images load, marker bounds match the captured components, inventory
and parent IDs resolve, and every journey step resolves to a screen and elements.
Inspect the actual rendered page at useful widths. Check marker/list keyboard
selection, step navigation, overlap findings and comment context across changes.
The page must show gaps truthfully. A valid empty scaffold is not a completed review.
