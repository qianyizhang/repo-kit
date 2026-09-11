---
description: Metadata and minimal example for a durable documentation hygiene report.
scope: documentation hygiene report reference
status: stable
last_update: 2026-09-09
document_class: artifact
---

# Durable report

Use the repository's report area and lifecycle from `docs/rules/doc.md`.
Declare exactly one outcome: `promoted`, `inconclusive`, or `archive_eligible`.
The latter two require conditional fields enforced by `scripts/check_docs.py`.
Sign the output according to `docs/rules/skill.md`.

For an audit awaiting an owner decision:

```markdown
---
description: Results of a scoped documentation hygiene audit.
scope: <inspected area>
status: stable
last_update: YYYY-MM-DD
document_class: report
report_outcome: inconclusive
inconclusive_reason: <unresolved evidence or decision>
review_trigger: <concrete event that resolves the uncertainty>
produced_by: doc-hygiene-audit@<version> · agent=<model-id> · effort=<level> · YYYY-MM-DD
---

# Documentation hygiene report

Scope and omissions: <what was inspected and excluded>.

| Finding and evidence | Change or recommendation | Owner decision needed |
|:--|:--|:--|
| <finding and source> | <action or linked destination> | <decision, if any> |

Verification: <checks run and limitations>.
```

Omit the decision column when no owner decision remains. Link promoted content
and existing work items rather than repeating their meaning or status.
