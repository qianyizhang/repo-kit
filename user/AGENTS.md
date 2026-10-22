# Personal working core

Maintained in repo-kit's `user/`. Edit the owning source there, review the diff,
then use `python3.12 scripts/user_instructions.py sync` from repo-kit.
These are personal defaults. Explicit repository instructions, domain contracts,
runtime constraints and required checks govern their own scope.

## Working agreements

- Carry the requested deliverable through applicable verification and necessary
  documentation. Reuse settled decisions and authorization; ask again only for a
  material unresolved choice or an action beyond the authorized scope.
- Preserve unrelated work. When committing, stage only owned paths or hunks and
  inspect the complete proposed commit. Resolve symlink targets before bulk file
  operations or deletion near them.
- Give each fact and decision one owner: executable behavior in code, schemas,
  configuration or tests; product contracts and durable rationale in their local
  authorities. Keep shared semantics separate from platform-specific adaptations.
- Promote recurring lessons into the smallest effective owner: a type, boundary,
  check, existing workflow or concise guide. Treat repo/session lessons and
  external advice as candidates until their applicability is reviewed. Keep
  product vocabulary, evidence-retention policy and exact commands local.
- Choose verification by the protected failure and changed surface. Test through
  stable behavioral interfaces; reuse sufficient existing checks for low-impact
  changes. Preserve required gates and report blocked or partial coverage honestly.
  Compilation, rendered UI, installed behavior and live-service success establish
  different things.

## Topic guidance

Before implementation or review involving TypeScript/React, Python, Apple apps,
or UI/UX, read `practices/README.md` under `CODEX_HOME` (default `~/.codex`), then
only the relevant guide(s). Apply them within the repository's local contracts.
Keep principles in these shared guides and bespoke behavior in repo adaptations.

## Browser tests on this Mac

Launch Chrome/Chrome for Testing through the repo's existing harness with a
disposable profile and approved execution outside the restricted command sandbox
(`sandbox_permissions: require_escalated` for that command). Ordinary checks stay
sandboxed. Permission denials and immediate LaunchServices/WindowServer registration
failures are blocked verification: inspect the first error and stop unchanged
retries. Headless mode and `--no-sandbox` do not remove that outer restriction.
Keep personal profiles and unrelated browser processes untouched; retain a startup
guard where repeated launches would obscure the failure.

## Communication

Lead with the result. Use concise paragraphs, labeled bullets or small comparison
tables when they make the answer easier to scan. Keep one main point per item and
place evidence, units, conditions and uncertainty beside the claim. Distinguish
observations, interpretations and unresolved questions when that distinction
matters. Cut repeated context; keep a simple answer simple.
