#!/usr/bin/env python3
"""Create or repair the agent-toolchain symlink layout (doctrine: docs/rules/governance.md).

INVARIANT: `.codex/` holds the real agent assets; every other discovery path
(`.agents`, `.claude/skills`, …) is a **relative symlink into it**. The expected
map lives in `pyproject.toml [tool.doc_governance.symlinks]` (the same block
`check_docs.py` verifies), so this script and the linter never disagree.

What it does, per declared link:
- missing              → create the relative symlink;
- wrong/broken symlink → repair it (unlink, recreate);
- already correct      → leave it;
- a **real** file/dir  → FAIL CLOSED. Consolidating a duplicated real copy into
  the canonical `.codex/` tree is a judgment step (which copy is authoritative,
  what to keep) that must not be silently clobbered.

Usage:
    python scripts/bootstrap_agents.py            # create/repair, fail closed on real paths
    python scripts/bootstrap_agents.py --check     # report only, non-zero if any repair needed
"""

import os
import sys
import tomllib
from pathlib import Path


def load_symlinks(repo_root: Path) -> dict[str, str]:
    pyproject = repo_root / "pyproject.toml"
    try:
        raw = tomllib.loads(pyproject.read_text(encoding="utf-8"))
    except (OSError, tomllib.TOMLDecodeError) as e:
        sys.exit(f"bootstrap_agents: cannot read {pyproject}: {e}")
    cfg = raw.get("tool", {}).get("doc_governance")
    if cfg is None:
        sys.exit("bootstrap_agents: missing [tool.doc_governance] in pyproject.toml (see docs/rules/governance.md)")
    return dict(cfg.get("symlinks", {}))


def bootstrap(repo_root: Path, check_only: bool) -> int:
    repo_root = repo_root.resolve()
    symlinks = load_symlinks(repo_root)
    if not symlinks:
        print("bootstrap_agents: no [tool.doc_governance.symlinks] declared; nothing to do.")
        return 0

    errors: list[str] = []
    repairs: list[tuple[str, Path, str, Path]] = []
    destinations: list[Path] = []
    declared_paths: list[Path] = []

    # Validate the complete map before creating a directory or replacing a link.
    for link, target in symlinks.items():
        if not isinstance(target, str) or not target or Path(target).is_absolute():
            errors.append(f"'{link}': target must be a nonempty relative path")
            continue
        if not link or Path(link).is_absolute() or Path(link).name in {"", ".", ".."}:
            errors.append(f"'{link}': link must name a relative path inside the repository")
            continue
        link_path = repo_root / link
        declared_paths.append(Path(os.path.normpath(link_path)))
        try:
            parent = link_path.parent.resolve()
            destination = parent / link_path.name
            resolved_target = (parent / target).resolve()
            if not destination.is_relative_to(repo_root) or not resolved_target.is_relative_to(repo_root):
                errors.append(f"'{link}' → '{target}': resolved parent or target escapes the repository")
                continue
            destinations.append(destination)
            ancestor = parent
            while not ancestor.exists() and not ancestor.is_symlink():
                ancestor = ancestor.parent
            if not ancestor.is_dir():
                errors.append(f"'{link}': parent is not a directory: '{ancestor}'")
                continue
            if not resolved_target.exists():
                errors.append(f"'{link}' → '{target}': target does not exist (create the canonical asset dir first)")
                continue
            if destination.is_symlink():
                actual = os.readlink(destination)
                if actual == target and destination.resolve() == resolved_target:
                    continue
                message = f"'{link}': symlink → '{actual}', expected '{target}'"
            elif destination.exists():
                errors.append(
                    f"'{link}' is a real path, not a symlink. Consolidate its contents into the canonical "
                    f"target ('{target}') by hand, remove '{link}', then re-run this script."
                )
                continue
            else:
                message = f"'{link}': missing, will link → '{target}'"
            repairs.append((message, destination, target, resolved_target))
        except (OSError, RuntimeError) as exc:
            errors.append(f"'{link}' → '{target}': cannot resolve layout: {exc}")

    # Overlapping destinations would make preflight depend on mutation order.
    for paths in (declared_paths, destinations):
        for index, destination in enumerate(paths):
            for other in paths[index + 1 :]:
                if destination.is_relative_to(other) or other.is_relative_to(destination):
                    errors.append(f"Overlapping symlink destinations: '{destination}' and '{other}'")

    if errors or check_only:
        for message, _, _, _ in repairs:
            print(f"[NEEDS REPAIR] {message}")
        for error in errors:
            print(f"[FAIL] {error}")
        if errors or repairs:
            return 1
    else:
        for message, destination, target, resolved_target in repairs:
            try:
                destination.parent.mkdir(parents=True, exist_ok=True)
                # Recheck the preflight boundary before each write as well.
                if destination.parent.resolve() != destination.parent:
                    raise OSError("parent changed after preflight")
                if destination.is_symlink():
                    destination.unlink()
                destination.symlink_to(target)
                if not destination.exists() or destination.resolve() != resolved_target:
                    raise OSError("created link does not resolve to its preflight target")
            except (OSError, RuntimeError) as exc:
                print(f"[FAIL] {message}: {exc}")
                return 1
            print(f"[REPAIRED] {message}")
    if not repairs:
        print("bootstrap_agents: symlink layout already correct.")
    return 0


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    check_only = "--check" in sys.argv[1:]
    return bootstrap(repo_root, check_only)


if __name__ == "__main__":
    sys.exit(main())
