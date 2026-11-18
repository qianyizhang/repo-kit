# File map design

- **Goal** · Find where tracked files and indexed bytes accumulate. Show folder and nature distributions with counts and bytes.
- **Outcome** · One offline report with a shared result table and a file inspector. Static HTML includes all rows and review details.

| Surface                | Responsibility                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Folder and nature bars | Filter one level of folders or show file composition                                                               |
| Result table           | Search, folder, nature/action filters, sort and selection. Reset restores all rows. Empty results retain controls. |
| File inspector         | Identity, pending changes, classification basis, duplicate peers, rationale and source evidence                    |

- **Evidence** · Distinguish observed Git facts, inferred classification and reviewed action. Identical blobs and path classifications are hints. Deletion authority stays with the repository.
- **Access** · Text with color, native buttons and labels, visible focus, wrapping paths and a stacked narrow layout.

## Entry points and ownership

| Entry                                                                                           | Outcome                                                                                                |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `repo-workbench file-map --repo /absolute/repo [--out /fresh/bundle] [--reviews /reviews.json]` | Offline HTML. Defaults to the invoking repo and a fresh OS temporary directory.                        |
| `file_map` MCP tool                                                                             | Same report in a temporary bundle. Requires an explicit absolute repo path.                            |
| `packages/file-map/index.ts`                                                                    | Shared scanner and export. Node and Git only.                                                          |
| Plugin skill                                                                                    | Semantic review. Reconcile and retire any earlier standalone skill with the same name before enabling. |

- **Inventory scope** · Git index/object metadata and changed-path sets. Excludes file bodies, untracked/ignored files, working-tree bytes, symlink targets and submodule contents. LFS bytes reflect pointers.
- **Refusal conditions** · Unavailable objects, non-UTF-8 paths, changing snapshot, stale review identity or a destructive proposal on a dirty path.
- **Report boundary** · Open the returned HTML in a browser. Each bundle names its source, limits and 30-day review date.
