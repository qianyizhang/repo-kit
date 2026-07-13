#!/usr/bin/env python3
"""Validate the portable mechanics of an explain-layman binding and HTML artifacts."""

from __future__ import annotations

import argparse
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

BINDING_SCHEMA = "1"
REQUIRED_BINDING_KEYS = {
    "binding_schema",
    "profile",
    "profile_version",
    "artifact_language",
    "output_dir",
    "index_file",
    "canonical_repo_url",
    "verification_command",
    "agent_instructions",
}
REQUIRED_BINDING_SECTIONS = {
    "Audience and artifact defaults",
    "Authority and grounding",
    "Non-negotiable boundaries",
    "Vocabulary and tooltips",
    "Navigation and provenance",
    "Verification",
}
REQUIRED_ARTIFACT_METADATA = {
    "description",
    "scope",
    "status",
    "last_update",
    "produced_by",
}
PLACEHOLDER_RE = re.compile(r"\b(?:FILL_IN|TODO|TBD)\b|example\.invalid", re.I)


def parse_frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---\n", 4)
    if end < 0:
        return {}
    values: dict[str, str] = {}
    for line in text[4:end].splitlines():
        if not line or line[:1].isspace() or ":" not in line:
            continue
        key, value = line.split(":", 1)
        values[key.strip()] = value.strip().strip("\"'")
    return values


def validate_binding(path: Path) -> tuple[dict[str, str], list[str]]:
    errors: list[str] = []
    if not path.is_file():
        return {}, [f"binding does not exist: {path}"]
    text = path.read_text(encoding="utf-8")
    metadata = parse_frontmatter(text)
    missing = sorted(REQUIRED_BINDING_KEYS - metadata.keys())
    if missing:
        errors.append(f"binding metadata missing: {', '.join(missing)}")
    if metadata.get("binding_schema") != BINDING_SCHEMA:
        errors.append(f"binding_schema must be {BINDING_SCHEMA!r}, got {metadata.get('binding_schema')!r}")
    headings = set(re.findall(r"^##\s+(.+?)\s*$", text, re.M))
    missing_sections = sorted(REQUIRED_BINDING_SECTIONS - headings)
    if missing_sections:
        errors.append(f"binding sections missing: {', '.join(missing_sections)}")
    if PLACEHOLDER_RE.search(text):
        errors.append("binding still contains a placeholder (FILL_IN/TODO/TBD)")
    if metadata.get("profile_version") and not re.fullmatch(r"\d+\.\d+\.\d+", metadata["profile_version"]):
        errors.append("profile_version must be semver")
    return metadata, errors


class ArtifactParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.comments: list[str] = []
        self.links: list[str] = []
        self.term_errors: list[str] = []
        self.title: list[str] = []
        self.h1: list[str] = []
        self.footer: list[str] = []
        self.slide_count = 0
        self._captures: list[str] = []

    def handle_comment(self, data: str) -> None:
        self.comments.append(data)

    def handle_starttag(self, tag: str, attrs_list: list[tuple[str, str | None]]) -> None:
        attrs = dict(attrs_list)
        classes = set((attrs.get("class") or "").split())
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"] or "")
        if "term" in classes:
            if attrs.get("tabindex") != "0":
                self.term_errors.append('a .term is missing tabindex="0"')
            if not (attrs.get("data-tip") or "").strip():
                self.term_errors.append("a .term has an empty data-tip")
        if "slide" in classes:
            self.slide_count += 1
        if tag in {"title", "h1", "footer"}:
            self._captures.append(tag)

    def handle_endtag(self, tag: str) -> None:
        if self._captures and self._captures[-1] == tag:
            self._captures.pop()

    def handle_data(self, data: str) -> None:
        if not self._captures:
            return
        target = self._captures[-1]
        if target == "title":
            self.title.append(data)
        elif target == "h1":
            self.h1.append(data)
        elif "footer" in self._captures:
            self.footer.append(data)


def compact(parts: list[str]) -> str:
    return " ".join("".join(parts).split())


def artifact_metadata(comments: list[str]) -> dict[str, str]:
    for comment in comments:
        values: dict[str, str] = {}
        for line in comment.splitlines():
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            values[key.strip()] = value.strip()
        if "description" in values or "produced_by" in values:
            return values
    return {}


def is_local_link(href: str) -> bool:
    scheme = urlsplit(href).scheme
    return not scheme and not href.startswith(("#", "//"))


def validate_artifact(path: Path, binding: dict[str, str], repo_root: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not path.is_file():
        return [f"artifact does not exist: {path}"], warnings
    text = path.read_text(encoding="utf-8")
    parser = ArtifactParser()
    try:
        parser.feed(text)
        parser.close()
    except Exception as exc:  # HTMLParser errors are uncommon but actionable.
        errors.append(f"HTML parse failed: {exc}")
        return errors, warnings

    metadata = artifact_metadata(parser.comments)
    missing_metadata = sorted(REQUIRED_ARTIFACT_METADATA - metadata.keys())
    if missing_metadata:
        errors.append(f"artifact metadata missing: {', '.join(missing_metadata)}")
    produced_by = metadata.get("produced_by", "")
    if produced_by and "profile=" not in produced_by:
        warnings.append("legacy produced_by stamp has no profile= binding version")

    title = compact(parser.title)
    h1 = compact(parser.h1)
    footer = compact(parser.footer)
    if not title or not h1:
        errors.append("artifact must contain non-empty <title> and <h1>")
    elif title != h1:
        warnings.append(f"<title> and <h1> differ: {title!r} vs {h1!r}")
    if not footer:
        errors.append("artifact must contain a footer")
    elif h1 and h1 not in footer:
        warnings.append("footer does not repeat the H1 title")

    canonical_url = binding.get("canonical_repo_url", "")
    if canonical_url and canonical_url not in text:
        errors.append("artifact footer does not include canonical_repo_url")
    if '<meta name="viewport"' not in text and "<meta name='viewport'" not in text:
        errors.append("artifact is missing a viewport meta tag")
    if "@media" not in text:
        errors.append("artifact has no responsive media rule")
    errors.extend(parser.term_errors)

    for href in parser.links:
        if not is_local_link(href):
            continue
        linked = unquote(urlsplit(href).path)
        if linked and not (path.parent / linked).resolve().exists():
            errors.append(f"broken local link: {href}")

    if parser.slide_count > 1:
        deck_requirements = {
            "print fallback": "@media print",
            "reduced motion": "prefers-reduced-motion",
            "no-JS fallback": "<noscript",
            "live progress": "aria-live",
            "hash navigation": "hashchange",
            "keyboard navigation": "keydown",
        }
        for label, token in deck_requirements.items():
            if token not in text:
                errors.append(f"slide deck missing {label}: {token}")

    output_dir = binding.get("output_dir")
    index_file = binding.get("index_file")
    try:
        relative = path.resolve().relative_to(repo_root.resolve())
    except ValueError:
        relative = None
    if relative and output_dir and str(relative).startswith(output_dir.rstrip("/") + "/"):
        index_path = repo_root / (index_file or "")
        if index_path.is_file() and path.name not in index_path.read_text(encoding="utf-8"):
            errors.append(f"maintained artifact is absent from {index_file}")

    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("artifacts", nargs="*", type=Path)
    parser.add_argument("--binding", required=True, type=Path)
    parser.add_argument("--binding-only", action="store_true")
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    args = parser.parse_args()

    binding, binding_errors = validate_binding(args.binding)
    errors = [f"binding: {message}" for message in binding_errors]
    warnings: list[str] = []
    if not args.binding_only and not args.artifacts:
        errors.append("no artifacts supplied; use --binding-only to validate only the binding")
    if not binding_errors:
        for artifact in args.artifacts:
            artifact_errors, artifact_warnings = validate_artifact(artifact, binding, args.repo_root)
            errors.extend(f"{artifact}: {message}" for message in artifact_errors)
            warnings.extend(f"{artifact}: {message}" for message in artifact_warnings)

    for warning in warnings:
        print(f"WARN: {warning}")
    for error in errors:
        print(f"ERROR: {error}")
    if errors:
        return 1
    print(
        f"explain-layman validation: OK ({len(args.artifacts)} artifact(s), "
        f"profile={binding.get('profile', 'unknown')})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
