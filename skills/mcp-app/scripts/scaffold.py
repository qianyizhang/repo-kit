#!/usr/bin/env python3
"""Create an inspectable MCP App starter without installing or connecting it."""

from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path

ASSETS = Path(__file__).resolve().parents[1] / "assets" / "starter"


def scaffold(target: Path, name: str) -> Path:
    if not re.fullmatch(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*", name):
        raise ValueError("Name must use lowercase letters, digits and single hyphens")
    target = target.absolute()
    if target.exists() or target.is_symlink():
        raise ValueError(f"Target already exists: {target}")
    for parent in target.parents:
        if parent.is_symlink():
            raise ValueError(f"Target parent is a symlink: {parent}")
    if not target.parent.is_dir():
        raise ValueError("Target parent must exist")
    files = []
    for source in sorted(ASSETS.rglob("*")):
        if source.is_symlink():
            raise ValueError(f"Starter contains a symlink: {source}")
        if source.is_file():
            files.append((source.relative_to(ASSETS), source.read_text().replace("__APP_ID__", name)))
    created = False
    try:
        target.mkdir()
        created = True
        for relative, text in files:
            destination = target / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(text)
    except OSError:
        # Only the new directory created by this call is eligible for rollback.
        if created and target.is_dir() and not target.is_symlink():
            shutil.rmtree(target)
        raise
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--name", required=True)
    args = parser.parse_args()
    try:
        print(scaffold(args.target, args.name))
    except (OSError, ValueError) as exc:
        parser.exit(1, f"mcp-app: {exc}\n")


if __name__ == "__main__":
    main()
