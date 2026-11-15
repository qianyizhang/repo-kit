#!/usr/bin/env python3
"""Create a dependency-light behavior atlas scaffold without replacing existing work."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ASSETS = Path(__file__).resolve().parents[1] / "assets" / "behavior-atlas"


def scaffold(target: Path, model: Path | None = None) -> Path:
    """Copy the owned source bundle and optionally replace its illustrative IR."""
    target = target.absolute()
    for parent in (target, *target.parents):
        if parent.is_symlink():
            # macOS system aliases are not caller-controlled output redirections.
            if parent in (Path("/tmp"), Path("/var")) and parent.resolve() == Path("/private") / parent.name:
                continue
            raise ValueError(f"Target contains a symlink: {parent}")
    if target.exists():
        raise ValueError(f"Target already exists; resume it or choose a new path: {target}")
    files = {
        source.name: source.read_bytes()
        for source in sorted(ASSETS.iterdir())
        if source.is_file()
        and not source.is_symlink()
        and (source.suffix in {".ts", ".css", ".json", ".md"} or source.name == ".gitignore")
    }
    if model is not None:
        payload = model.read_bytes()
        json.loads(payload)
        files["example.json"] = payload
    if not {"package-lock.json", "renderer.ts", "schema.ts", "build.ts"}.issubset(files):
        raise ValueError("Scaffold source is incomplete")
    target.mkdir(parents=True, exist_ok=False)
    for name, content in files.items():
        (target / name).write_bytes(content)
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", required=True, type=Path)
    parser.add_argument("--input", type=Path, help="Optional JSON IR; schema validation runs at build")
    args = parser.parse_args()
    try:
        print(scaffold(args.target, args.input))
    except (OSError, ValueError) as exc:
        parser.exit(1, f"behavior-atlas: {exc}\n")


if __name__ == "__main__":
    main()
