# Repo Canvas design: Little Clarity adaptation

This contract applies only to `packages/repo-canvas`. It does not replace the
Card Workshop game or art direction. The main path is **view architecture → inspect
source → discuss → review a proposal → apply and save**.

## Source and provenance

Adapted on 2026-10-15 from Qianyi Zhang's public
[Little Clarity DESIGN.md](https://github.com/qianyizhang/Saul/blob/a0b81e40e6bbf5b72486eb0322e7b1dd586dc8f5/DESIGN.md)
in `qianyizhang/Saul`, contract version `alpha`, commit
`a0b81e40e6bbf5b72486eb0322e7b1dd586dc8f5`, file blob
`bee59d0053de95aa744dd4d5802dd3f239552243`.
The source describes EZ as its initial visual reference. The user's remembered
`ez/docs/design.md` was accessible and confirmed that Saul owns the shared contract;
no private application content or configuration is copied here.

This is a scoped adaptation of the public roles and principles, not a synchronized
installation of Saul's generator kit. Repo Canvas keeps its existing React/CSS
implementation and dark appearance. No sibling checkout, token generator, new
package or native application is required. Future updates should review the pinned
source and this mapping together rather than silently claiming upstream parity.

## Roles and adaptations

| Role       | Upstream dark value | Repo Canvas use                         |
| ---------- | ------------------- | --------------------------------------- |
| Canvas     | `#20211f`           | Architecture plane and input background |
| Surface    | `#292b27`           | Header, explorer, inspector and chat    |
| Subtle     | `#30332e`           | Quiet secondary controls and hover      |
| Ink        | `#e8e9e2`           | Primary content                         |
| Muted      | `#b3b9ae`           | Readable captions and secondary content |
| Line       | `#454b40`           | Dividers and panel boundaries           |
| Primary    | `#6ec2a1`           | Save, selection and keyboard focus      |
| On primary | `#14251d`           | Text on the primary action              |
| Wash       | `#253d31`           | Selection and proposal context          |

The CSS custom properties at the top of `styles.css` implement these roles. Use
neutral module surfaces; category names remain text rather than unrelated blue,
purple or brown bands. Spatial connections retain their functional emphasis.

Use the upstream serif subject role for the current scope heading, at 22 px on
wide screens and 20 px in compact layouts. Navigation, module names and controls
stay system sans. Compact architecture controls use 13 px; captions use 12 px;
chat answers use the upstream 15 px reading size and 1.65 line height. These are
intentional density adaptations from the upstream 24/15/14/12 px scale. Canvas
zoom still scales the diagram; preserve zoom and Fit view controls.

## Hierarchy and disclosure

- Keep checkout path, host mode and saved/draft state in the header at every width.
  A hosted iframe is not proof of a real Codex connection. Use `MCP host session`
  or `Standalone preview`; do not infer liveness from decorative indicators.
- Give Inspect and Side chat direct toolbar access. Save remains in the header.
  Apply remains beside its reviewed proposal and never silently writes the map.
- Group module creation, Undo, Export, Import and Reload under **Map actions**.
  Use native disclosure semantics, keyboard activation and Escape-to-close with
  focus returned to the summary. Keep each action's existing safety behavior.
- Show source references directly. Put path editing under **Edit source paths**.
  Suggested questions and storage explanation are optional disclosures.
- Remove repeated branding, ornamental module numbers and repeated network labels.
  Use spacing and type hierarchy rather than nested decorative cards.
- At narrow widths, stack the active inspector/chat below the architecture. It must
  not cover navigation, Save or the canvas controls. Give each panel an explicit
  close action. Preserve text wrapping and visible state; avoid horizontal overflow.

## Review and verification

Capture the actual delivered UI before editing and compare matched states after:
1440×1000 desktop, 740×950 compact host, and 390×844 mobile. Use the same saved
architecture, root selection and 80% diagram zoom for comparisons. Keep original
full screenshots and annotate only report crops. Label simulated MCP hosts.

Check the main journey, source preview/editing, proposal review, real stale edits,
keyboard menu access, export/import, Undo, Reload and panel close/reopen. Verify
normal text contrast at 4.5:1 and meaningful focus/control contrast at 3:1. Retain
reduced-motion support. Dark appearance is the existing supported scope; this
adaptation does not add or claim verification of a light theme.

Run the normal repository gate and the Repo Canvas browser suite. Report actual
Codex host integration separately from protocol and simulated-host browser tests.
