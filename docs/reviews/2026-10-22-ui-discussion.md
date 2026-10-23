# UI discussion: spatial decomposition before journeys

The user's correction on 22 October establishes the intended workflow:

1. Decompose the actual layout exhaustively within explicit scope. Name regions
   and child components so developer and agent can point to the same things.
2. Define primary user journeys using those same component IDs.
3. Apply the UI/UX guide to repeated facts/features, scattered functions,
   unnecessary steps, discoverability and deliberate progressive disclosure.
4. Discuss improvements or redesign while keeping the current-state map visible.

## Evidence and failure

- Original reference: [Map repo-kit architecture](codex://threads/01a15d55-f2a3-7903-9f77-e4f0cf37dd78)
  and its [preserved round](../design/repo-canvas/2026-10-21/README.md).
- Failed application: [Review MCP example UI](codex://threads/01a16371-015f-70c2-b3fa-9cd05f096740).
  Its [retired trial](../design/example-mcp-app/2026-10-22-presentation/README.md)
  improved a Tools/Messages prototype but started from eight broad element groups.
  It did not first establish a faithful, exhaustive current-layout inventory.
- The original skill requested only “meaningful” regions and supplied generic
  navigation/action/result cards. Those defaults encouraged a journey-led rewrite.

The correction is to the reusable procedure, not a retroactive rejection of every
product choice in that draft. Its concise trial record remains; superseded prototypes were removed after implementation.

## Delivered correction

The command remains `ui-discussion`; its display name is **UI/UX anatomy review**.
The skill makes spatial coverage the first completion boundary, then maps temporal
steps and disclosure. The empty scaffold requires inspected content rather than
inventing a starter application. It supports actual captures with component labels,
an inventory, linked journey states, overlap candidates and evidence-led findings.
Faithful HTML reconstruction remains supported for interactive proposals.

The validator checks references, parent chains, capture paths and marker geometry.
It rejects an empty map but cannot prove semantic completeness or usability. The
same IDs connect elements, states, steps and feedback; drafts preserve their target
across navigation. Current and proposed states stay distinct.

## Verification scope

A disposable trial used the actual standalone Example MCP App fixture surface at
1280 × 720. It mapped 27 setup components, including container children and each
navigation entry, plus seven outcome components across two captures. Its bounded
journey covers launching and reading an echo fixture outcome. Lower trace lanes,
footer, other journeys and live-host states are explicitly excluded. This is a
scaffold trial, not an app-wide audit or an independently delegated evaluation.

Browser checks exercised marker selection, shared inventory, journey transitions
and participant highlights, overlap candidates, and feedback retaining its initial
screen/element/step after navigation. Selectable JSON is the verified export path;
download completion is not claimed. Root tests cover scaffold preservation and
invalid mapping references/geometry. Skill validation, locked bundle verification,
and pinned Python lint/format checks apply to the final source.

The shared [UI/UX guide](../../user/practices/ui-ux.md) remains the owner of general
design judgment. This skill owns the review sequence and artifact mechanics;
product code, design intent, terminology and decisions retain their existing owners.
