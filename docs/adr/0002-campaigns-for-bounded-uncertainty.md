---
description: Decision to use advisory Campaigns for bounded uncertainty.
scope: repo-kit architecture decision
status: stable
last_update: 2026-08-17
document_class: coordination
---

# ADR-0002: Use Campaigns for bounded uncertainty

- **Status**: `accepted`
- **Last Update**: 2026-08-17
- **Serves**: deliberate evolution and Campaign closeout

Repo-kit uses an advisory, one-page Campaign when a destination spans sessions
and its route remains materially uncertain.

## Context

Work items are good at precise work but do not show how several decisions and
discoveries converge on a larger destination. A second tracker would duplicate
state and blur authority.

The shape adapts Wayfinder's destination, fog, and frontier while rejecting its
tracker-first ownership; see the [upstream review](../../.codex/skills/maintain-repo-kit/references/upstreams.md#mattpocockskills).

## Considered options

- Use only work items — rejected for multi-session destinations whose fog and
  frontier change as the repository is understood.
- Add a Campaign tracker, mandatory schema, or new skill — rejected because
  existing records already own decisions and implementation state.

## Consequences

During the pilot, a Campaign is one advisory
`records/campaigns/<slug>.md` page with no dedicated checker class. It records
destination, fog, frontier, links, learning, and closeout. It links rather than
copies work, evidence, and decisions. Work items own precise work; core models,
ADRs, SSOTs, code, and tests own durable outcomes. A Campaign closes after
settled outcomes move to their owners, or after an explicit no-change result;
recurring work uses a bounded series.
