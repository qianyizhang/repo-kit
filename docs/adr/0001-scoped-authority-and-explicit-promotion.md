---
description: Decision to keep repo-kit authority scoped and promotion explicit.
scope: repo-kit architecture decision
status: stable
last_update: 2026-08-17
document_class: coordination
---

# ADR-0001: Keep authority scoped and promotion explicit

- **Status**: `accepted`
- **Last Update**: 2026-08-17
- **Serves**: product boundary and authority promotion

Repo-kit accepts inputs as Candidates and changes the portable product only
through an explicit decision by its owner.

## Context

Local work, upstream ideas, and consumer refinements can all improve the kit.
Treating proximity, recency, or copied text as authority would overwrite source
intent and consumer-specific meaning.

## Considered options

- Treat the newest or broadest source as canonical — rejected because authority
  is scoped by concern, not recency.
- Synchronize evidence automatically — rejected because observation is not a
  decision to promote.

## Consequences

Promotion recreates the smallest justified change in `template/`, preserves
provenance, and requires explicit approval. Consumer propagation remains a
separate decision. Root governance stays local to repo-kit.
