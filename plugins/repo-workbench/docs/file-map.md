# File map design

The overview answers where files and indexed bytes accumulate. Folder bars show
one hierarchy level; nature bars show composition. Both filter the same table.
The table owns file selection; the inspector owns rationale and source evidence.

Keep observed Git facts, inferred nature and reviewed action visibly distinct.
Use text with color, native buttons and labels, visible focus, wrapping paths and
a stacked narrow layout. Show counts with bytes so many small records are visible.
No deletion control, network dependencies or hidden file-content reads.

Search, folder navigation, nature/action filters and sort update one result set.
Reset restores the full inventory. Selecting a row exposes its identity, pending
changes, classification basis, duplicate peers and review. Empty results retain
the controls. Static HTML contains all rows and review details without scripts.

## Entry points and ownership

`repo-workbench file-map --repo /absolute/repo [--out /fresh/bundle] [--reviews /reviews.json]`
runs with Node and Git only. The default output is a fresh OS temporary directory;
CLI repository defaults to its invoking directory. The `file_map` MCP tool requires
an explicit absolute repository and always creates a temporary bundle. Both use
`packages/file-map/index.ts` and the same offline HTML. This export does not open
an MCP App panel or start a server. Open the returned HTML in a browser.

The plugin skill owns semantic review; the scanner reads index/object metadata
and changed-path sets without reading file bodies, following symlinks or recursing
submodules. Untracked/ignored files and working-tree contents are excluded. LFS entries
measure pointer blobs, not hydrated assets.
It refuses unavailable objects, non-UTF-8 paths, changing Git snapshots, stale
review identities and destructive proposals on dirty paths. Path classifications
and identical blobs are hints, never deletion authority. Each bundle states its
source, limits and 30-day review date. There is no background scan or deletion.

This feature replaces the pending shared `repo-file-map` skill implementation;
install the Workbench package once for use across repositories. If an earlier
standalone skill was installed, reconcile and retire that managed installation
before enabling the plugin skill of the same name. No per-repository scanner,
configuration or dependency is required.
