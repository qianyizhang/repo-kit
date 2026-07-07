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


def target_exists(link_path: Path, target: str) -> bool:
    # SAMPLE: link ".claude/skills", target "../.codex/skills" → ".codex/skills"
    # normpath collapses ".." lexically, so this works before the link's parent
    # dir (".claude") is created.
    resolved = Path(os.path.normpath(link_path.parent / target))
    return resolved.exists()


def bootstrap(repo_root: Path, check_only: bool) -> int:
    symlinks = load_symlinks(repo_root)
    if not symlinks:
        print("bootstrap_agents: no [tool.doc_governance.symlinks] declared; nothing to do.")
        return 0

    errors: list[str] = []
    repairs: list[str] = []

    for link, target in symlinks.items():
        link_path = repo_root / link

        if not target_exists(link_path, target):
            errors.append(f"'{link}' → '{target}': target does not exist (create the canonical asset dir first)")
            continue

        if link_path.is_symlink():
            actual = os.readlink(link_path)
            if actual == target and link_path.resolve().exists():
                continue  # already correct
            repairs.append(f"'{link}': symlink → '{actual}', expected '{target}'")
            if not check_only:
                link_path.unlink()
                link_path.parent.mkdir(parents=True, exist_ok=True)
                link_path.symlink_to(target)
            continue

        if link_path.exists():
            # A real file/dir sits where a symlink belongs — never clobber it.
            errors.append(
                f"'{link}' is a real path, not a symlink. Consolidate its contents into the canonical "
                f"target ('{target}') by hand, remove '{link}', then re-run this script."
            )
            continue

        # Missing entirely → create.
        repairs.append(f"'{link}': missing, will link → '{target}'")
        if not check_only:
            link_path.parent.mkdir(parents=True, exist_ok=True)
            link_path.symlink_to(target)

    for r in repairs:
        print(("[NEEDS REPAIR] " if check_only else "[REPAIRED] ") + r)
    for e in errors:
        print(f"[FAIL] {e}")

    if errors:
        return 1
    if check_only and repairs:
        return 1
    if not repairs:
        print("bootstrap_agents: symlink layout already correct.")
    return 0


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    check_only = "--check" in sys.argv[1:]
    return bootstrap(repo_root, check_only)


if __name__ == "__main__":
    sys.exit(main())
