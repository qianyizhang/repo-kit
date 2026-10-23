# Personal practice library — source review, 2026-10-22

The user accepted on-demand personal defaults with repo exceptions, an initial
four-topic library, and selective pstack adaptation while keeping the six Matt
skills unchanged. They then asked to refactor the user instructions as a common
core, leaving bespoke repo behavior as adaptations. This review records that
boundary and the evidence; the maintained rules live in `user/`.

## Coverage

- Inventoried all 26 top-level Git repos under `~/pkgs` and their current registered
  worktrees. Reviewed guidance/configuration across all 11 active entries in the
  user-confirmed portfolio map dated 2026-10-14. That lifecycle snapshot is distinct
  from current ownership: native EZ implementation now lives in `Saul/apps/ez`.
- Active review covered 15 root instruction files, 2 Saul app instructions,
  33 package/compiler configurations, 6 supplemental configurations and 13 topic
  documents. No repo builds or runtime acceptance checks were part of the census.
- Parsed all 91 retained user-root logs (89 with recent user records), plus an
  unrelated archived greeting; screened 1,144 index titles/metadata and retrieved
  55 additional guidance-relevant chats, covering 173 turns. Focus window:
  2026-09-22 through 2026-10-22. Another 86 recent transcripts were title-screened
  but unread. Subagent/guardian/heartbeat activity was excluded as independent
  human preference evidence. This was not every account conversation body.
- Session evidence supports nine of the eleven active entries; codex-trace and
  thoughts had repo evidence but no direct recent root-chat evidence in the sweep.
  Historical assistant reports were not treated as current test results.

## Repository census

| Lifecycle in the dated portfolio map | Repositories inventoried |
| --- | --- |
| Active (11) | astro-blog, codex-trace, ez, game, learn-ts, project-index, qi, repo-kit, Saul, tb3, thoughts |
| Stalled (5) | deepseek-harness, drug-discovery, drug-safety, med-track, tb3-clean |
| Deprecated (8) | biomed-concepts, chronical-management, conversation-workbench, h3.c, local-asr, pathway-manager, sk-agent-server, western_order-workbench |
| Archived reference (2) | generative-ai, html-effectiveness |

## Clean local sources used for synthesis

| Source at reviewed revision | Extracted principle | Kept local |
| --- | --- | --- |
| TB3 `8044b9ac514baf2cf6345fd51f63ac2dfd274bf8`, `docs/coding-style.md` | Records by meaning, typed ingress, explicit effects, faithful wire projections | Medical coordinates, schema owners, scientific evidence and dependency boundaries |
| game `f3e353d77344bf5ac375dc4c8c5e38a6a99ea72c`, `docs/engineering/testing.md` | Named protected failure, stable behavioral interface, proportionate checks | Game/Blender gates and artifact retention |
| Saul `1c1645f754a6d917b5886d1a4505a0838312df4a`, `design/SKILL.md`, `DESIGN.md` | Task and information hierarchy, representative states, rendered acceptance | Little Clarity tokens, product wording and generated assets |
| Same Saul revision, `apps/ez/docs/verification.md`, `apps/ez/AGENTS.md` | Offline, native, installed and live evidence are separate | CLT harness, signing/keychain configuration and app upgrade commands |
| repo-kit `e994319eaefa9b8c39e173955c8f9d44a771b29b`, workbench configs | Type-aware contracts and mechanical enforcement | Exact Node/compiler/lint/build settings |

Astro-blog's current design files were dirty. Their sessions informed the need to
separate accepted standards from dated research, but the dirty files were not
copied or promoted. Existing TypeScript lint stacks, Python embedded runtimes,
test layouts and publication/evidence contracts have legitimate differences.

Repeated direct user steering favors concise canonical owners, typed reusable
modules, meaningful behavioral tests, scoped checks, fast hosted CI with expensive
checks retained locally where required, and actual visual/native inspection.
Pruning preferences are contextual: explicit replay/evidence preservation is a
counterexample to any blanket deletion rule.

## Upstream review

| Source | Snapshot and scope | Decision |
| --- | --- | --- |
| [Lauren Tan's pstack](https://github.com/cursor/plugins/tree/d1453c11d1dde9714d4c313c97d3a68432265c7f/pstack), MIT | `d1453c11d1dde9714d4c313c97d3a68432265c7f`, version 0.15.29; 56 manifests and 23 playbooks inventoried, relevant leaves reviewed | Adapt type/boundary, structural-learning and experience/verification judgment; retain attribution. No whole `poteto-mode` adoption. |
| [Matt Pocock skills](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2), MIT | `5beb35b040e3de97e54fa9e386d7e42d15c295c2`; 38 manifests inventoried | All 18 files in the six selected directories match the pinned `49dd158d1076134a641b33efb035946536778336` selection. Keep unchanged. |

Pstack's workflow brings host/model/tool assumptions and autonomy rules beyond a
reference library. Matt's adjacent review/TDD/experimental TS setup offerings
also need a concrete gap before adoption. Neither inventory supplies a complete
Python or Swift/iOS standard.

Two examples in pstack's
[TS patterns](https://github.com/cursor/plugins/blob/d1453c11d1dde9714d4c313c97d3a68432265c7f/pstack/skills/typescript-best-practices/references/patterns.md)
illustrate the review requirement. Under installed TypeScript 6.0.3 strict mode,
a plain `durationMs: number` accepts `-1` despite the claimed range guarantee.
Adding `noUncheckedIndexedAccess` rejects a computed index into `NonEmpty<string>`
when the function promises an unconditional `string`. The reproduced checks
establish these limits, not an assessment of the whole suite's runtime behavior.

## Primary references and scope

Topic guides link primary references; this dated review records scope. Sources
include TypeScript/compiler and typescript-eslint documentation, React state
modeling, Python typing/PEP 8/PyPA/Ruff, Swift API/concurrency guidance, Apple HIG
and testing/accessibility documentation, and W3C WCAG/WAI evaluation guidance.
Google's TS guide explicitly notes Google-specific constraints and volunteer,
on-demand publishing; it is a selective reference rather than universal policy.

Current local Apple implementation evidence is macOS. iOS sections remain
prospective. Accessibility standards and manual evaluation are distinct from
personal minimalism or any product's aesthetic identity.

## Reconciliation and limits

The working core owns scope, source ownership, meaningful verification and
communication. Topic pages add only relevant technical/UI judgment. Repo contracts
and checks retain bespoke constraints. Existing workflows consult these defaults;
no additional orchestration skill, per-run ledger or background updater was added.

Python guidance now lives in personal practices; Copier delivers governance and
tool configuration. Existing consumer copies remain untouched. Other stale skill
bindings and compiler migrations remain separately scoped candidates.

Manual walkthroughs compared the written defaults with these surveyed cases;
they did not change or execute the consumer repositories:

| Case | Result of applying the layers |
| --- | --- |
| TypeScript change in codex-trace | Use its oxlint/oxfmt stack and required tests; the guide supplies boundary judgment without selecting ESLint. |
| Blender authoring change in game | Honor the embedded Python 3.11 target; Python 3.12 maintenance tooling does not set the runtime for that file. |
| EZ change with passing offline checks | Report the checked logic separately; native interaction, installed upgrade and live sign-in remain unverified until exercised. |
| Simplifying a populated form | Remove duplicate information while retaining labels, accessible names and keyboard/focus behavior; product tokens remain local. |
| Artifact cleanup in game or TB3 | Consult that repo's retention contract and task authorization; the common core supplies no blanket deletion rule. |
| Adding a new best-practice document | Reconcile each rule into core, topic, executable owner or repo adaptation; source text does not become global policy by being added. |

The published guidance is a local synthesis, with attributed conceptual influence
from pstack; upstream skill bodies and examples are not vendored into these pages.
Delivery tests exercise sync behavior. The walkthroughs check written routing and
consistency with these cases, not observed agent compliance. Neither measures
future agent quality or establishes UI, iOS or accessibility acceptance.

## 2026-10-23: direct MCP App messages

User review of Repo Workbench showed that an ordinary `hi` created a frozen
report and required an ID-based read of unrelated source records. The accepted
contract is now in `user/practices/mcp-apps.md`: direct user text, explicit bounded
selection context, purpose-scoped reads, and provenance only when needed. Apply
and Save remain separate. Local application owners are Workbench Reports/Canvas,
Blog Writer and Saul's board; the example app already sends text directly.

## 2026-10-23: executable MCP App practice

The user asked to turn these principles into a skill with a shared observability
scaffold: persistent App info, canonical logs, truthful status, tool contracts,
inspectable payloads, conversation fixtures and standalone operation.
[mcp-app](../../skills/mcp-app/SKILL.md) now owns the construction procedure and
starter; the practice guide retains portable principles. The
[UI discussion supplement](../../skills/ui-discussion/references/mcp-integration.md)
adds a tool/operation catalog and data-flow review page with readiness checks.

The starter reuses the local Example MCP App's tested SDK versions and the
[official MCP Apps protocol roles](https://modelcontextprotocol.io/extensions/apps/overview).
It records SDK/application-boundary evidence; host internals remain explicitly
unobserved. A generated app passed a clean locked dependency install, 9 unit and
stdio protocol tests, and 7 standalone/SDK-host browser tests. The populated
integration review passed a separate browser check for payload display, frozen
feedback and narrow layout. These establish fixture behavior, not a live Codex
round trip or retroactive adoption in existing apps.

The initial installation used an isolated skill candidate containing this task's
additions over the installed UI-discussion baseline. The independent UI readiness
changes were still pending in their source worktree. That installation replaced
no product runtime and made no commit or publication.

### Retention follow-up

The user selected metadata-only disk logs, bounded live payload inspection, and
explicit capture of one interaction. The starter and guide now implement that
policy. Captures retain masked observations only, with limits of eight captures
per session and 2 MiB per capture; startup retention excludes live processes.
The shared bundle also includes the separately reviewed UI readiness changes.

Closeout corrected two capture failures: the disk-writing capture tool advertised
itself as read-only, and a failed event lookup left the previous interaction
eligible for capture. Protocol and browser regressions reproduce both defects
before their fixes. Generated-app checks verify fixture behavior; adoption and
live conversation acceptance in existing products remain separate work.
