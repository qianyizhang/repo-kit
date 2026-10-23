# Report surfaces

Task: inspect recorded usage, follow its evidence into a trace, and discuss an
explicit selection in the current Codex chat.

- Reuse the standalone dashboards, views and source readers.
- A small host toolbar owns connection state, Back and an explicit discussion send.
- Keep usage filters intact while inspecting a trace; long bodies load on demand.
- Theme and layout adapt to the panel. Host status stays outside report content.
- Source logs remain read-only. Send transmits the message directly; Attach selection
  is unchecked by default. Usage attachments use current filters or open evidence;
  trace attachments require a selected turn/action. Summaries exclude provenance.
  Scoped tools retrieve bounded records, exact text fields and source metadata only
  when needed. Keep the draft and attachment choice on uncertain delivery.
- Show the last cached summary while a worker refreshes the source index. Label
  its timestamp and refreshing/failed state; never present it as current. A failed
  refresh retains the visible summary and offers the existing Refresh logs action.
- Send daily/session buckets to the panel. Preserve exact event counts, reasoning
  coverage and per-event pricing bands. Load at most 100 exact usage records on
  inspection; load the full filtered records only for explicit CSV export.
- Adopt refreshed data atomically under a new revision, preserving filters and
  the discussion draft. Keep active traces pinned until deliberate refresh.
  Cached summaries can be discussed; source inspection waits for the current
  index. Reopening after the first successful scan uses the summary cache.

Both modes use the same semantic light/dark palette. Standalone follows the OS;
the embedded app follows the host. Keep status colors, selected states, tooltip
contrast and chart colors distinct. Start with all recorded dates; date presets
are explicit filters. Compressed sources retain decoded-byte provenance.

The worker records index, scan, summary and persistence timings. The panel status
tooltip includes its initial load duration; protocol status exposes worker timings.
Offline exports retain complete usage records and use the same aggregation rules.

## Interaction inspection

Preserve the report views and discussion toolbar. An App info (ⓘ) control opens
server identity/log health, the actual registered tool catalog, conversation
fixtures and individual interactions. Record frozen request/result observations;
report results are inspected after decoding the transport compression. Plain
messages attach no evidence. Persist metadata only; save payloads only through an
explicit capture of one interaction. Offline exports keep inspection in memory
and use an explicitly requested diagnostic download, with no background writer.
