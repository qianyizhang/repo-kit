# Session handoff

Write the packet before summarizing it in chat. Default path:
`records/reports/session-handoff-<topic>-<YYYYMMDD>.md`. Use the OS temporary
directory only when the user does not want a tracked report.

```markdown
---
description: Session handoff for <topic>
scope: session handoff report
status: experimental
last_update: YYYY-MM-DD
document_class: coordination
produced_by: handoff@<version> · agent=<model> · effort=<level> · <date>
---

# Session handoff — <topic>

**Mode:** <epistemic mode>
**Authorized transitions:** <e.g. DECIDE -> IMPLEMENT, or none>
**Stop condition:** <checkable done>

## Authorities
- Campaign / coordination context:
- Primary work item:
- Plan / spec / design:
- Other SSOTs:

## State
- Done:
- Left:
- Open questions:
- Verification:

## Suggested skills
- …

## Forbidden actions
- …
```

Reference existing artifacts by path instead of copying their bodies. Redact
secrets and PII, and tailor the packet to the next session's stated focus.
Reuse an existing packet for continuing state. Once consumed, superseded, or
completed, preserve unique decisions and outstanding obligations in their owners,
then apply `docs/rules/doc.md` closeout. A packet that still authorizes active
operations or supports retained evidence is not spent.

Session mode does not authorize parallel writes. If a second writer appears,
switch to `parallel` and claim surfaces before further edits.
