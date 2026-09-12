---
description: Portable testing doctrine — when a module earns tests, where tests live (colocated unit vs central e2e), and the hermetic conventions.
scope: testing rules
status: stable
last_update: 2026-09-12
document_class: coordination
---

# Testing rules

Portable doctrine. Repo-specific exemplars — which modules are runnable today,
the exact env vars that redirect side-effecting roots, the current consolidated
contexts — live in the repo's `CLAUDE.md` binding, not here.

## Choose verification by changed surface

Use the repository binding for exact commands and side-effect boundaries:

- Prose or routing changes: documentation and link checks relevant to the edit.
- Standalone artifacts: their validator and appropriate visual or interaction checks.
- Runnable behavior: affected contract and behavior tests; include consumers when
  a shared interface changes.
- Cross-cutting integration, build configuration, or release preparation: broader
  integration checks and any required repository or release gates.

Run a sufficient set, fix failures caused by the change, and rerun affected checks.
Broaden or repeat only when new changes, failures, or unresolved concerns justify
it. A prose edit does not by itself require runtime tests. Existing mandatory
gates still apply. Report the checks run, their input/environment scope, and any
remaining limitation without combining differently scoped evidence.

## When a module earns tests

A repo built interface-first carries **drafted models + stubs** long before it
carries behaviour. Those stubs get **no** runtime tests: the shapes are still in
flux and the durable artifact is the design, not a green bar.

> **Rule.** A module earns tests when it **consolidates into runnable code** — it
> has real behaviour a human depends on. At that point, add tests for its **core
> contracts and behaviours** in the same change that lands the consolidation.

Interface-drafted contexts stay untested until they have code. The list of which
modules are runnable today is a binding (`CLAUDE.md`), not doctrine — it moves.

## Where tests live — colocated unit, central e2e

While boundaries still move and abstractions get thrown away, unit/module tests
live **next to the code they test** — they move, and die, with the abstraction.
Broader tests that cross modules or processes live centrally.

| Kind | Location |
| :-- | :-- |
| **Unit / module** | **in-place**, beside the module (e.g. `pkg/mod/test_*.py`, `src/**/*.test.ts`) |
| **Smoke / e2e / integration** | central `tests/` (py) or a dedicated web e2e project |

- **Python.** `pytest` discovers both (`testpaths` spans the source tree and
  `tests/`); shared fixtures live in the **root `conftest.py`** so colocated and
  central tests use one builder.
- **Web.** Keep load-bearing logic in **pure modules** so unit tests need no DOM
  and survive component rewrites; a jsdom/Playwright e2e project is added when
  component/flow coverage is needed.

## Two things every consolidated module tests

1. **Contracts** — the shapes other code/UI binds to: DTO field sets, API
   endpoint paths + status codes (incl. guards like path-traversal → 404),
   serialization round-trips. A contract test fails when a downstream consumer
   would break.
2. **Behaviours / invariants** — the governing rules the module enforces. State
   the invariant in the test name or an `# INVARIANT:` comment.

## Conventions

- **Hermetic.** Build fixtures on `tmp_path`; never read or write real operating
  output (artifact stores, tracked logs). Side-effecting roots must be
  **redirectable** via env var so a test can point them at `tmp_path`; the exact
  variable names are a repo binding.
- **External services stay explicit.** Default local `make test` must not require
  a running database or other daemon. Service-backed tests are marked clearly and
  skip unless their URL is configured; CI may run a dedicated service-backed job.
- **No heavy deps in unit tests.** Synthesize the minimal on-disk shape a module
  consumes. Paths that genuinely need a binary tool go in a clearly-named
  integration test under `tests/`, guarded by `pytest.importorskip` + a skip when
  the corpus is absent.
- Run: `make test` (py); the web test runner in the web app dir.
