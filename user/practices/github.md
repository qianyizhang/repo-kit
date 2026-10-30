# Delivery, issues and PRs

Make the decision visible at a glance: short labels, evidence before prose, one
next step. Use [show-me](https://github.com/qianyizhang/repo-kit/blob/main/skills/show-me/SKILL.md)
for view selection and grounding; keep its procedure there.

## Delivery routine

Use the same routine for local and cloud jobs. Repository QA and separate action
permissions still govern; a reference to this guide does not install skills.

1. **Frame:** Before building, use one bounded issue with scope, current
   [evidence](#show-the-evidence), acceptance and the delivery path
   (branch → PR → required approval → destination).
2. **Focus:** Per independent scope, keep at most one active builder and one
   focused reviewer. Finish or hand off the current slice before starting another
   in that scope.
3. **Refine:** v1 → inspect concrete defects → v2 as needed. Fix supported defects,
   run affected tests and reuse still-valid evidence under the checks rule below.
4. **Deliver:** Prepare relevant checks and terminal CI results. Review the public
   brief before publishing and obtain any specific approval still required. After
   authorized publication, open the actual issue, PR or comment and read back its
   visible text and media; correct excess prose, broken evidence or hidden blockers.
   Record result, evidence, limits and next step after authorized delivery; close
   only when all bounded acceptance criteria are met or explicitly retired,
   keeping unfinished scope open.

Keep build, review/validation, publication and approval-blocked states separate in
the existing issue ledger. Record transitions and blocker changes, not receipt
spam. A local commit is not a published PR; passed CI is not a merge or closed issue.

## Keep work moving

- **Own the handoff:** the coordinator owns completion → review → next dispatch.
  Confirm the next worker is running; a message to a finished task is not dispatch.
- **Prepare next:** while builds run, keep up to 2 independent, authorized next
  scopes with source evidence and acceptance ready. If proof is missing, assign
  the exact preflight needed; do not call the queue empty after one rejected idea.
- **Park the action:** preserve the commit/artifact and exact approval or missing
  input. Block only that action; advance another ready scope. Never bypass a
  denial, duplicate running work or resume paused/retired work.
- **Make monitoring act:** reconcile running owners, local/unpushed results and
  remote PR/CI state, then dispatch, review or resolve a concrete blocker.
  Repeated read-only status checks are not progress. After about 2 hours without
  meaningful output, investigate the stalled task and replenish the ready queue.
- **Keep the receipt small:** in the existing issue/handoff, record owner, exact
  revision/artifact location, last meaningful output and next action. Distinguish
  implemented, reviewed, published, CI-passed and merged. Reuse valid evidence.

If no evidence-supported authorized scope remains, record the specific missing
input or decision and stop that work; do not invent filler or promise activity.

## Show the evidence

| Work | Smallest useful view |
| --- | --- |
| Visual improvement issue | Actual current baseline screenshot; mark the affected region. |
| Visual or asset PR | Representative matched baseline/current views; for a new asset, show the asset and its intended context. Match viewport, state, data and crop; label unavoidable differences. |
| Feature or bug issue | Grounded flow, state or data illustration: trigger → observed outcome → expected outcome. Mark proposed behavior. |

Pair an overview locator with a close-up when needed to prove the defect. Caption
captures with source revision, surface and state. Label diagrams, mockups and
proposals as such; they are not screenshots. If pixels are unavailable, state the
gap and capture needed; never invent evidence or claim visual verification.

## Keep it scannable

- **Brief:** for visual work, lead with the evidence view above, then roughly 3–5
  short labeled bullets. Docs and other nonvisual changes need no illustration.
  Keep the outcome, decision and material gaps visible; omit unused fields.
- **Status:** 🟢 **Pass / positive**, 🔴 **Fail**, 🟠 **Pending**. Always include
  text and what it describes; color alone carries no status.
- **Claims:** separate technical checks, visual review, observed runtime behavior
  and clinical validity. Evidence in one category does not establish another.
- **Handoff:** keep the full worker evidence bundle (revision, checks/results,
  applicable captures, gaps, next action) in the existing task handoff for the
  reviewer/publisher. Select the public brief from it; link or collapse receipts
  and rationale. Reuse evidence while its source and conditions support the claim.
- **History:** preserve identities, provenance, prior decisions and paused/retired
  scopes. Correct stale claims explicitly; a rewrite does not reopen work.
- **Checks:** documentation-only edits need scoped content, link and format checks,
  not functional reruns. Required security checks, hooks and CI still apply.
- **CI:** Monitor PR CI to a terminal result. If wall-clock time exceeds two minutes
  or work is disproportionate (for example, two minutes for docs), separate queue,
  setup and checks on the critical path; report the measured bottleneck and a
  scoped fix proposal. Preserve required checks; timing does not establish
  correctness or coverage.
- **Authority:** this guide adds no permission to publish assets/Sites, change
  access, spend, merge or resume paused work.

## Public brief templates

Put visual evidence before the bullets when applicable. Keep each bullet to one
short point; link detail instead of expanding the placeholders into paragraphs.

**Issue**

```markdown
- **Problem:** <bounded trigger and impact>
- **Evidence:** <source/view link; material gap if any>
- **Accept:** <observable completion; link detailed criteria>
- **Delivery:** <path and required approval>
- **Next:** <one action>
```

**PR / public handoff**

```markdown
- **Change:** <one outcome; issue link if useful>
- **Checks:** <Pass / Fail / Pending; key evidence link>
- **Limits:** <material gap or blocker; omit if none>
- **Next:** <one review or delivery action>
```

**Follow-up** — only changes since the previous update. Link still-valid evidence;
skip receipt-only acknowledgments and repeated check inventories.

```markdown
- **Changed:** <delta since linked update>
- **Status:** <new result or blocker; evidence link>
- **Next:** <one action>
```
