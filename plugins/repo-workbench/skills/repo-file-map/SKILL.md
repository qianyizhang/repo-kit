---
name: repo-file-map
description: Visualize every Git-tracked file in a browsable report, classify its nature, and review retention or deletion candidates. Use for a repository file inventory or visual cleanup assessment; use simplify-repository for implementing cleanup.
---

# Repository file map

Make the repository's contents understandable before choosing what to remove.
Every indexed path gets a row, including unknowns. Nature describes what a file
is; retention describes why someone still needs it. Neither size, age, identical
bytes nor a generated-file label establishes that deletion is safe.

## Build the map

Resolve the requested repository from the chat, never from the plugin directory.
Read repository instructions, status and active ownership. Locate retention rules,
entry points, build/package consumers and evidence contracts. Use the plugin’s
`file_map` tool with an explicit absolute `repo`. It returns a
fresh temporary report bundle and compact counts. For a chosen output location,
use the bundled CLI (resolved relative to this skill):

```sh
node ../../dist/cli.mjs file-map --repo /absolute/repository --out /absolute/fresh-bundle
```

Prefer an ignored `.artifacts/repo-file-map/` bundle or the user's artifact folder.
The scanner collects Git index/object metadata and changed-path sets. Git may
read working files to detect changes; the report includes no source bodies or
symlink-target content. It writes `report.html`, `inventory.json` and a README manifest into a
fresh directory. Files with unstaged edits show their **indexed** size and nature;
untracked/ignored files and Git history storage are outside this inventory.
Git LFS entries measure pointer blobs, not hydrated asset bytes.
Submodules are single entries, not recursively scanned. Conflicts remain visible
with unknown size. An empty repository is a valid empty report.

Open the report in the available browser/file viewer. The journey is overview →
folder or nature → file → evidence and proposed action. Check filtering, selection,
long paths, empty results and narrow layout. The complete table is also readable
without JavaScript. State scope and limitations with the report.

For scaffold layout changes, read the [design notes](../../docs/file-map.md).

## Turn hints into a review

Path rules only seed classification. Read representative content and local owners
for each meaningful cluster, then inspect every proposed consolidation/removal.
Distinguish source, tests, fixtures, current documentation, decisions, research
evidence, generated output, process records, assets, configuration and dependencies.
Correct misleading guesses; retain unknown when evidence is insufficient.

Trace actual consumers, including dynamic discovery, packaging and external use.
For generated files, identify the producer, inputs and recovery obligation. For
records, identify the current claim or decision they support. For consolidation,
name the destination and unique information to preserve. An empty reference
search only establishes the scope searched, not non-use.

Add exact-path reviews to a local JSON object. Use `oid` and `mode` from the
inventory to reject reviews of changed file identities. For example:

```json
{
  "docs/old-review.md": {
    "oid": "COPY_FROM_INVENTORY",
    "mode": "100644",
    "nature": "Process record",
    "action": "consolidate",
    "reason": "Keep the unresolved acceptance note in docs/status.md; the completed checks are superseded.",
    "evidence": ["docs/status.md:18", "package.json scripts.check"]
  }
}
```

Allowed actions: `keep`, `inspect`, `consolidate`, `remove`. Nature is free text;
use consistent terms within the report. Reason and evidence are required. The
tool validates structure and file identity, not whether the evidence proves the
claim. Repository-wide consumer changes can invalidate an otherwise matching
review: reassess the context on every run.

```sh
node ../../dist/cli.mjs file-map --repo /absolute/repository --reviews /absolute/reviews.json --out /absolute/fresh-reviewed-bundle
```

Unreviewed files stay explicit; never report full semantic review merely because
the inventory is complete. Dirty/conflicted paths cannot receive removal or
consolidation proposals. Identical-blob groups invite comparison, not deduplication.

## Handoff

Show the map, classification coverage, reviewed proposals, expected maintenance
benefit and unresolved obligations. Candidate bytes are indexed content bytes,
not Git-history savings. Keep the decision separate from execution: the report
has no delete operation. Use `simplify-repository` for authorized implementation.
Reuse existing authorization; do not manufacture a second approval checkpoint.

Keep this working inventory local. Its README is the sole bundle manifest; retain
it while the review is active, review after 30 days, and retire it when the useful
decisions have reached their owners. A requested permanent report can be retained
as a deliverable with its stated scope and source revision.
