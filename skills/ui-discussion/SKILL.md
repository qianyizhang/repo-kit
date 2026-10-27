---
name: ui-discussion
description:
  Decompose an app into an exhaustive visual UI map and step-by-step UX
  journeys, establish shared names, audit duplication and progressive
  disclosure, then discuss redesign. Use for complex web, native and MCP app UI
  reviews; simple cosmetic fixes do not need a round.
---

# UI/UX anatomy review

Build shared understanding on two dimensions: **spatial layout (UI)** and
**temporal behavior (UX)**. First show what is on the actual screen and name its
parts. Then trace what the user does through those parts. A user story states a
goal; a journey records the steps, cues and state changes that accomplish it.

Deliver one annotated review with **UI map** and **UX journeys**. The
[review-surface contract](references/review-surface.md) owns the shared terms,
inspection rules, comparison requirements and data schema. Keep inventory and
findings inside those views. A prose digest or isolated happy-path prototype
does not establish the required common ground.

## Recover context and scope

Read current source/design owners, vocabulary and any still-active review
bundle. Read `user/practices/ui-ux.md` in repo-kit, or the installed
`$CODEX_HOME/practices/ui-ux.md` elsewhere; follow the target repository's UI
guide when it has its own binding. For MCP apps also read the applicable host
guide. Keep the app's domain terms; propose clearer names only when current
terms confuse.

Default to the whole named app. Identify its surfaces, states and viewports,
then inspect the rendered product and its source. Include menus, overlays,
disclosures and conditional controls by opening them safely. If a full review
needs multiple rounds, first show the surface inventory and propose staged
coverage; keep the remaining surfaces explicitly pending. A bounded slice
follows user-selected scope or an explicit access limit, not a preference for
the easiest journey. Group included and missing coverage as short bullets in one
collapsed disclosure. Keep the source/build evidence available inside it. A
source-only map remains provisional. Use safe fixtures; distinguish fixture,
test host and live.

Use the repository's temporary artifact home, otherwise
`.artifacts/ui-discussion/<app>/<date>-<topic>/`, excluded from Git. Resume the
same bundle for feedback on the same baseline. Keep only revisions needed for an
open decision; the bundle links current source/design owners. Dates use the
user's timezone. Create the bundle with:

```sh
python3 /path/to/ui-discussion/scripts/scaffold.py \
  --repo /absolute/repository --app app-name --date YYYY-MM-DD --topic anatomy
```

The scaffold starts empty. Populate it from the current product; keep one
resting overview and contextual inspection rather than repeated whole-window
states. Use host browser annotations for feedback; the report needs no comment
system. For native reviews, capture with the available computer-use API and open
this report in the in-app browser. A separate full-width screenshot wrapper adds
no value when a component-focused detail view already makes the pixels readable.
For an MCP App, add `--mcp` and read
[the integration supplement](references/mcp-integration.md). It adds a linked
page for every registered tool, server-operation mapping, exact conversation
fixtures, ordered data flows, logs and standalone behavior. Use the `mcp-app`
skill when implementation or integration repair is part of the request.

## 1. Map the spatial UI exhaustively

Preserve the current layout's positions, grouping and hierarchy in a faithful
HTML reconstruction or a captured screen with clickable overlays. Put stable IDs
on the actual components, linked to the integrated navigator and detail pane.
Keep review controls visually outside the product. A list of descriptions beside
an unrelated mockup cannot substitute for this map.

Inventory every distinct visual component in the scoped states: containers,
navigation, controls, labels/values, status indicators, content, contextual
tools, hover/popover content, dialogs and footer utilities. Containers do not
account for their children. Group repeated instances only when they share
purpose and behavior; record count/location and exceptions. Give distinct
controls separate ROIs; expose short info cards on hover/focus and the same
details by selection. Decorative pixels need no separate entry.

For each component record ID, shared name, parent/location, visible
content/facts, actions, purpose, visibility/reveal condition, source owner and
observed states. Use the same IDs in labels, inventory, journey steps, findings
and feedback. Name unknown parts descriptively and mark uncertain meaning; do
not invent purpose.

Sweep each screen from top to bottom and through its hidden surfaces. Reconcile
visible components with the inventory. Record mapped, uninspected and excluded
parts; automated counts are only a consistency check, not proof of completeness.
The developer must be able to point to any scoped visual component and name it.
Use this map immediately to identify spatial duplication under the UI/UX guide;
carry those findings into the combined audit after tracing journeys.

**Spatial map ready:** all scoped visual components are accounted for, or
specific coverage gaps are visible; the actual arrangement and shared vocabulary
can be reviewed before redesign. Continue to journeys without a mandatory
approval stop.

## 2. Define primary user journeys

Identify the user's primary goals from the request and product evidence. State
actor, starting context and success condition, then map the main journeys onto
the component IDs. Separate a user goal from a menu category or feature list.

For each step show what is visible **before**, the cue that suggests the next
intentional action, the component acted on, what changes or is revealed
**after**, what stays deferred, and the next action or recovery. Show the
corresponding layout state and highlight the participating IDs. Include
consequential alternate, error, back/cancel and interrupted states; label
simulated transitions honestly. Record observed action counts when comparing
routes; do not invent click savings.

**Journey map ready:** each primary goal has a start-to-success path through the
spatial map, with discoverable next actions and explicit state transitions.

## 3. Audit both dimensions together

Apply the UI/UX guide to the mapped evidence. Link each finding to element IDs,
state and journey step, with a concrete effect and a possible improvement. For
each exercised check, name the state, action and observed result. Use the
guide's concrete checks after mapping; mark untested runtime behavior
unverified. Group repeated symptoms by their shared cause and rank by user
impact.

- Compare facts and actions across regions and states. Flag duplicate
  information, duplicate feature entry points and ambiguous terms. Distinguish
  purposeful alternate access or essential context from redundancy; record the
  reason.
- Follow the task across the layout. Identify scattered related functions, hard
  navigation, context switches, dead ends and avoidable steps. Compare a simpler
  route while preserving necessary review, recovery and user control.
- Test progressive disclosure at each transition: enough visible cues to show
  what the user can do, detail revealed by deliberate advancement, and retained
  context to understand where they are. Hiding everything is not simplification.
  Hover previews need keyboard/touch access; consequential actions remain
  deliberate.

Keep observations, inferred problems and proposed solutions distinct. Structural
coverage and interaction tests do not establish usability by themselves. The
user can correct vocabulary, challenge findings or request a larger redesign.

## 4. Discuss and revise

Present the current map and primary journeys before or beside proposals. The
tree and table are two views of the same inventory, not separate review
destinations. Use local change highlights and aligned current/proposed detail
comparisons; carry IDs across revisions and explain splits/merges. Build the
proposed layout in its real spatial context, with state changes that let the
user assess the journey. Do not replace the current map with the proposal or
turn every part into a generic text card.

Resolve host annotations against the report revision, current/proposed view,
element, state and journey step where applicable. Reconcile feedback into
accepted, revised with reason, declined or open decisions. Ask only unsettled
choices; clear acceptance stays locked. A discussion-only request ends with a
reviewable proposal. An authorized implementation continues through the existing
code owners and required verification. Installation and live-host acceptance are
separate from prototype/source checks.

Close with coverage, findings, dispositions, changed elements, verification
limits and the next step. Code/tests/tokens own implemented behavior; existing
design and glossary owners hold accepted intent and terms. A defect does not
rewrite intent. Promote accepted decisions and unresolved work to existing
owners, then delete spent review bundles under the repository's artifact rules.
A requested final review may remain one bundle for its named use; there is no
permanent round archive. Future reviews start from current owners and code.

Before handing off a populated capture-based round, run the readiness diagnostic
command in
[the review-surface contract](references/review-surface.md#ready-to-show). Clear
blocking diagnostics, disclose named coverage gaps, then inspect the render. Use
the structural stage while the spatial map is still being authored. A passing
check verifies recorded requirements, not usability or human acceptance.
