# Workbench MCP review — 23 October 2026

Status: source-backed report and improvement proposals. No redesign accepted and
no runtime implementation changed by this review.

- [Written report: status, why, what, how, findings and improvement sequence](../../../reviews/2026-10-23-plugin-review.md)
- [Annotated current UI](index.html): 11 captured states, 86 component records,
  three journeys and five visual findings.
- Exact server catalogs: [Canvas](integration.html),
  [Reports](reports-integration.html), [Example](example-integration.html).

## Baseline

Working tree over `9549a5af33de`, with existing uncommitted diagnostics work.
Workbench 0.5.0 / `1dc28cdaa0f3`; Example 0.4.0 / `ee6534427155`.
[Source hashes](evidence/source-sha256.json) cover 244 frozen source files.
[Starting status](evidence/baseline.json) distinguishes existing edits from this
review. The temporary build reused installed dependencies; no fresh dependency
installation is claimed.

CUA inspected the actual bundled Workbench UI in an SDK fixture host on
23 October 2026, approximately 22:30–22:33 Asia/Shanghai. Tools reached a real
fresh stdio server with synthetic repositories and logs. Host message acceptance
and rejection stayed inside the local test host. Example's sequence and the
additional narrow/proposal screenshots came from the current browser suite.
[Capture hashes](evidence/capture-sha256.json) pin the image bytes.

Current source and design owners remain under `plugins/repo-workbench/` and
`plugins/example-mcp-app/`. The older Example anatomy is historical evidence,
not the visual baseline used here. Fixture/live separation, Apply/Save separation,
scoped attachments, and source-pinned lazy reads are retained recommendations.

## Findings and dispositions

| Finding | Evidence | Disposition |
| --- | --- | --- |
| Last send disappears from inspection after idle polling | [Observed retention result](evidence/retention-observation.json), before/after captures in the UI map | Fix first; separate housekeeping retention and pin inspected interactions |
| All-event list hides the action and pushes payload below many rows | Actual Canvas Interactions view | Group by user action, label operations and use a pinned payload pane |
| Canvas has two overlapping diagnostic shells | Connection popover followed by App info modal | Use one consistent shell; retain useful label/value identity rows |
| Usage-to-trace navigation inherits the previous scroll offset | Captured trace opens without its heading in view | Own scroll position per view |
| Example's four-role projection keeps observed and inferred behavior distinct | Current resource sequence screenshot | Retain this design; share storage policy, not the entire teaching UI |

The written report also covers the reproduced shared-server ownership mismatch,
orphaned discussion lock, shallow nested trace validator, Example CI gap,
architecture seams and delivery provenance. [Boundary probes](evidence/boundary-probes.json)
use synthetic data; they do not establish cross-chat exposure in installed Codex.

## Verification

- [Workbench source/package check](evidence/workbench-check.log): 44 Vitest and
  49 Node tests passed; one sandbox-blocked loopback test and one optional native
  configuration probe initially skipped.
- [Standalone usage rerun](evidence/usage-loopback.log): all ten tests passed,
  including loopback refresh/access behavior.
- [Workbench browser suite](evidence/workbench-browser.log): 44 passed.
- [Example source/server check](evidence/example-check.log): 12 passed.
- [Example browser suite](evidence/example-browser.log): 11 passed.
- [Root tests](evidence/root-tests.log): 103 passed, three optional Copier tests
  skipped. Source skill verification passed.
- [Independent tool discovery](evidence/tool-catalogs.json): 19 Canvas, 14 report,
  10 Example registrations; the three integration pages account for all tools.
- [Delivery comparison](evidence/delivery-hashes.json): workspace and installed
  assets match; frozen Reports/Example builds differ only in bundler path comments,
  as checked in [the difference analysis](evidence/bundle-difference-analysis.json).

The spatial readiness validator reports `ready-with-gaps`; all three integration
pages pass their contract validator. These checks validate recorded structure,
not visual completeness or user acceptance. The product captures were visually inspected. The review frame passes syntax and
reference checks; its own browser render was not verified because this browser
blocks local file URLs. The files were queued in Codex’s file panel instead.

## Coverage still pending

- Native rendered panels and actual conversation delivery: the attached servers
  answered status probes, but the MCP panel-tab inventory was empty. Native Codex
  UI automation was unavailable.
- Exhaustive editing/type/group/relationship/note/source dialog inventory.
- Every pricing/source/chart/filter/action variant and a full keyboard,
  screen-reader and contrast audit.
- A new exhaustive Example anatomy across every scenario. Its current browser
  suite passed; only the resource sequence is mapped in this round.

No global guidance, product contracts, installation, commit or publication was
performed. Ownership for this review is limited to this directory, its app index,
and `docs/reviews/2026-10-23-plugin-review.md`. Concurrent documentation cleanup
can proceed elsewhere; this review does not own the pending diagnostics changes.
The recommended next implementation is the bounded interaction-retention slice
specified in the written report.

Comments in the HTML review remain in page memory until explicitly exported.
This dated review is evidence; accepted behavior belongs in the existing product
source and design owners.
