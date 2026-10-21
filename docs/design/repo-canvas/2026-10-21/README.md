# Repo Canvas interaction redesign

Status: reviewed prototype; implementation decisions settled on 2026-10-21.

Open [the annotated HTML prototype](index.html) to explore eleven states, element
commentary, the information-ownership table, and the current-UI audit. The
[design specification](design.md) records the interaction rules and the second
review's contextual authoring and grouping changes. `evidence/` contains the four screenshots used by the embedded audit and two separately labelled implementation captures.

The snapshot was preserved on 2026-10-21 from the local design review in chat
`01a15d55-f2a3-7903-9f77-e4f0cf37dd78`. Its baseline implementation was `435c554`.
The user reviewed the browser prototype and requested its preservation in this
repository before a design interview and implementation.

## Use

Open `index.html` in a browser, or serve this directory on loopback:

```sh
python3 -m http.server 53628 --bind 127.0.0.1 --directory docs/design/repo-canvas/2026-10-21
```

Choose an available port if the original review server is still using 53628.
The prototype needs no installation or external assets. Copy-to-clipboard may
depend on the browser context; request export is the fallback. Review comments
are stored by browser origin, not embedded in this snapshot; moving to another
origin does not transfer those comments.

## Interpretation

- The prototype demonstrates local UI state. It does not write repository files,
  contact a model, or send host messages. Contextual feedback offers copy/export.
- It is a review reference, not production code to transplant or a replacement
  for the current [Canvas design contract](../../../../plugins/repo-workbench/docs/canvas-design.md).
- Preserve the approved information and interaction behavior while implementing
  it through the real document model, source boundary and host protocol.
- This archive lives outside the executable plugin package so its HTML and audit
  images do not ship as runtime assets.

## Settled direction

One visible owner per fact; readable cards and details; hover-to-pin interactions;
explicit editing; collapsed chat history; declarative repository-owned node
types; line-block source reading and reviewed inline edits; contextual object
menus; parent-first navigation and leaf-to-parent creation; groups independent
of hierarchy with dim/hide focus; editable risk/warning/info notes with Undo;
and frozen context for instructions queued to the owning agent chat.

The design interview settled v3-only loading (offline repair or start fresh), revision-checked referenced source edits, private durable discussion state per repository/chat, explicit type-value migration review, and scope-local overlapping groups without automatic spatial lanes. The current design contract owns those implementation rules; this HTML remains the reviewed snapshot.


## Initial implementation verification

The refactor implements the reviewed flows in `plugins/repo-workbench/packages/repo-canvas`.
See the [current design contract](../../../../plugins/repo-workbench/docs/canvas-design.md)
for format, storage and conflict rules. The original HTML remains a design reference.

- [Desktop implementation](evidence/05-implementation-desktop.png) and
  [mobile implementation](evidence/06-implementation-mobile.png) show a disposable
  test repository, not the user's saved map. Source: `ui/redesign.spec.ts`.
- `npm run check` passed: formatting, lint, typecheck, build, **34 Canvas unit tests**,
  and **42 other tests**. The loopback test skipped in the sandbox subsequently
  passed in a focused approved run (**10 usage tests**, no skips). The opt-in native
  Codex installation test was not run.
- The full browser suite passed **32 tests**. After the final edit-conflict guard,
  all **8 Canvas browser scenarios** passed, including the new concurrent-edit test.
  Host tests use the repository's simulated MCP host with disposable browser profiles.
- Build/package behavior is verified; installation into the active Codex plugin and
  native desktop message acceptance remain unverified. At that checkpoint, no installation, commit or
  push had been performed. The existing `.repo-canvas/architecture.json` was left intact.


## Reviewed release 0.3.0

The closeout review removed obsolete card, inspector and toolbar styles, and
consolidated custom-field editing so Unset removes boolean/enum values correctly.
It also scoped migration approval to each individual proposal, blocked removal
from stale group editors, stopped note editing from repeating the reading card,
and prevented a racing cancellation from replacing an arriving answer. Source
saves preserve file permissions independently of the process umask.

Verification: formatting, lint, typecheck, build and packaged-install checks;
35 Canvas unit tests; 25 non-Canvas browser scenarios plus the final 9-scenario
Canvas rerun. Native Codex discovery/upgrade and all 10 usage tests passed in a
disposable configuration with approved loopback access. No source map is migrated
or committed by this release. Installation and activation of the user's actual
panel are separate from those isolated checks.
