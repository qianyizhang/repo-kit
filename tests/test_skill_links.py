from __future__ import annotations

import re
import unittest
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).parents[1]


class SkillLinksTest(unittest.TestCase):
    def test_relative_markdown_links_resolve(self) -> None:
        roots = (
            ROOT / ".codex" / "skills" / "maintain-repo-kit",
            ROOT / "skills",
        )
        for document in (path for root in roots for path in root.rglob("*.md")):
            # Example documents in fenced blocks name hypothetical project paths.
            prose = re.sub(r"(?ms)^```[^\n]*\n.*?^```[ \t]*$", "", document.read_text(encoding="utf-8"))
            for target in re.findall(r"\[[^\]]*\]\(([^\s)]+)\)", prose):
                url = urlsplit(target)
                if url.scheme or url.netloc or not url.path:
                    continue
                with self.subTest(document=document.relative_to(ROOT), target=target):
                    self.assertTrue((document.parent / unquote(url.path)).exists())


if __name__ == "__main__":
    unittest.main()
