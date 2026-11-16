from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).parents[1] / "template/scripts/check_file_sizes.py"


class FileSizeCheckTest(unittest.TestCase):
    def setUp(self) -> None:
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.git("init", "-b", "main")
        self.git("config", "user.name", "Size check test")
        self.git("config", "user.email", "file-size-test@example.invalid")
        self.git("config", "commit.gpgsign", "false")

    def git(self, *args: str) -> str:
        return subprocess.run(["git", *args], cwd=self.root, capture_output=True, text=True, check=True).stdout.strip()

    def write(self, name: str, content: str) -> None:
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def commit(self) -> None:
        self.git("add", ".")
        self.git("commit", "--allow-empty", "-m", "Fixture revision")

    def check(self, *args: str) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(
            [sys.executable, str(SCRIPT), *args], cwd=self.root, capture_output=True, text=True, check=False
        )
        self.assertEqual(0, result.returncode, result.stderr)
        return result

    def test_reports_only_metrics_that_increase_above_their_cap(self) -> None:
        self.write("lines.md", "line\n" * 200)
        self.write("words.md", "word " * 1500)
        self.write("shrinking.py", "x = 1\n" * 1010)
        self.write("same-size.py", "x = 1\n" * 1001)
        self.write("growing.py", "x = 1\n" * 1001)
        self.write("at-cap.py", "x = 1\n" * 999)
        self.write("unchanged.md", "line\n" * 201)
        self.commit()

        self.write("lines.md", "line\n" * 201)
        self.write("words.md", "word " * 1501)
        self.write("shrinking.py", "x = 1\n" * 1009)
        self.write("same-size.py", "x = 2\n" * 1001)
        self.write("growing.py", "x = 1\n" * 1002)
        self.write("at-cap.py", "x = 1\n" * 1000)
        self.write("untracked.py", "x = 1\n" * 1001)

        self.assertEqual(
            [
                "[WARN] growing.py: 1001 -> 1002 lines (cap 1000)",
                "[WARN] lines.md: 200 -> 201 lines (cap 200)",
                "[WARN] words.md: 1500 -> 1501 words (cap 1500)",
            ],
            self.check().stdout.splitlines(),
        )

    def test_branch_comparison_uses_merge_base_and_preserves_rename_baselines(self) -> None:
        self.write("old name.swift", "let x = 1\n" * 1001)
        self.write("moved.md", "line\n" * 201)
        self.commit()
        self.git("switch", "-c", "feature")
        self.git("mv", "old name.swift", "new name.swift")
        self.git("mv", "moved.md", "new location.md")
        self.write("new name.swift", "let x = 1\n" * 1002)
        self.commit()
        self.write("added.ts", "const x = 1;\n" * 1001)
        self.commit()
        self.git("switch", "main")
        self.write("old name.swift", "let x = 1\n" * 1003)
        self.commit()
        self.git("switch", "feature")

        self.assertEqual("", self.check().stdout)
        self.assertEqual(
            [
                "[WARN] added.ts: 0 -> 1001 lines (cap 1000)",
                "[WARN] new name.swift: 1001 -> 1002 lines (cap 1000)",
            ],
            self.check("--base", "main").stdout.splitlines(),
        )

    def test_excludes_generated_vendored_and_retained_sources(self) -> None:
        self.commit()
        self.write("pyproject.toml", '[tool.file_size_check]\ncode_lines = 2\nexclude_globs = ["snapshots/*"]\n')
        self.write(".gitattributes", "schema.py linguist-generated\nupstream.py linguist-vendored=true\n")
        for name in ("generated/schema.py", "lib/vendor/lib.py", "schema.py", "upstream.py", "snapshots/example.py"):
            self.write(name, "x = 1\n" * 3)
        for doc_class in ("source", "generated"):
            self.write(f"{doc_class}.md", f"---\ndocument_class: {doc_class}\n---\n" + "line\n" * 201)
        self.write("handwritten.py", "x = 1\n" * 3)
        self.git("add", ".")

        self.assertEqual("[WARN] handwritten.py: 0 -> 3 lines (cap 2)\n", self.check().stdout)

    def test_unavailable_baseline_is_visible_but_does_not_fail(self) -> None:
        self.commit()
        result = self.check("--base", "unavailable")
        self.assertEqual("", result.stdout)
        self.assertIn("file-size-check: skipped or incomplete", result.stderr)
