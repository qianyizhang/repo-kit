#!/usr/bin/env python3
"""Create a UI discussion round without replacing existing design records."""

from __future__ import annotations

import argparse
import datetime
import html
import re
from pathlib import Path

ASSETS = Path(__file__).resolve().parents[1] / "assets"


def slug(value: str) -> str:
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value):
        raise argparse.ArgumentTypeError("Use lowercase letters, digits and single hyphens")
    return value


def date(value: str) -> str:
    if datetime.date.fromisoformat(value).isoformat() != value:
        raise ValueError("Use YYYY-MM-DD")
    return value


def scaffold(repo: Path, design_root: Path, app: str, day: str, topic: str, *, mcp: bool = False) -> Path:
    repo = repo.resolve(strict=True)
    slug(app)
    slug(topic)
    date(day)
    if design_root.is_absolute() or ".." in design_root.parts:
        raise ValueError("Design root must be relative to the repository")
    app_home = repo / design_root / app
    # Refuse redirected writes, including a symlink pointing back inside the repo.
    for path in (app_home, *app_home.parents):
        if path == repo:
            break
        if path.is_symlink():
            raise ValueError(f"Design path contains a symlink: {path}")
    round_name = f"{day}-{topic}"
    target = app_home / round_name
    if target.exists() or target.is_symlink():
        raise ValueError(f"Round already exists; resume it or choose another topic: {target}")
    values = {"APP": app, "ROUND": round_name, "ROUND_PATH": target.relative_to(repo).as_posix()}

    def render(name: str) -> str:
        content = (ASSETS / name).read_text()
        for key, value in values.items():
            content = content.replace("{{" + key + "}}", html.escape(value) if name.endswith("html") else value)
        return content

    # Read all inputs before creating files, so missing assets leave no partial round.
    readme, prototype = render("round.md"), render("index.html")
    integration = render("integration.html") if mcp else None
    prototype = prototype.replace(
        "<!-- MCP_REVIEW -->", '<a href="integration.html">MCP integration</a>' if mcp else ""
    )
    if mcp:
        readme += (
            "\n\n[MCP integration review](integration.html) — populate tool contracts and conversation fixtures.\n"
        )
    target.mkdir(parents=True, exist_ok=False)
    (target / "README.md").write_text(readme)
    (target / "index.html").write_text(prototype)
    if integration is not None:
        (target / "integration.html").write_text(integration)
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--design-root", type=Path, default=Path(".artifacts/ui-discussion"))
    parser.add_argument("--app", type=slug, required=True)
    parser.add_argument("--date", required=True, help="Round date in the user's timezone, YYYY-MM-DD")
    parser.add_argument("--topic", type=slug, required=True)
    parser.add_argument("--mcp", action="store_true", help="Include the MCP tool and conversation integration page")
    args = parser.parse_args()
    try:
        print(scaffold(args.repo, args.design_root, args.app, args.date, args.topic, mcp=args.mcp))
    except (OSError, ValueError, argparse.ArgumentTypeError) as exc:
        parser.exit(1, f"ui-discussion: {exc}\n")


if __name__ == "__main__":
    main()
