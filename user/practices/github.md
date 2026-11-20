# Delivery, issues and PRs

## Delivery path

| Setting | Default |
| --- | --- |
| Local development on the user's Mac | Work and commit on the current development branch. Use a PR when requested or required by branch protection or a guarded workflow. |
| Cloud or remote development | Use a draft PR when the user cannot supervise commits directly. Record the tested revision, checks and limits. |

## Delivery routine

| Outcome | Evidence |
| --- | --- |
| Agreed scope | One brief with problem, scope, acceptance and delivery path. Local chat or brief is enough unless shared tracking or repo rules require an issue. |
| Reviewed change | Concrete defects fixed and relevant checks run. One builder and at most one focused reviewer per independent scope. |
| Accepted delivery | Required gates and action permissions satisfied. Acceptance met or explicitly retired. After authorized publication, read back the actual issue, PR or comment and its media. |

- **Status** · Record meaningful transitions in the existing issue or handoff. Distinguish local work, publication, hosted CI, approvals and merge.

## Final verification

- **Plan** · One set of changed inputs, required gates and reusable evidence in the brief. Count prior hook checks. Run cheap content and format checks first. Recheck changed inputs, failures and unresolved risks.
- **Docs** · Content, links and format. [Installation integrity](typescript.md#installation-integrity) applies when its inputs or gates require it.
- **Claims** · Name the verified surfaces and material limits. Hosted, installed, UI and live-service acceptance need their own evidence. After push, mark hosted checks pending until complete.
- **Local asset uploads** · On the user's Mac, a successful upload of the intended asset completes routine integrity verification. Record the upload result. Use a separate download for an explicit readback or restore check, or when a guarded workflow requires one.

### Benchmark claims

- **Decision** · State the choice and the smallest material difference.
- **Validity** · Equivalent workloads and settings, repeat and interleave, verify outputs and count failures.
- **Verdict** · Report run count and spread. Base speedup claims and decisions on repeated comparisons. Treat differences within variation as inconclusive and fix the measurement. For a requested ballpark, label a single valid run as an estimate.

## CI and release checks

| Goal | Acceptance |
| --- | --- |
| Reproducible gates | Prefer a root `make ci-check` that delegates to existing runners and matches the required PR workflow. Pinned tools set up separately. Routine checks offline after setup. Heavier release gates documented. |
| Fast feedback | Measure before adding or selecting jobs. Aim for 30 seconds locally with tools ready and two minutes from PR update to verdict. Diagnose edit, setup, queue, run and wait separately. |
| Preserved coverage | Docs checks avoid unrelated installs. One required result reports failures and expected skips. Uncertain change selection runs broader coverage. |
| Release integrity | Read-only PR permissions. Protected release job with only required permissions. Publish the exact verified artifact and record revision, publication result and rollback path. |

## Keep work moving

- **Ownership** · One owner and handoff for the current scope. Keep up to two independent authorized scopes ready with evidence and acceptance.
- **Blockers** · Park the exact revision/artifact and missing input. Continue independent work. Denied or paused actions require authorization to resume.
- **Monitoring** · Stay with the work until a terminal result or named blocker. After about two hours without progress, investigate a concrete cause.
- **Handoff** · One receipt with owner, exact revision/artifact, last meaningful result and next action. Retain provenance and open work.

## Show the evidence

| Claim | Evidence |
| --- | --- |
| Visual issue | Defect marked on the actual baseline |
| Visual PR | Matched before/after with build, surface and state. Label mockups and rendering gaps. |
| Behavior | Trigger, observed behavior and expected outcome where useful |
| Docs | Content and link checks. Visual evidence only when rendering matters. |

- **Public brief** · Smallest evidence that supports the claim. Lead with the result in three to five short bullets when useful. Pair status colors with text. Distinguish observations, proposals and unverified claims such as clinical validity. [Show me](https://github.com/qianyizhang/repo-kit/blob/main/skills/show-me/SKILL.md)
- **Full evidence** · Existing handoff or [artifact owner](artifacts.md).

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

- **Follow-ups** · Result, blocker or next action that changed since the linked update.
