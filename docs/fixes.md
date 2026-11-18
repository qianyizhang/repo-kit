# Repo-kit correctness audit

## Scope and baseline

Audit baseline: `707b3bd`. The initial fixes and handoff landed locally in
`e621979`. This closeout covers local source and test evidence.

**Accepted scope:** finish the correctness and verification defects in small tested slices. Exact usage provenance wins over append-only read cost. Sections A–J and the other bounded candidates are proposals, not approved refactors. Keep them for a separate decision. Do not make those changes a prerequisite for safety fixes.

**Initial fixes in `e621979`:** #1 and #6: one worktree writer lock covers map and source saves; validate final UTF-8 size before replacement. External editors do not participate. #4 and the plain-log byte count: verify the complete old prefix before reusing records; changed prefixes reparse; invalidate old persisted indexes and summaries. Tests cover an overlapping second process, stale writes, exact and oversized multibyte files, cached appends, provisional lines, an early edit plus append, and agreement with native SHA-256.

**Initial verification:** root `make ci-check` passed. Workbench `npm run check` passed (47 Vitest and 58 Node tests; one opt-in native Codex test skipped). All 53 Workbench Chrome tests passed. The strengthened equal-length prefix-edit regression also passed individually. No hosted CI or installed-plugin verification for these local edits.

## Correctness fixes

The six corrective slices follow the original audit numbering. The historical findings, reproduction notes and implementation plan are preserved in `e621979:docs/fixes.md`.

| Queue row | Change | Verification |
|---|---|---|
| 1 · #2–3 | The starter binds diagnostic records to the trusted host chat. Loopback HTTP has a separate local owner. Runtime and starter pruning tolerate sessions removed concurrently. Retention errors remain visible separately from write failures. | Built stdio caller tests cover owned append, list, read and capture, absent and conflicting identity, and foreign reads and captures. Runtime and generated starter tests reproduce the pruning race. The skill lock covers the reviewed starter sources. |
| 2 · #5 | Canvas releases unused contexts for their caller. Clean panels request release on host teardown. Drafts and pending review work can retain a context. Abandoned contexts and bindings keep the existing 24-hour idle expiry. | Public protocol tests fill all 32 slots, deny foreign release, reclaim a slot, clear stale bindings and preserve an independent draft. The Chrome fixture exercises teardown and draft recovery after restart. |
| 3 · #7–8 | Skill sources use tracked files and nonignored additions. Committed exports and installed trees retain exhaustive checks. Repo-kit and rendered consumers share the shipped Markdown link checker. | Tests cover ignored source output, installed drift, committed bundle provenance, fences, missing anchors, root-relative links and paths that escape the repository. The rendered consumer gate exercises headings and fences. |
| 4 · #9 | Copier uses the historical commit `196cbfbc2e749029213fdfd681e2057808db996b`. The template smoke workflow fetches history on changes to the template, config or smoke test. | Six tests passed in a tag-free checkout, including first copy and historical update. The new hosted job awaits its first run. |
| 5 · #10 | The focused event keeps its tooltip through scroll and pointer exit. Escape dismisses it and leaves focus on the event. | The new regression failed before the fix on pointer exit. All 11 Example Chrome tests passed with the fix. |
| 6 · Smaller fixes | The Usage recovery messages use `repo-workbench usage --serve`. Copier omits the unused slug question. | Chrome checked trace and refresh recovery in a CLI-exported Usage file. First copy omits `project_slug`, and historical update accepts the old answer and drops it from the updated file. |

- Root `make ci-check` passed with Copier smoke enabled in a tag-free clone
  of the staged candidate (173 tests).
- Runtime `npm run check` passed (9 tests). The independently generated
  starter passed 14 tests and 8 Chrome tests against the same build fingerprint.
  It reused existing dependencies checked against its manifest.
- Workbench `npm run check` passed with loopback enabled. All 53 Chrome tests passed.
- Example `npm run check` passed (12 tests). All 11 Chrome tests passed.
- The optional native Codex check was skipped. Hosted CI and live Codex
  acceptance remain unverified.

### Review corrections

- Canvas keeps a reply route when a panel closes with an unanswered side-chat request. Another context for the same repository and caller can serve that mailbox; unrelated contexts do not count.
- Skill refresh rejects unmanaged files in directories it would replace before writing any changes. Ignoring a local file for distribution does not authorize deleting it.
- Both hosted adapters reject an empty identity alias when it conflicts with a supplied chat ID.

## Deferred design proposals

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
