# Repo Canvas verification

Use these checks for changes to the [Canvas design](canvas-design.md) or
[proposal comparison](canvas-proposal-comparison.md).

Capture the actual delivered UI before editing and compare matched states after:
1440×1000 desktop, 740×950 compact host, and 390×844 mobile. Use the same saved
architecture, root selection and 80% diagram zoom for comparisons. Keep original
full screenshots and annotate only report crops. Label simulated MCP hosts.

Check the main journey, source preview/editing, proposal review, real stale edits,
keyboard menu access, export/import, Undo, Reload and panel close/reopen. Verify
normal text contrast at 4.5:1 and meaningful focus/control contrast at 3:1. Retain
reduced-motion support. Canvas uses the host theme when provided and follows
the OS in standalone mode. Check both themes where the change can affect them.
The proposal comparison browser test checks close-button contrast in dark mode
and narrow layout in light mode; those checks do not cover the whole app.

Run the normal repository gate and the Repo Canvas browser suite. Report actual
Codex host integration separately from protocol and simulated-host browser tests.
