# Issues, PRs and follow-ups

Make the decision visible at a glance: short labels, evidence before prose, one
next step. Use [show-me](https://github.com/qianyizhang/repo-kit/blob/main/skills/show-me/SKILL.md)
for view selection and grounding; keep its procedure there.

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

- **Lead:** outcome or problem, bounded scope and acceptance. Prefer short labeled
  blocks, comparisons and captions to paragraphs.
- **Status:** 🟢 **Pass / positive**, 🔴 **Fail**, 🟠 **Pending**. Always include
  text and what it describes; color alone carries no status.
- **Claims:** separate technical checks, visual review, observed runtime behavior
  and clinical validity. Evidence in one category does not establish another.
- **Detail:** keep decision evidence visible; put logs, receipts and long rationale
  behind links or `<details>`. Reuse evidence while its inputs, revision and
  conditions still support the claim; state coverage and limitations.
- **History:** preserve identities, provenance, prior decisions and paused/retired
  scopes. Correct stale claims explicitly; a rewrite does not reopen work.
- **Checks:** documentation-only edits need scoped content, link and format checks,
  not functional reruns. Required security checks, hooks and CI still apply.
- **Authority:** this guide adds no permission to publish assets/Sites, change
  access, spend, merge or resume paused work.

## Copy only what is needed

**Issue**

```markdown
**Problem / scope:** <trigger, affected surface; in / out>
**Evidence:** <baseline or grounded illustration; source and state>
**Accept:** <observable completion criteria>
**Limits:** <unknowns, missing pixels, paused/retired scope>
**Next:** <one action>
```

**PR**

```markdown
**Change / scope:** <problem → resulting behavior; in / out; issue link>
**Evidence:** <matched comparison or new-asset view when relevant; source/state>
**Accept / checks:** <criterion → Pass, Fail or Pending; actual check and coverage>
**Limits:** <unverified claims, remaining gaps>
**Next:** <one review or follow-up action>
```

**Follow-up** — only changes since the previous update. Link still-valid evidence;
skip receipt-only acknowledgments and repeated check inventories.

```markdown
**Changed:** <delta since linked update; same bounded scope or explicit change>
**Evidence / acceptance:** <new result and status; link reused evidence>
**Limits:** <new or resolved gap; retain applicable prior limits by link>
**Next:** <one action>
```
