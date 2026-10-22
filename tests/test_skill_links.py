from __future__ import annotations

import re
import subprocess
import unittest
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).parents[1]


class SkillLinksTest(unittest.TestCase):
    def test_tracked_symlinks_resolve(self) -> None:
        paths = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
        for name in filter(None, paths):
            path = ROOT / name
            if path.is_symlink():
                with self.subTest(path=name, target=str(path.readlink())):
                    self.assertTrue(path.exists(), "Dangling repository symlink")

    def test_relative_markdown_links_resolve(self) -> None:
        roots = (
            ROOT / ".codex" / "skills" / "maintain-repo-kit",
            ROOT / "skills",
            ROOT / "docs",
            ROOT / "user",
            ROOT / "plugins" / "repo-workbench" / "docs",
            ROOT / "plugins" / "repo-workbench" / "skills",
        )
        documents = [path for root in roots for path in root.rglob("*.md")]
        documents.extend(ROOT.glob("*.md"))
        documents.extend((ROOT / "plugins" / "repo-workbench").glob("*.md"))
        documents.extend((ROOT / "plugins" / "repo-workbench" / "packages").glob("*/README.md"))
        for document in documents:
            # Example documents in fenced blocks name hypothetical project paths.
            prose = re.sub(r"(?ms)^```[^\n]*\n.*?^```[ \t]*$", "", document.read_text(encoding="utf-8"))
            for target in re.findall(r"\[[^\]]*\]\(([^\s)]+)\)", prose):
                url = urlsplit(target)
                if url.scheme or url.netloc or not url.path:
                    continue
                destination = (document.parent / unquote(url.path)).resolve()
                # Historical evidence may live in sibling repos or private logs.
                if not destination.is_relative_to(ROOT):
                    continue
                with self.subTest(document=document.relative_to(ROOT), target=target):
                    self.assertTrue(destination.exists())


if __name__ == "__main__":
    unittest.main()
