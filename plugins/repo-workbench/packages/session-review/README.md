# Session review

React frontend for recorded conversations and curated artifact review. Usage accounting stays in `usage`.

The ownership path is `trace` (source reading and normalization) → `ReviewDocument` (public contract) → `session-review` (presentation). The trace directory remains the active backend. `usage` serves local records and calls the review builder; it does not own a second trace renderer.

| Home                | Responsibility                                                                       |
| ------------------- | ------------------------------------------------------------------------------------ |
| `src/app/`          | App shell, shared UI controls, URL state, context and source coverage                |
| `src/model/`        | Document contracts, action grouping/classification, review signals and record access |
| `src/conversation/` | Conversation overview and turn inspector                                             |
| `src/actions/`      | Action list/cards, minimap, filters and source sequence                              |
| `src/records/`      | Text loading, safe Markdown/code rendering, native tool content, images and metrics  |
| `src/curation/`     | Authored stories, process maps, revision comparisons and evidence inspection         |
| `src/styles.css`    | Shared visual system and semantic event palette                                      |

Features depend on the model and shared record presentation. ESLint prevents model imports of React and presentation modules. React Hooks rules check the review frontend. Keep direct imports between owning files; do not add forwarding files or a parallel renderer.

Internal adapters use `src/model/contracts.ts` for the document contract and `build.ts` for `renderReview`. Raw sessions need no authored curation. Backend adapters validate and normalize source material before delivery; local record access retrieves byte-pinned bodies without writing to sources.

`npx vite --config packages/session-review/vite.config.ts` opens a development fixture gallery. Choose parallel calls, interleaved edits, questions/replies, compaction or ambiguous relationships to review the expected behavior in the real renderer. Example links use `?fixture=...`; review navigation keeps its existing hash format. The shared source corpus is `trace/review-fixture.ts`, also consumed by delivered-browser tests. Vite middleware normalizes synthetic records in a private temporary directory and removes it when the server closes. No personal logs are read. “Load review JSON” retains the manual document-loading entry.

The gallery and its middleware are development-only. They are not part of the exported review entry, normal local trace pages or offline artifacts. The HTML builder bundles the same `src/main.tsx` into self-contained output with inline CSS, compressed data and no CDN. Artifact files remain adjacent to offline exports.

Plugin formatting, typed ESLint, TypeScript and synthetic/browser tests cover this package. Trace tests and browser journeys cover offline/local delivery, evidence links, safe rendering, lazy bodies, navigation, minimap geometry and mobile layout. User behavior and evidence limits live in the [review guide](../../docs/session-review.md).

## Navigation contract

The URL owns review state. Opening a turn, switching a review view or selecting a different episode adds one browser history entry. Search, agent/type/signal filters, display settings and pagination replace the current entry. Selecting an agent clears dependent turn/record selections; selecting a turn clears dependent type/signal filters. Explicit destinations in a transition override those reset defaults. Back/Forward and direct hash changes restore state and URL-linked evidence drawers. Existing links, including numeric stage fallback and composite action-turn keys, remain valid.

Review changes using the shared examples before adding presentation rules: source records → supported relationship → displayed action → remaining uncertainty. Add a case only for a distinct behavior or failure. Browser journeys assert visible interactions and outcomes, not hidden compatibility controls.
