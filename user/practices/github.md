# Delivery, issues and PRs

## Delivery routine

1. **Frame.** Use one brief with the problem, scope, acceptance and delivery path.
   For local work, the chat or an existing local brief is enough. Use an issue
   when shared tracking or repository rules require one.
2. **Build and review.** Fix concrete defects and run the relevant checks. For
   each independent scope, keep one active builder and at most one focused reviewer.
3. **Deliver.** Follow the repository's gates and action permissions. After
   authorized publication, read back the actual issue, PR or comment and its
   media. Record results, limits and the next step. Close only when all scoped
   acceptance criteria are met or explicitly retired.

Use the existing issue or handoff for meaningful transitions. Keep local work,
published changes, CI, required approvals and merge distinct.

## Final verification

Keep one plan in the brief: changed inputs, required gates and reusable evidence.
Count checks already performed by hooks. Run cheap content and format checks
first. Recheck changed inputs, failures and unresolved risks. Documentation-only
edits need content, link and format checks. Follow the
[installation integrity rules](typescript.md) when relevant.

A passing local gate does not establish hosted, installed, UI or live-service
acceptance. Name each verified surface. After a push, report hosted acceptance
as pending until the required checks finish.

### Benchmark claims

Name the decision and the smallest difference that would matter. Verify that
the timed work completed, check its outputs and count failures. Compare
equivalent workloads and settings with repeated, interleaved runs. Report the
run count and spread. If variation could explain the difference, call the result
inconclusive and repair the measurement before choosing a winner. For a
requested ballpark, label a single valid run as an estimate and reserve speedup
claims and decisions for the repeated comparison.

## CI and release checks

Use this section when changing checks, CI or publication.

- Prefer a root `make ci-check` that delegates to existing runners and matches
  the required PR workflow. Pin tools, provision them separately and keep routine
  checks offline after setup. Document heavier release checks and when they run.
- Measure before adding jobs. Keep coverage and failure behavior intact. Aim for
  30 seconds locally with tools ready and two minutes from PR update to verdict.
  Separate edit, setup, queue, check and wait time when diagnosing delays.
- Add change selection only when measurements justify it. Check docs without
  installing unrelated tools. One required result must report failures and
  expected skips; uncertain inputs select broader coverage.
- Use read-only PR workflow permissions and a protected release job with only
  its required permissions. Publish the exact verified artifact. Record its
  revision, publication result and rollback path.

## Keep work moving

Use this section to coordinate multiple scopes or monitor hosted work.

- Confirm who owns the current slice and its handoff. Keep up to two independent
  authorized scopes ready, with evidence and acceptance.
- Park a blocked action with its revision or artifact and the exact missing
  input. Continue independent work within scope. Never bypass a denial or resume
  paused work without authorization.
- Monitor to a terminal result or a named blocker. When progress stalls for
  about two hours, investigate and resolve a concrete blocker rather than
  repeating status checks.
- Keep one receipt in the issue or handoff: owner, exact revision or artifact,
  last meaningful result and next action. Retain provenance and open work.

## Show the evidence

Use [show-me](https://github.com/qianyizhang/repo-kit/blob/main/skills/show-me/SKILL.md)
to select the smallest evidence that supports the claim. For a visual issue,
mark the defect on the actual baseline. For a visual PR, pair matched before
and after views; state the build, surface and state. Label mockups and state
what real rendering could not be checked. For a behavior change, show the
trigger, observed behavior and expected outcome if this helps. Docs changes
normally need no visual evidence.

Keep the full evidence with the existing handoff or
[artifact owner](artifacts.md). In the public brief, lead with the result.
Use three to five short bullets when useful. If using status colors, pair them
with text. Separate observed behavior from proposed behavior and from claims
that need additional evidence, such as clinical validity.

## Public brief templates

**Issue**

```markdown
- **Problem:** <trigger and impact>
- **Evidence:** <bounded evidence or gap>
- **Accept:** <observable completion>
- **Delivery:** <path and required approval>
```

**PR / public handoff**

```markdown
- **Change:** <outcome and why>
- **Checks:** <pass, fail or pending; evidence>
- **Limits:** <material gap, if any>
- **Next:** <review or delivery action, if any>
```

Follow-ups report only what changed since the linked update: result, blocker
or next action.
