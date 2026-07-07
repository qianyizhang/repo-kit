---
name: grill-with-docs
version: "1.0.0"
description: >-
  Stress-test an ambiguous plan or design one decision at a time while using
  domain-modeling to capture settled glossary terms and ADR-worthy trade-offs.
  Use when the user asks to be grilled with docs or wants a plan sharpened before
  implementation.
scope: decision interview skill
status: stable
last_update: 2026-07-07
---

# Grill With Docs

Run a focused grilling session plus the repo's `domain-modeling` playbook. The
interview sharpens decisions; the documentation capture prevents the result from
living only in chat.

## Workflow

1. Read `CLAUDE.md`, `docs/index.md`, and the relevant owning SSOTs before
   asking about facts the repo can answer.
2. Run the interview one decision at a time. Ask exactly one question, include
   the recommended answer, then wait for the user's response.
3. Distinguish fact gaps from decision gaps:
   - Look up facts in code/docs.
   - Put real product, domain, safety, or architecture choices to the user.
4. Use `domain-modeling` during the session:
   - When a term crystallizes or conflicts with existing language, update the
     matching glossary file in `docs/glossary/`.
   - When a decision meets the ADR criteria, offer and then write an ADR.
   - Keep docs synchronized immediately after each settled answer instead of
     batching every capture to the end.
5. Do not implement the plan during the grilling session. End with the resolved
   decisions, open questions, and any docs changed.

## Question Standard

Each question should be concrete enough that the answer can change the design.
Avoid broad prompts such as "anything else?". Prefer:

- The specific branch being resolved.
- The current repo evidence or glossary/ADR conflict.
- The recommended answer and why.
- The consequence of choosing differently.

## Completion

The session is done when the next implementation step no longer depends on an
unstated term, unowned trade-off, or hidden policy decision. If uncertainty
remains, leave it as an explicit open question or backlog/spec item rather than
guessing.
