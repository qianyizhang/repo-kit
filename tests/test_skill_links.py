from __future__ import annotations

import importlib.util
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).parents[1]
SPEC = importlib.util.spec_from_file_location("link_doc_rules", ROOT / "template/scripts/check_docs.py")
assert SPEC and SPEC.loader
DOC_RULES = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = DOC_RULES
SPEC.loader.exec_module(DOC_RULES)


def prose(content: str) -> str:
    # Examples inside fenced code name hypothetical paths and headings.
    return re.sub(r"(?ms)^(`{3,}|~{3,})[^\n]*\n.*?^\1[ \t]*$", "", content)


def markdown_anchors(content: str) -> set[str]:
    content = prose(content)
    anchors = set(re.findall(r"<[^>]+\b(?:id|name)=[\"\']([^\"\']+)[\"\']", content))
    used: set[str] = set()
    for heading in re.findall(r"(?m)^#{1,6}\s+(.+?)\s*#*$", content):
        heading = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", heading)
        heading = re.sub(r"<[^>]*>", "", heading)
        base = re.sub(r"[^\w\- ]", "", heading.lower()).replace(" ", "-")
        anchor, number = base, 0
        while anchor in used:
            number += 1
            anchor = f"{base}-{number}"
        used.add(anchor)
        anchors.add(anchor)
    return anchors


def local_link_errors(document: Path, root: Path) -> list[str]:
    errors = []
    for match in DOC_RULES.MARKDOWN_LINK_PATTERN.finditer(prose(document.read_text(encoding="utf-8"))):
        target = match.group(2) or match.group(3)
        url = urlsplit(target)
        if url.scheme or url.netloc:
            continue
        destination = (document.parent / unquote(url.path)).resolve() if url.path else document.resolve()
        # Private historical evidence is audited locally, not required on CI hosts.
        if not destination.is_relative_to(root):
            continue
        if not destination.exists() and destination.is_relative_to(root / "template"):
            destination = Path(f"{destination}.jinja")
        if not destination.exists():
            errors.append(f"Missing destination: {target}")
        elif url.fragment and destination.is_file() and destination.name.endswith((".md", ".md.jinja")):
            if unquote(url.fragment) not in markdown_anchors(destination.read_text(encoding="utf-8")):
                errors.append(f"Missing heading: {target}")
    return errors


class SkillLinksTest(unittest.TestCase):
    def test_tracked_symlinks_resolve(self) -> None:
        paths = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
        for name in filter(None, paths):
            path = ROOT / name
            if path.is_symlink():
                with self.subTest(path=name, target=str(path.readlink())):
                    self.assertTrue(path.exists(), "Dangling repository symlink")

    def test_relative_markdown_links_resolve(self) -> None:
        paths = (
            subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=ROOT)
            .decode()
            .split("\0")
        )
        for name in paths:
            # Check the working deliverable, including additions and planned deletions.
            # Surviving links to a deleted file still fail in local_link_errors.
            if name.endswith((".md", ".md.jinja")) and (ROOT / name).is_file():
                with self.subTest(document=name):
                    self.assertEqual(local_link_errors(ROOT / name, ROOT), [])

    def test_removed_heading_is_not_hidden_by_file_existence_or_fenced_examples(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            document = root / "guide.md"
            document.write_text("# Guide\n[Old](#retired)\n```md\n## Retired\n```\n")
            self.assertEqual(local_link_errors(document, root), ["Missing heading: #retired"])
            document.write_text(document.read_text() + "\n## Retired\n")
            self.assertEqual(local_link_errors(document, root), [])

    def test_fragments_titles_spaces_and_rendered_template_destinations(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            template = root / "template"
            template.mkdir()
            (template / "AGENTS.md.jinja").write_text("# Agent rules\n")
            (template / "a (draft).md").write_text('## Usage\n## Usage\n<a id="stable"></a>\n')
            document = template / "CLAUDE.md"
            document.write_text(
                '[Rules](AGENTS.md#agent-rules "Rules")\n'
                "[Duplicate](<a (draft).md#usage-1>)\n"
                "[Explicit](<a (draft).md#stable>)\n"
            )
            self.assertEqual(local_link_errors(document, root), [])


if __name__ == "__main__":
    unittest.main()
