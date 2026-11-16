#!/usr/bin/env python3
"""Report growth beyond the advisory size limits in changed Git files."""

import argparse
import os
import subprocess
import sys
import tomllib
from dataclasses import dataclass
from fnmatch import fnmatchcase
from itertools import batched
from pathlib import Path

from check_docs import parse_frontmatter

DOC_SUFFIXES = frozenset(".md .mdx .markdown .rst .adoc".split())
CODE_SUFFIXES = frozenset(
    """
    .c .cc .cpp .cs .css .cxx .ex .exs .go .h .hpp .html .java .js .jsx
    .kt .kts .lua .m .mm .mjs .cjs .php .ps1 .py .pyi .r .rb .rs .scala
    .sh .sql .svelte .swift .ts .tsx .mts .cts .vue .zig
    """.split()
)
EXCLUDED_DIRS = frozenset("build dist generated node_modules third-party third_party vendor vendored".split())


@dataclass(frozen=True)
class Policy:
    doc_lines: int = 200
    doc_words: int = 1500
    code_lines: int = 1000
    exclude_globs: tuple[str, ...] = ()


def load_policy(root: Path) -> Policy:
    try:
        config = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
    except FileNotFoundError:
        return Policy()
    tool = config.get("tool", {})
    if not isinstance(tool, dict):
        raise ValueError("[tool] must be a table")
    table = tool.get("file_size_check", {})
    if not isinstance(table, dict):
        raise ValueError("[tool.file_size_check] must be a table")
    defaults = Policy()
    limits = {}
    for key in ("doc_lines", "doc_words", "code_lines"):
        value = table.get(key, getattr(defaults, key))
        if type(value) is not int or value < 1:
            raise ValueError(f"[tool.file_size_check].{key} must be a positive integer")
        limits[key] = value
    patterns = table.get("exclude_globs", [])
    if not isinstance(patterns, list) or not all(isinstance(pattern, str) for pattern in patterns):
        raise ValueError("[tool.file_size_check].exclude_globs must be an array of strings")
    return Policy(**limits, exclude_globs=tuple(patterns))


def git(root: Path, *args: str, data: bytes | None = None) -> bytes:
    result = subprocess.run(
        ["git", "--no-optional-locks", *args], cwd=root, input=data, capture_output=True, check=False
    )
    if result.returncode:
        detail = result.stderr.decode(errors="replace").strip()
        raise ValueError(f"git {args[0]} failed{': ' + detail if detail else ''}")
    return result.stdout


def changed_files(root: Path, baseline: str, policy: Policy) -> dict[str, str | None]:
    raw = git(
        root,
        "diff",
        "--name-status",
        "-z",
        "--find-renames",
        "--diff-filter=AMRT",
        "--ignore-submodules=all",
        baseline,
        "--",
    )
    fields = iter(os.fsdecode(raw).split("\0")[:-1])
    changes = {}
    for status in fields:
        path = next(fields)
        old = None if status[0] in "AT" else path
        if status.startswith("R"):
            path = next(fields)
        file = root / path
        suffix = file.suffix.lower()
        if suffix not in DOC_SUFFIXES and suffix not in CODE_SUFFIXES:
            continue
        if EXCLUDED_DIRS.intersection(part.lower() for part in Path(path).parts[:-1]):
            continue
        if any(fnmatchcase(path, pattern) for pattern in policy.exclude_globs):
            continue
        if not file.is_symlink() and file.resolve().is_relative_to(root) and file.is_file():
            changes[path] = old
    if not changes:
        return changes

    attrs = git(
        root,
        "check-attr",
        "-z",
        "--stdin",
        "linguist-generated",
        "linguist-vendored",
        data=b"".join(os.fsencode(path) + b"\0" for path in changes),
    )
    for path, _, value in batched(os.fsdecode(attrs).split("\0")[:-1], 3):
        if value in {"set", "true"}:
            changes.pop(path, None)
    return changes


def read_text(data: bytes) -> str | None:
    if b"\0" in data:
        return None
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return None


def report_sizes(root: Path, baseline: str, policy: Policy) -> None:
    for path, old in sorted(changed_files(root, baseline, policy).items()):
        current = read_text((root / path).read_bytes())
        if current is None:
            continue
        is_doc = Path(path).suffix.lower() in DOC_SUFFIXES
        if is_doc and parse_frontmatter(current)[0].get("document_class") in {"generated", "source"}:
            continue
        previous = (read_text(git(root, "cat-file", "blob", f"{baseline}:{old}")) or "") if old is not None else ""
        lines_limit = policy.doc_lines if is_doc else policy.code_lines
        counts = [("lines", len(previous.splitlines()), len(current.splitlines()), lines_limit)]
        if is_doc:
            counts.append(("words", len(previous.split()), len(current.split()), policy.doc_words))
        over = [
            f"{before} -> {after} {unit} (cap {cap})"
            for unit, before, after, cap in counts
            if after > cap and after > before
        ]
        if over:
            label = path if path.isprintable() else repr(path)
            print(f"[WARN] {label}: {'; '.join(over)}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="HEAD", help="Compare with the merge base of HEAD and this Git ref")
    args = parser.parse_args()
    try:
        root = Path(os.fsdecode(git(Path.cwd(), "rev-parse", "--show-toplevel").rstrip(b"\n"))).resolve()
        baseline = git(root, "merge-base", "--", "HEAD", args.base).decode().strip()
        report_sizes(root, baseline, load_policy(root))
    except (OSError, ValueError) as exc:
        print(f"file-size-check: skipped or incomplete: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
