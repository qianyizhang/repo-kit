# Repo-kit audit and Sol handoff

## Start here — next Sol session

Audit baseline: `707b3bd`. The commit introducing this handoff includes the completed fixes listed below. Inspect the current checkout before starting; preserve the separate README, npm install gate and npm install test edits. Installation, consumer updates, pushes and tag publication are outside this handoff.

**Accepted scope:** finish the correctness and verification defects in small tested slices. Exact usage provenance wins over append-only read cost. Sections A–J and the other bounded candidates are proposals, not approved refactors. Keep them for a separate decision. Do not make those changes a prerequisite for safety fixes.

**Already implemented here:** #1 and #6: one worktree writer lock covers map and source saves; validate final UTF-8 size before replacement. External editors do not participate. #4 and the plain-log byte count: verify the complete old prefix before reusing records; changed prefixes reparse; invalidate old persisted indexes and summaries. Tests cover an overlapping second process, stale writes, exact and oversized multibyte files, cached appends, provisional lines, an early edit plus append, and agreement with native SHA-256.

**Verification of this slice:** root `make ci-check` passed. Workbench `npm run check` passed (47 Vitest and 58 Node tests; one opt-in native Codex test skipped). All 53 Workbench Chrome tests passed. The strengthened equal-length prefix-edit regression also passed individually. No hosted CI or installed-plugin verification for these local edits.

**Remaining queue** (numbers refer to the original findings below):

| Order | Work and owner | Acceptance |
|---|---|---|
| 1 | #2 starter operations/adapter; #3 runtime and starter retention | Bind hosted diagnostics to trusted caller metadata and keep standalone explicitly local. Exercise owned reads and denial for absent/foreign principals through the public adapter. Concurrent pruning must not disable healthy persistence; preserve unknown directories, active sessions and genuine storage errors. Verify generated standalone output and refresh the skill lock for reviewed sources only. |
| 2 | #5 Canvas context lifecycle | Provide a caller-bound release, handle stale panel bindings and abandonment, and keep independent drafts safe. Verify capacity is reusable after release, foreign release fails, reconnect does not silently discard a draft. Settle any new eviction or draft-loss policy before implementing it. |
| 3 | #7 skill distribution; #8 document checker | Limit source inventory to intended Git-visible inputs; keep installed drift checks exhaustive. Use one shipped link implementation with explicit repository-only path policy; test fenced examples, broken fragments and rendered consumers. |
| 4 | #9 Copier fixture and gate | Correction: all six smoke-module tests **passed locally** with opt-in enabled. Local tag resolves to `196cbfbc2e749029213fdfd681e2057808db996b`, an ancestor of HEAD; origin did not advertise the tag. Pin the commit and provision its history on template changes. Prove first copy and historical update from a checkout without local tags. Do not publish a tag. |
| 5 | #10 Example keyboard tooltip | Hosted browser step failed at the baseline; the narrow keyboard test **passed locally** against the existing build. Root cause is not established. Test focused-anchor behavior during scroll and pointer exit in a fresh build, preserve Escape, then run the browser gate. |
| 6 | Smaller items below | Correct the offline usage command and remove the unused slug prompt after checking adoption/update compatibility. The byte-count item is already fixed. |

Run narrow failure-path tests first, then the affected package gates and root `make ci-check`. Use the Mac browser guide for UI checks. Record what actually ran; do not reuse the historical totals below as evidence for new code. Keep the handoff until the remaining queue is accepted or explicitly retired.

## Original assessment at 707b3bd (historical evidence)

**There are real correctness bugs here, including silent lost updates. The main structural smell is duplicated ownership: several mechanisms exist in multiple places, and their behavior has already drifted.**

The existing top-level division—personal instructions, shared skills, governance templates, and executable plugins—is useful. The highest-return work is inside those boundaries: consolidate persistence, diagnostics, parsing, and state updates; make the governance ownership rules agree with their implementation.

I audited [`main` at `707b3bd`](https://github.com/qianyizhang/repo-kit/commit/707b3bdf9965e4463d137d7f5b718f3d4d0024ac), covering the delivery scripts, Copier template, executable skills, shared MCP runtime, Example app, and Workbench. Findings below distinguish **reproduced defects**, **static findings**, and **design recommendations**. This was a read-only audit.

---

# 1. Correctness and verification problems

## 1. P1 — Concurrent Canvas saves can silently overwrite accepted changes

**Reproduced.**

`Repository.save()` checks the current revision, writes a temporary file, and renames it over the architecture document. There is no cross-process lock covering that sequence. Separate Workbench processes can both validate the same revision and both report success. [Source: `repository.ts:135–149`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/repo-canvas/src/server/repository.ts#L135-L149)

I reproduced this with eight independent Node processes saving different titles against the same revision:

| Observation | Result |
|---|---:|
| Saves reporting success | 8 |
| Saves reporting a conflict | 0 |
| Final titles retained | 1 |

The test map was approximately 1.44 MB, within the existing 2 MB limit. This affects separate server processes—for example, an MCP server and a standalone server targeting the same repository. Calls within one process are naturally serialized by the synchronous implementation.

**Fix:** place the revision check and replacement inside one process-safe transaction. There is already a suitable pattern in [`DiscussionStore`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/repo-canvas/src/server/discussion.ts#L42-L69), using [`fileTransaction()`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/runtime/file-transaction.ts).

Atomic rename prevents readers from seeing a partially written file. It does not prevent lost updates.

## 2. P2 — The generated MCP starter lacks caller isolation for diagnostic payloads

**Reproduced, conditional on callers sharing one server process.**

The starter discards MCP callback metadata and routes all operations into one process-wide log store. `logs_list`, `logs_event`, and `logs_capture` do not check who owns an event. Ordinary message sends also record observations containing the entered text. [Sources: `server.ts:35`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/skills/mcp-app/assets/starter/src/server.ts#L35), [`operations.ts:195–246`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/skills/mcp-app/assets/starter/src/operations.ts#L195-L246)

Against the built stdio server:

1. Caller A appended a diagnostic event.
2. Caller B listed that event.
3. Caller B read A’s payload.

This does **not** establish that every host shares server processes between chats. It establishes that the starter depends on process isolation without enforcing or clearly declaring that boundary.

**Fix:** carry trusted caller identity through the adapter and operations; assign ownership when appending; enforce it on list, read, and capture. Standalone use can have an explicit local principal.

The production runtime already has ownership-aware lookup. The starter should inherit that behavior through its distribution process.

## 3. P2 — Concurrent log cleanup can disable persistence for healthy processes

**Reproduced.**

Log startup enumerates expired session directories, then inspects and removes them. Another starting process can remove a directory between enumeration and inspection. The resulting `ENOENT` reaches the constructor’s catch block, sets a persistent error, and leaves the new process recording only in memory. [Source: `store.ts:27–118`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/mcp-app-runtime/src/store.ts#L27-L118)

In an isolated fixture containing expired sessions, I started eight processes simultaneously:

- One initialized persistent recording.
- Seven became `memory-only` because another process had removed files they were inspecting.

This applies even when each chat has its own MCP process: those processes still share the app’s log directory.

The starter contains a second copy of the same algorithm. [Source: starter `log-store.ts:22–105`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/skills/mcp-app/assets/starter/src/log-store.ts#L22-L105)

**Fix:** make pruning tolerate vanished entries and idempotent removal. Separate optional retention cleanup from initializing the new writable session.

## 4. P2 — The incremental usage index can publish stale records and an incorrect file hash

**Reproduced.**

The append fast path checks that the file grew, retained its inode/device, and still has the same former trailing 4 KiB. It then reuses the previous parsed records and serialized SHA state. That does not establish that the earlier prefix remained unchanged. [Source: `scan.ts:158–185`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/usage/scan.ts#L158-L185)

I modified an earlier portion of a log on the same inode, then appended a record:

| Result | Warm scan | Fresh scan |
|---|---|---|
| Project metadata | Old value | Correct value |
| SHA-256 matches current file | No | Yes |
| Reported coverage gap | None | None |

The documentation currently promises exact whole-file hashes. [Source: usage integrity contract](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/docs/usage.md#L45-L49)

**Fix:** settle the guarantee explicitly. Exact integrity for arbitrarily modified files requires verifying the old prefix or rescanning. Incremental reuse can remain useful under an explicit append-only assumption, but the resulting provenance must reflect that assumption.

The custom resumable SHA implementation has a real purpose. The defect is insufficient validation before reusing its state.

## 5. P2 — Canvas runs out of contexts after 32 opens, with no usable close operation

**Reproduced.**

Each Canvas context is charged 8 MiB against a 256 MiB registry budget. Overflow rejects new contexts, and idle expiry is 24 hours. Closing the panel does not release its server-side context. [Source: `mcp.ts:40–75`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/repo-canvas/src/server/mcp.ts#L40-L75)

The real MCP implementation accepted 32 opens. Open 33 failed with:

> Session limit reached. Close an unused context before opening another.

Canvas has no operation that performs the requested release. The `maxEntries: 100` setting therefore obscures the effective limit.

**Fix:** implement context release and a policy for abandoned panels. Preserve independent panel state and unsaved drafts when defining expiration or eviction. Raising the limit would only postpone the failure.

## 6. P2 — Source saving can write a file that Workbench immediately refuses to read

**Reproduced.**

Source reads enforce a 500,000-byte file limit. Saves restrict the replacement block, but do not validate the final file size before writing. The UI then reads the file back. [Sources: `repository.ts:168–232`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/repo-canvas/src/server/repository.ts#L168-L232), [`SourceBlock.tsx:90–107`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/repo-canvas/src/ui/SourceBlock.tsx#L90-L107)

My reproduction:

- Original file: **490,006 bytes**.
- Replacement first line: **20,001 bytes**.
- Saved file: **510,001 bytes**.
- Save succeeded; readback failed.

This can present as a save failure after disk contents have already changed.

**Fix:** validate `Buffer.byteLength(next, 'utf8')` before writing. Use the same final-content constraints for read and write.

## 7. P2 — Skill locking can accidentally promote generated files into the distributed bundle

**Reproduced.**

The source inventory recursively reads every file under `skills/`, including ignored build products and caches. `relock()` then treats that inventory as the delivered bundle. [Sources: `skills.py:39–47`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/scripts/skills.py#L39-L47), [`skills.py:382–389`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/scripts/skills.py#L382-L389)

In a disposable source copy, adding an ignored `__pycache__/…pyc` caused:

1. Source verification to fail.
2. Running `lock` to accept the generated cache into `skills-lock.json`.

This makes a normal development byproduct look like a source change requiring relocking.

**Fix:** distinguish **source inventory** from **installed inventory**.

- Source inventory should use tracked files plus deliberate, nonignored additions, or an explicit export manifest.
- Installed inventory should remain exhaustive so unexpected installed files still count as drift.

Changing the shared recursive helper to ignore files everywhere would weaken installation checks.

## 8. P2 — The shipped document checker and the repository’s link tests implement different behavior

**Reproduced.**

The consumer checker scans raw Markdown lines for links. The root test helper separately removes fenced examples and validates heading fragments. [Sources: `check_docs.py:335–356`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/template/scripts/check_docs.py#L335-L356), [`test_skill_links.py:20–60`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/tests/test_skill_links.py#L20-L60)

Consequently:

- A hypothetical link inside a fenced Markdown example is reported as broken by the delivered checker.
- A nonexistent `#heading` produces no error there.
- Root link tests use different semantics.

**Fix:** move the reusable link-analysis behavior into the delivered implementation and exercise that same implementation from root tests. A test helper should not become a second, more capable product implementation.

A mature parser is an option. If keeping the checker dependency-free is important, define and consistently implement the supported Markdown subset.

## 9. P2 — The historical Copier integration suite cannot run from the available repository

**Reproduced.**

The suite hardcodes `v0.10.3` and runs `git archive` against it during class setup. That tag is absent from the remote; the remote tag-reference query returned no tags. Fetching the named tag failed. [Source: `test_template_smoke.py:19, 78–90`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/tests/test_template_smoke.py#L78-L90)

Enabling the documented smoke suite fails before its integration tests run:

```text
fatal: not a valid object name: v0.10.3
setUpClass ... ERROR
```

Normal root CI skips these four tests because the opt-in environment variable is unset.

**Fix:** provide an accessible, immutable historical fixture and run the suite for Copier/template changes. A small checked-in fixture or an explicitly fetched, available revision would make the dependency reviewable.

I separately generated a fresh consumer from the audited commit, bootstrapped its links, and ran its document checker successfully. The historical update verification is the broken part.

## 10. P2 — The Example app currently fails its keyboard-tooltip browser contract

**Observed in same-commit CI.**

The narrow-layout test focuses an event button and expects its tooltip to remain visible. The tooltip stays hidden. The job reports one passed test, one failure, and nine tests not run. [Failed CI job](https://github.com/qianyizhang/repo-kit/actions/runs/44245573332/job/134603585763)

There is a plausible code-level cause: focus shows the tooltip, while every captured scroll event hides it. Focusing an offscreen button can scroll it into view and immediately hide the keyboard preview. Pointer-out also dismisses without considering whether keyboard focus still owns the preview. [Source: `view.ts:68–99`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/example-mcp-app/src/view.ts#L68-L99)

**The failure is confirmed; that precise explanation remains an inference.** Local Chromium failed before page load because this environment blocked its socket creation.

**Fix direction:** give tooltip visibility one owner—the active focused/hovered anchor—and reposition or preserve keyboard previews during scrolling.

### Smaller definite problems

| Problem | Evidence | Small fix |
|---|---|---|
| Plain-log byte counts are rounded down to a SHA block boundary. A 5,321-byte file was reported as 5,312 bytes. | [`scan.ts:299–300`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/usage/scan.ts#L299-L300) | Use the actual scanned byte position for `Source.bytes`; retain the aligned count only in the hash cursor. |
| Offline recovery instructions tell users to run nonexistent `npm run usage:dashboard`. | [`evidence.ts:60–70`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/usage/browser/evidence.ts#L60-L70) | Use the public `repo-workbench usage --serve` command. |
| Copier asks for `project_slug`, but no template consumes it beyond generic answer recording. | [`copier.yml:57–60`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/copier.yml#L57-L60) | Remove the unused question from future adoption flows. |

---

# 2. The highest-value simplifications

## A. Resolve the contradiction between consumer-owned backlog schemas and kit-owned enforcement

This is the most important **meta-repository** design issue.

The seeded backlog page says it owns the lifecycle and schema. Copier preserves it as consumer-owned. Meanwhile, the managed checker hardcodes:

- Work-item directory.
- ID format.
- Statuses and kinds.
- Required headings.
- Required metadata.
- History and ledger rules.

A consumer can change its supposedly authoritative schema and then fail the kit-managed checker. Some requirements are also declared in configuration and repeated in the checker. [Sources: backlog ownership and shape](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/template/records/work-items/backlog.md.jinja#L9-L80), [checker constants](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/template/scripts/check_docs.py#L43-L53), [checker enforcement](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/template/scripts/check_docs.py#L472-L578)

Choose one ownership model:

| Intended behavior | Consistent implementation |
|---|---|
| Portable lifecycle is fixed by repo-kit | Put its schema in a managed owner; seed only actual repository bindings. |
| Consumers may customize lifecycle/schema | Make the checker consume those local bindings. |

My preference is the first where the lifecycle is genuinely shared. It creates less configuration machinery. Consumer-specific tags, paths, and conventions can remain local.

## B. Give trace data a neutral domain owner

Canonical trace types and validators live inside `session-review/src/model`, while trace ingestion, reports, and usage import them. Other dependencies point back toward reports, and unrelated reports code gets global build identity through Canvas. [Sources: trace contracts](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/trace/contracts.ts#L1-L7), [usage composition](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/usage/build.ts#L1-L23), [reports session imports](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/reports/session.ts#L1-L8)

The directories look like separate packages, but their dependency direction does not consistently reflect ownership.

A clearer division would be:

| Concern | Recommended owner |
|---|---|
| Trace contracts, normalization, pinned record access | `trace/` |
| Recorded-session presentation and authored curation UI | `session-review/` |
| Token accounting, scanning, usage summaries | `usage/` |
| Combining trace and usage into report sessions | `reports/` |
| HTTP/MCP composition, build identity, process infrastructure | `runtime/` |

This can be an internal refactor within Workbench. Moving files is useful only when it removes the reverse dependencies and establishes an obvious owner.

## C. Parse each recorded wrapper once

One recorded `functions.exec` body is passed through four analyses:

1. `wrapperTools()`
2. `semanticOperation()`
3. `commandHashes()`
4. `toolSignatures()`

Each builds a new TypeScript syntax tree. Their recognition policies already differ: some require a `tools.*` receiver; others recognize matching method names on arbitrary receivers. [Sources: common call site](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/trace/jsonl.ts#L564-L579), [two of the repeated parses](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/trace/tool-signatures.ts#L54-L104)

Replace them with one narrow analysis function returning:

```ts
{
  commands,
  literalToolCalls,
  dynamicToolCalls,
  operationHints,
  concurrencyEvidence
}
```

Downstream linking can remain separate. This removes repeated parsing and gives call recognition one owner. Preserve the current refusal to execute recorded code or invent ambiguous relationships.

## D. Freeze the selected evidence instead of cloning the entire report

A usage selection stores the complete snapshot plus selected rows. A trace selection stores the complete document plus selected events. The immutable helper clones the whole value. [Source: `selections.ts:72–145`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/reports/selections.ts#L72-L145)

In a fixture selecting one row from 1,000 records:

| Material | Size |
|---|---:|
| Selected row | 252 bytes |
| Stored selection value | 251,264 bytes |

Some additional provenance is necessary, but retaining all 1,000 records is not. The registry’s aggregate budget is 128 MiB, so small selections can cause unexpectedly early eviction.

Use a compact frozen selection containing selected rows/events, their source metadata, relevant coverage, filters, and pinned references for lazy reads. The existing provenance methods already filter to selected sources.

This improves memory use, serialization cost, and conceptual clarity simultaneously.

## E. Give diagnostic storage and privacy policy one source

The production runtime and starter separately maintain nearly identical filesystem mechanics:

- Recognized session directories.
- Inactive-process checks.
- Seven-day/eight-session retention.
- Rotating JSONL.
- Capture limits.
- Permissions.
- Storage health.

They also maintain credential-redaction rules separately. The cleanup race exists in both implementations, while caller isolation has drifted. [Sources: runtime storage](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/mcp-app-runtime/src/store.ts), [starter storage](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/skills/mcp-app/assets/starter/src/log-store.ts)

**Recommended approach:** maintain shared mechanics in one source and emit a standalone copy during scaffold generation, with an equivalence check. Keep the starter’s simpler event collector where that difference helps teaching.

Independent distribution is a useful requirement. It does not require independent maintenance of identical security and persistence behavior.

## F. Make the Canvas reducer own semantic edits

The reducer handles draft history, but components construct whole replacement documents. This becomes unsafe when a callback crosses an asynchronous operation.

A specific static finding: source save awaits the server, then calls the old `onReferenceChange` callback. Its callers use captured document/module state. A newer map edit can be replaced by the earlier state plus the updated source reference. [Sources: asynchronous completion](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/repo-canvas/src/ui/SourceBlock.tsx#L90-L105), [captured update](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/repo-canvas/src/ui/Inspector.tsx#L280-L299)

**This path was statically verified; browser reproduction was blocked by the environment.**

Introduce semantic actions applied to current state, such as:

- Replace a source reference on a named object.
- Move a node.
- Update an object.
- Remove a connection and its associated annotations.

This gives async completions, history creation, and invariant preservation one owner. The existing reducer is sufficient infrastructure.

## G. Coalesce discussion drafts

Every composer change queues a persistence operation. Each operation reads and rewrites the complete discussion and returns it, including history. The queue preserves order but also preserves obsolete intermediate keystrokes. [Sources: `SideChat.tsx:77–107`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/repo-canvas/src/ui/SideChat.tsx#L77-L107), [discussion persistence](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/repo-canvas/src/server/discussion.ts#L42-L69)

Keep one latest pending draft, coalesce saves, and flush before operations such as Send or Clear. Routine saves can return the new revision and draft rather than the full history.

This is a code-backed performance concern; I did not benchmark typing latency.

## H. Replace the behavior atlas’s handwritten bundler

The atlas builder maintains an ordered module list, strips TypeScript, removes imports with regexes, and concatenates files into one lexical module. Another regex rewrites import paths for module output. [Source: `build.ts:17–39, 100–111`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/skills/ui-discussion/assets/behavior-atlas/build.ts#L17-L39)

This imposes hidden constraints on otherwise ordinary refactors: ordering, top-level naming, aliases, and import syntax.

Use a normal build-time bundler. The generated HTML can still have zero runtime dependencies.

The existing tests pass, but atlas CI checks and builds the output without exercising the generated application in a browser. Add one generated-page smoke check when replacing the build mechanism. [Workflow](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/.github/workflows/behavior-atlas.yml)

## I. Give the UI-review viewer normal source tooling

[`skills/ui-discussion/assets/index.html`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/skills/ui-discussion/assets/index.html) is a 2,424-line interactive application containing HTML, styles, data, and application code.

The concern is the mixed responsibilities and missing source tooling. It is maintained differently from the repository’s other executable interfaces.

Author it as a few coherent TypeScript/CSS/template files, then build the same self-contained artifact the scaffold delivers. Preserve the editable data format and portable output. Verify selection, comparison, keyboard interaction, and export at the generated-page boundary.

## J. Scope expensive checks to the changes they protect

The pre-push gate exports every outgoing tip and performs fresh installs for every npm package with separate empty caches. The CI install workflow runs on every push and PR. Workbench documentation changes also match the broad plugin workflow filters, and both matrix jobs repeat the shared-runtime check. [Sources: install gate](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/scripts/check_npm_install.py#L78-L112), [plugin workflow](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/.github/workflows/workbench.yml)

The cold-install test serves a real purpose. Its current scope creates avoidable repeated work.

A simpler checking policy would:

- Keep source, link, and structural checks for documentation changes.
- Run package/browser checks for affected executable inputs.
- Check the shared runtime once, followed by affected consumers.
- Retain cold-install verification for relevant installation inputs and release verification.

Any install-result cache must account for lifecycle scripts and local installation configuration, not just `package-lock.json`.

### Other bounded candidates

| Candidate | Recommendation |
|---|---|
| Validated operation arguments become `Record<string, unknown>` and are converted again with `String()`/`Number()`. | Preserve action-specific types after validation. [`operations.ts`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/repo-canvas/src/server/operations.ts) |
| Example app maintains custom polling/lifetime state alongside the shared poller. | Reuse the poller where its operation semantics match. [`app.ts`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/example-mcp-app/src/app.ts), [`poller.ts`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/mcp-app-runtime/src/poller.ts) |
| Removed usage sources disappear from the manifest, but old cache files are not collected. | Add bounded cleanup that accounts for concurrent scanners. [`saveIndex()`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/usage/scan.ts#L85-L98) |
| Repeated lazy reads of compressed records can repeatedly decompress the same archive. | Measure first; consider a bounded cache keyed by pinned source identity. [`logs/source.ts`](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/plugins/repo-workbench/packages/logs/source.ts) |

---

# 3. Structure worth preserving

The four product owners are already a sensible foundation. Their delivery contracts differ: personal instructions use guarded sync, shared skills carry provenance and an installation receipt, governance uses Copier’s managed/seeded distinction, and executable tools ship bundled packages. [Ownership model](https://github.com/qianyizhang/repo-kit/blob/707b3bdf9965e4463d137d7f5b718f3d4d0024ac/docs/models.md)

Preserve these existing mechanisms:

- **Canvas proposal → apply to draft → save.** Those are meaningful user decisions.
- **Raw records, usage accounting, summary buckets, and presentation actions.** These represent different information.
- **Caller-bound lookup and pinned lazy evidence reads.** They protect real boundaries.
- **Recovery and conflict tests.** Many test actual behavior and failure paths.
- **Standalone plugin and scaffold outputs.** Source sharing can improve while keeping independent delivery.

The architecture work should reduce duplicated rules and reverse dependencies. A broad directory reshuffle would produce less value than the specific changes above.

---

# 4. Recommended implementation order

| Slice | Scope | Completion evidence |
|---|---|---|
| **1. Protect saved work and diagnostic ownership** | Map-save transaction, starter caller isolation, concurrent log cleanup, final source-size validation | Concurrent-process and cross-caller regressions fail before repair and pass afterward |
| **2. Restore reliable verification** | Historical Copier fixture, current tooltip failure, shared document-link implementation | Consumer copy/update tests and relevant browser contract pass |
| **3. Consolidate repeated mechanisms** | Diagnostic storage export, one wrapper analysis, compact evidence selections, semantic draft actions | Existing tool responses remain stable; targeted lifecycle and evidence tests pass |
| **4. Clarify ownership and reduce maintenance** | Backlog schema ownership, neutral trace model, atlas bundler, viewer source tooling, scoped CI | Dependency direction and delivery contracts are explicit and verified |

## Verification performed

| Area | Result |
|---|---|
| Shared skill source lock | 15 skills verified |
| Root Python suite | 166 passed; 4 opt-in Copier tests skipped |
| Python formatting and lint | Passed |
| Workbench `npm run check` | Formatting, lint, types, build passed; 45 Vitest and 57 Node tests passed; one native-Codex check skipped |
| Shared MCP runtime | 8 tests passed |
| Example app | Types, lint, build and 12 tests passed |
| Generated MCP starter | Types, build and 12 tests passed; reused installed dependencies |
| Behavior atlas | 35 Node tests passed |
| Fresh Copier consumer | Generation, agent bootstrap, and all 13 document checks passed |
| Historical Copier suite | Failed during setup because its required tag is unavailable |
| Concurrent saves, log pruning, context exhaustion, source-size boundary, usage integrity, skill inventory | Defects reproduced in isolated fixtures |
| Browser verification | Local launch blocked before page load; same-commit Workbench CI passed, Example-app CI failed |

Local JavaScript checks used Node 24.22.3 and npm 11.9.0; the repository declares npm 11.19.0. Its strict fresh-install gate passed in [same-commit CI](https://github.com/qianyizhang/repo-kit/actions/runs/44245573274). The successful [Workbench CI job](https://github.com/qianyizhang/repo-kit/actions/runs/44245573332/job/134603587328) includes its browser checks.
