# Finish work: session review and candidate skill

**Recommendation:** use one shared **finish-work** skill for bounded review,
verification, and scoped commits. Each repository should point it to existing
contracts and checks; add a small local review-lessons section only when there is
something non-obvious to retain.

**Study completed 2026-10-14; adoption subsequently approved by the user.**
[Skill source](../../skills/finish-work/SKILL.md) and
[repository binding guidance](../../skills/finish-work/references/repository-rules.md)
now belong to the managed shared bundle. The study below records the draft
evidence and trials; [the maintenance guide](../skill-suite.md#selection-and-provenance)
records adoption and installation behavior. The original study made no
production cleanup commits.

## Scope and evidence

This is a qualitative review of **15 selected episodes across seven active
repository groups**: EZ, Saul, game, TB3, repo-kit, qi, and astro-blog. Twelve
are October episodes; three September episodes broaden the sample to qi and the
blog. The active weighting follows the user-confirmed
[portfolio map](../../../project-index/README.md), not inferred Git activity.
Cross-project episodes are counted once. C10 is a broader cleanup audit; C15
includes implementation followed by review. They inform the workflow but should
not be counted as pure post-completion discoveries.

Discovery used current chat listings, memory pointers, a streamed search of
October session files, and targeted September histories. The 501 October files
include auxiliary sessions and duplicate snapshots: that is **not a denominator
of independent user sessions**. The selected original user turns and subsequent
assistant commentary/finals were read; duplicate session IDs were not counted
as independent observations. These are purposively selected examples, not a
random sample or an estimate of how often review finds defects.

Historical check results below are **recorded session evidence**, not fresh
reruns. Local Git objects were spot-checked for the referenced EZ, Saul, game,
TB3, qi, repo-kit, and blog changes. Commit inspection establishes saved changes;
it does not independently prove every historical runtime claim. Local session
links may be unavailable on another machine. No logs or private source content
were sent to the upstream repository.

## What the extra pass actually finds

| Finding family | Concrete examples | Better instruction |
| --- | --- | --- |
| **State and lifecycle defects** | EZ configuration resets, fixture teardown races; Blender clamping; replay-link recovery | Follow the affected state across save, cancel, retry, restart, and actual native/browser boundaries, as applicable |
| **Tests that prove too little** | Handler failures masked by timeouts; optional native dependency skipping unrelated evidence checks | Ask whether a plausible broken implementation still passes; improve isolation and failure assertions |
| **Cross-file and commit dependencies** | EZ preview works only with excluded files; migration mapping points to untracked docs | Verify the candidate independently when the shared worktree could conceal dependencies |
| **Simplification with a concrete payoff** | Duplicate form logic/CSS; custom hook wrapper; lone Svelte island | Remove a demonstrated duplicate responsibility or unnecessary dependency, preserving behavior |
| **Stale claims and weak navigation** | TB3 recovery counts/CLI help; qi removed commands and failed-fit promises | Reconcile what docs promise with actual behavior and retained evidence |
| **Evidence and cleanup authority** | Committed-source refresh; native benchmark bytes; protected artifact/history paths | Identify source, derived output, historical evidence, and disposable scratch before touching them |

These categories overlap. Counting every bullet as a unique bug would exaggerate
both defect yield and severity. A clearer sign-in message, a latent crash, and a
corrected test skip are different outcomes.

## Why a handwave prompt works, and where it misleads

**Interpretation:** the prompt changes the immediate objective from building a
feature to checking the whole result against its callers, contracts, packaging,
and claims. That exposes cross-boundary issues that a happy-path implementation
or a passing local suite can miss. A separate reviewer can also reduce anchoring,
but many observed fixes came from a second turn in the same chat. This sample
does not establish that a new model, another agent, or the exact wording caused
the improvement.

**Counterexamples matter.** C09 found no further edits necessary and reused valid
checks. C13 found no code defect and corrected documentation only. C06's later
recovery concerns were a read-only recommendation, not delivered fixes. C01's
Keychain fix followed an explicitly requested app upgrade; it is evidence for
native acceptance checks, not a reason to install apps during every closeout.

The handwave also leaves cost and stopping conditions undefined. Repeating it
can reward cosmetic churn, repeated full suites, broad refactors, and ever more
rules. The target should be a coherent verified result, not another list of
findings or a globally clean worktree at the expense of concurrent work.

## Matt's closest workflows

Reviewed the actual public source at **`49dd158d1076134a641b33efb035946536778336`**
on 2026-10-14, fetched into a disposable checkout. This matches the revision
already pinned by the local shared suite. The closest composable pieces are:

| Source | Strategy worth retaining | Adaptation for this workflow |
| --- | --- | --- |
| [code-review](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/code-review/SKILL.md) | Separate spec compliance from repository standards; independently scoped reviewers; tooling owns mechanical checks; smells are judgment calls | Include staged, unstaged and new files. Accepted chat decisions can be the spec. Resolve a known local base without forcing another question. Separate passes suffice for small work |
| [implement](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/implement/SKILL.md) | Focused checks while editing, full suite at completion, then review and commit | Apply the repo's required gates to the final relevant state; review fixes may invalidate earlier results |
| [retro](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/retro/SKILL.md) | Convert mechanical misses into automated guards; reserve prose for judgment; keep agent entry points small | Capture only useful lessons from this slice. A whole-environment retrospective remains separately requested work |
| [writing-for-agents](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/productivity/writing-for-agents/SKILL.md) | Clear completion criteria, conditional pointers, one owner per rule, pruning | Keep the main skill short enough to follow; disclose repository-learning guidance only when needed |
| [TDD test guidance](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/tdd/tests.md) | Observable behavior and independent expectations survive refactors | Exact call counts/bytes still matter when they are the contract, such as one refresh or preserved historical evidence |

I did not find a dedicated finish-work/cleanup-and-commit skill in the inspected
skill tree. The candidate is a small local composition of these strategies and
the observed gaps, not a claim that Matt's suite is deficient. The draft study changed no upstream skill bytes or installer selection;
subsequent user approval adds only the local finish-work skill. For forward testing, fresh-context
review and behavioral assertions are useful strategies; the controlled workflow
trial below is our local evaluation design, not an attributed Matt benchmark.

## Repository-specific ownership

**Use a rulebook, optionally with a small lessons section; avoid a second backlog.**
A binding routes the shared skill to local authority. A lesson records a recurring
or costly surprise and its guard. An ordinary successful check belongs in the
normal handoff or commit, not a permanent ledger row.

| Repository | Existing owner to extend or reference | Useful local review trigger |
| --- | --- | --- |
| [EZ](../../../ez/AGENTS.md) | `docs/architecture.md`, `docs/surfaces.md`, `Tests/README.md`, verification guidance | Shared lookup state, suspended credential reads, native acceptance versus offline checks |
| [Saul](../../../Saul/AGENTS.md) | Product/architecture contracts, existing browser-testing skill, design contract | MV3 restart/recovery, Apply boundary, source/generated identity, installed versus source app |
| [game](../../../game/AGENTS.md) | `docs/engineering/testing.md`, maintenance/checks, art rulebook | Replay/save meaning; geometry, browser delivery and native authoring need different proof |
| [TB3](../../../tb3/AGENTS.md) | Governance, artifact retention, group contracts | Frozen evidence and scores; staged artifact gate; corrected code does not restore old conclusions |
| [qi](../../../qi/CLAUDE.md) | Testing rules, model/contracts, existing experiment/work records | Replay parity and optional-backend isolation; retain measured source and historical hashes |
| [astro-blog](../../../astro-blog/CLAUDE.md) | Publishing/content rules, build checks | Private Raw versus published editions; stable public URLs; output size versus reader download cost |
| [repo-kit](../../AGENTS.md) | Product model, skill-suite guide, installer tests | Committed-source provenance; separate skill/governance delivery; consumer scope and staging |

These are proposed bindings grounded in current entry-point guidance and sampled
sessions, not freshly audited whole-repository rulebooks. The study created no empty ledgers or repository bindings. Subsequent adoption
adds concise pointers to existing owners, including learn-ts, codex-trace, and
thoughts after reading their current guidance; no rules are inferred from
unsampled sessions.

## Proposed use and stopping rule

After adoption, the short prompt would be:

> Use $finish-work on this slice and commit it. Preserve concurrent work.

The skill first identifies intent and ownership, reviews behavior and repository
fit separately, fixes supported findings, runs appropriate checks, verifies the
candidate, and commits under existing authorization. It stops after the fixes
and affected boundaries are rechecked with no material unresolved in-scope issue.
It permits a no-change outcome and distinguishes blocked checks from successes.

For a first real pilot, EZ is a useful candidate because its recent episodes
span shared state, test reliability, native behavior, and concurrent staging.
Compare accepted findings, missed regressions, unrelated edits, tool/check cost,
and user interruptions. **Finding count alone is not a success metric.** No
production efficiency or defect-reduction claim is established by this draft.

## Draft validation and controlled trial

**Structural validation passed.** The skill-creator validator accepted the
frontmatter and package. Local links and whitespace were checked separately.
This verifies packaging, not behavior.

Two fresh-context agents received equivalent disposable Git repositories and
the same request: review, polish, simplify, clean up, and commit the settings-save
slice while preserving another session's staged notes and untracked scratch.
One used the ordinary handwave; one read the candidate skill. Both had the same
repository guidance, a pending untracked validation module, a weak passing test,
and a README contract that settings changes must preserve the active model/draft.
The pending implementation violated that contract. Historical evidence was also
present and explicitly retained. The agents were not given the expected defect
or each other's results. Local trial commits were explicitly authorized.

| Observation | Ordinary prompt | Candidate skill |
| --- | --- | --- |
| Detected and fixed state reset | Yes | Yes |
| Included required new module | Yes | Yes |
| Added preservation/rejection checks | Yes; 3 tests passed | Yes; 3 tests passed |
| Demonstrated regression before repair | Not reported | Yes |
| Tested exact candidate export | Not reported | Yes |
| Preserved unrelated staging, scratch and evidence | Yes | Yes |
| Local trial commit | `87569b4` | `320df41` |

The parent independently exercised both resulting implementations with a chosen
model, restored draft, unrelated state, and invalid defaults (`""`, whitespace,
null, integer). Both preserved state on rejection and passed. Git inspection
confirmed unrelated notes remained staged but outside the commit, scratch stayed
untracked, the dependency was committed, and historical evidence bytes matched.

A second invocation of the candidate on its already-completed slice produced
**no edits and no new commit**. It reran the repository-required three tests,
reused the still-matching candidate-tree verification, and preserved the other
session's work. This checks the stopping rule as well as the bug-finding path.

**Interpretation:** both prompts solved this small case. The skill made the proof
and commit-boundary checks more explicit, with some added overhead. This is one
synthetic comparison plus a no-change rerun, not statistical evidence of higher
quality or efficiency. No browser/native launch failure, real concurrent writer,
large repository, or production closeout was tested. No cost/latency reduction is
claimed. Trial repositories live under `/tmp/closeout-review/` and are disposable;
the recipe and results above are the durable record, not a permanent fixture suite.

## Episode register

Each source links to the triggering turn; the result line anchors the reviewed
outcome. Compressed sources link to the retained `.jsonl.zst` archive; their
line numbers refer to the decompressed JSONL. Descriptions identify review additions
rather than assigning the whole feature commit to the cleanup pass.

| ID / owner | Review addition or outcome | Saved change / qualification | Original evidence |
| --- | --- | --- | --- |
| C01 · EZ surfaces | Configuration edits reset an active preset/history selection; duplicated input/focus and preview code. Keychain UI blocking was discovered later during the separately requested upgrade. | `2b4a71c; 3b184e7`. Behavior + simplification; post-install defect distinguished. | [Compressed source](/Users/zhangqy/.codex/sessions/2026/10/14/rollout-2026-10-14T17-37-42-01a139c6-5765-7ce3-ac94-c740b668fc07.jsonl.zst); prompt line 475, result line 1115 |
| C02 · EZ tests | HTTP fixture close/registration race; handler errors hidden by timeouts; async teardown and tiny-file fragmentation. | `23b3608`. Test reliability + simplification. | [Compressed source](/Users/zhangqy/.codex/sessions/2026/10/14/rollout-2026-10-14T20-37-05-01a13a6a-94b5-7e41-9077-2381776e739f.jsonl.zst); prompt line 306, result line 502 |
| C03 · EZ quality gates | Custom hook wrappers depended on an internal pre-commit marker; checksum diagnostics and duplicate gate plumbing needed simplification. | `47baca2`. Maintenance risk; hosted CI still unrun. | [Compressed source](/Users/zhangqy/.codex/sessions/2026/10/14/rollout-2026-10-14T21-24-26-01a13a95-ec1d-7ba2-8d4c-091e89c0f083.jsonl.zst); prompt line 288, result line 359 |
| C04 · Saul / EZ design | Output could alias the design source; token names could generate invalid Swift identifiers; scoped EZ preview depended on excluded feature files. | `b3478b8; 9e3627f`. Boundary defects + commit dependency. | [Compressed source](/Users/zhangqy/.codex/sessions/2026/10/14/rollout-2026-10-14T16-32-16-01a1398a-7213-7bf1-886f-bb358060e629.jsonl.zst); prompt line 692, result line 1013 |
| C05 · Saul UI | Unused and duplicate CSS, redundant helper, overlong MCP usage guide. Earlier UI/dragging fixes preceded this closeout. | `2b7af3f`. Simplification; installation remained separate. | [Compressed source](/Users/zhangqy/.codex/sessions/2026/10/13/rollout-2026-10-13T22-54-44-01a135c2-3db9-7690-b98f-577828fed6a3.jsonl.zst); prompt line 514, result line 603 |
| C06 · Saul OAuth | Shared parser/typed provider responses, credential/helper error handling, clearer sign-in progress. Later review raised pending registration, stale-lock and pause recovery gaps without fixing them. | `8d12e35`. Mixed hardening; later findings are recommendations. | [Compressed source](/Users/zhangqy/.codex/sessions/2026/10/01/rollout-2026-10-01T22-04-45-01a0f7c8-293c-7250-8fb8-ba72661866e8.jsonl.zst); prompt line 354, result line 482 |
| C07 · game replay | Malformed/external replay links lacked recovery; replay controls and CLI navigation needed polish. | `9a6d7ff`. Boundary defect + UX/docs. | [Compressed source](/Users/zhangqy/.codex/sessions/2026/10/13/rollout-2026-10-13T14-45-01-01a13401-e1ef-76b0-99dd-efa44b0b79b8.jsonl.zst); prompt line 12, result line 166 |
| C08 · game Hydra | Native Blender controls silently clamped; comparison navigation was stale. Actual authoring/export checks exposed a gap in broader passing suites. | `7050d9d`. Native boundary defect; later test redesign is separate. | [Compressed source](/Users/zhangqy/.codex/sessions/2026/10/07/rollout-2026-10-07T22-39-47-01a116cc-5d65-77c3-b3ca-43f9e4253bcc_01a116ce-6408-7fc1-8a3c-15d2d08ed98d.jsonl.zst); prompt line 13, result line 348 |
| C09 · game playback | Final review found no further cleanup necessary; the 19 intended files and prior validation remained applicable. | `b7a1f89`. No new edit: valid closeout. | [Compressed source](/Users/zhangqy/.codex/sessions/2026/10/10/rollout-2026-10-10T15-57-43-01a124d1-5f73-76e0-9553-86e57c0101b5.jsonl.zst); prompt line 338, result line 382 |
| C10 · game retention | Broader cleanup audit rejected blanket deletion assumptions; empty assets directory obstructed expiry, refresh writes and fixture teardown needed protection. | `fbf46cd`. Broader maintenance episode; not all discovered in final commit turn. | [Compressed source](/Users/zhangqy/.codex/sessions/2026/10/10/rollout-2026-10-10T09-47-13-01a1237e-2c59-7302-af16-bf26307e654a.jsonl.zst); prompt line 12, result line 491 |
| C11 · TB3 artifacts | Stale no-deletion architecture claim, overlapping recovery instructions, ambiguous count checkpoints and CLI arguments. | `4e25d0fd`. Claims/docs correction; historical manifests retained. | [Compressed source](/Users/zhangqy/.codex/sessions/2026/10/02/rollout-2026-10-02T22-03-09-01a0fced-0f0d-75a0-b286-92360438beaa.jsonl.zst); prompt line 1590, result line 1746 |
| C12 · repo-kit migration | Refresh read checkout bytes instead of committed source; validation missed stray files/missing manifests; EZ mapping depended on untracked docs. | `ee6befb and five scoped consumer commits`. Provenance + validation + delivery dependency. | [Compressed source](/Users/zhangqy/.codex/sessions/2026/10/14/rollout-2026-10-14T17-00-53-01a139a4-a34c-7281-bda1-73260de8504d.jsonl.zst); prompt line 541, result line 816 |
| C13 · qi Recipe | No code defect found; removed-command wording and failed-fit artifact promises were stale; duplicate docs consolidated. | `e9fa440`. Documentation-only correction. | [Compressed source](/Users/zhangqy/.codex/sessions/2026/09/11/rollout-2026-09-11T18-45-52-01a09011-2114-7273-a75b-1756919e609a_01a09012-e48f-7181-93a4-40c9f5c26d04.jsonl.zst); prompt line 583, result line 678 |
| C14 · qi native experiment | Optional backend setup skipped checks that did not need the backend. Documentation shortened while measured source/results remained unchanged. | `41fdb96`. Verification gap + evidence preservation. | [Compressed source](/Users/zhangqy/.codex/sessions/2026/09/21/rollout-2026-09-21T02-02-04-01a0bffb-7c82-7ec3-a89e-45c1d95c39f2.jsonl.zst); prompt line 437, result line 521 |
| C15 · astro-blog | Sole Svelte theme island and dependency removed; duplicate content load removed; KaTeX confined to article pages. Public assets retained because local reachability could not establish external use. | `351e5af`. Requested implementation plus a distinct cleanup pass. | [Compressed source](/Users/zhangqy/.codex/sessions/2026/09/23/rollout-2026-09-23T09-54-05-01a0cbf8-5762-78a1-b40b-1e0cb71b5288.jsonl.zst); prompt line 318, result line 818 |
