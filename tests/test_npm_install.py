from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]


class NpmInstallGateTest(unittest.TestCase):
    def setUp(self) -> None:
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.temp = Path(temp.name)
        self.repo = self.temp / "repo with spaces"
        self.repo.mkdir()
        self.remote = self.temp / "remote.git"
        self.run_git("init", "-q")
        self.run_git("config", "user.name", "Install gate test")
        self.run_git("config", "user.email", "test@example.invalid")
        self.run_git("config", "core.hooksPath", ".githooks")
        for name in ("scripts/check_npm_install.py", ".githooks/pre-push"):
            target = self.repo / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        (self.repo / ".githooks/pre-push").chmod(0o755)
        subprocess.run(["git", "init", "--bare", "-q", str(self.remote)], check=True)
        self.run_git("remote", "add", "origin", str(self.remote))
        self.calls = self.temp / "calls.jsonl"
        executables = self.temp / "bin"
        executables.mkdir()
        # This process double checks the gate's invocation/isolation; real npm
        # resolution is covered by the live gate, not by this offline unit suite.
        npm = executables / "npm"
        npm.write_text(
            f"#!{sys.executable}\n"
            "import json, os, sys\n"
            "from pathlib import Path\n"
            "args=sys.argv[1:]\n"
            "assert args[0] == 'ci' and '--engine-strict' in args\n"
            "assert not Path('node_modules').exists()\n"
            "assert 'GIT_INDEX_FILE' not in os.environ and 'GIT_DIR' not in os.environ\n"
            "cache=Path(args[args.index('--cache')+1])\n"
            "assert not cache.exists()\n"
            "cache.mkdir(); (cache/'populated').write_text('cache must not cross packages')\n"
            "package=json.loads(Path('package.json').read_text())\n"
            "with open(os.environ['NPM_GATE_CALLS'],'a') as log:\n"
            " log.write(json.dumps({'name':package['name'],'cwd':os.getcwd(),'cache':str(cache)})+'\\n')\n"
            "sys.exit(7 if package['name']=='broken' else 0)\n"
        )
        npm.chmod(0o755)
        self.env = {**os.environ, "PATH": str(executables) + os.pathsep + os.environ["PATH"]}
        self.env["NPM_GATE_CALLS"] = str(self.calls)

    def run_git(self, *args: str) -> str:
        return subprocess.check_output(["git", *args], cwd=self.repo, text=True).strip()

    def package(self, directory="app", name="valid") -> Path:
        path = self.repo / directory
        path.mkdir(exist_ok=True)
        (path / "package.json").write_text(json.dumps({"name": name, "version": "1.0.0"}))
        (path / "package-lock.json").write_text('{"lockfileVersion":3}')
        return path

    def commit(self) -> str:
        self.run_git("add", ".")
        self.run_git("commit", "-qm", "candidate")
        return self.run_git("rev-parse", "HEAD")

    def invoke(self, *args: str, updates="") -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, "scripts/check_npm_install.py", *args],
            cwd=self.repo,
            env=self.env,
            input=updates,
            text=True,
            capture_output=True,
        )

    def records(self) -> list[dict]:
        return [json.loads(line) for line in self.calls.read_text().splitlines()] if self.calls.exists() else []

    def test_export_uses_commit_and_separate_empty_caches_without_mutating_checkout(self) -> None:
        first = self.package("one")
        self.package("two")
        commit = self.commit()
        (first / "package.json").write_text('{"name":"broken"}')
        (first / "node_modules").mkdir()
        sentinel = first / "node_modules/keep"
        sentinel.write_text("local install")
        self.env["GIT_INDEX_FILE"] = str(self.repo / ".git/index")
        result = self.invoke("--revision", commit)
        self.assertEqual(0, result.returncode, result.stderr)
        records = self.records()
        self.assertEqual(["valid", "valid"], [r["name"] for r in records])
        self.assertEqual(2, len({r["cache"] for r in records}))
        self.assertTrue(all(not Path(r["cwd"]).exists() for r in records))
        self.assertEqual("local install", sentinel.read_text())
        self.assertEqual('{"name":"broken"}', (first / "package.json").read_text())

    def test_failed_install_rejects_actual_push_then_valid_commit_pushes(self) -> None:
        package = self.package(name="broken")
        broken = self.commit()
        (package / "package.json").write_text('{"name":"valid"}')
        valid = self.commit()
        # Push a non-HEAD tip: checking the current checkout would incorrectly pass.
        result = subprocess.run(
            ["git", "push", "origin", f"{broken}:refs/heads/main"],
            cwd=self.repo,
            env=self.env,
            text=True,
            capture_output=True,
        )
        self.assertNotEqual(0, result.returncode)
        self.assertIn("push blocked", result.stderr)
        self.assertEqual("", self.run_git("ls-remote", "--heads", "origin"))
        result = subprocess.run(
            ["git", "push", "origin", f"{valid}:refs/heads/main"],
            cwd=self.repo,
            env=self.env,
            text=True,
            capture_output=True,
        )
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn(valid, self.run_git("ls-remote", "--heads", "origin"))
        self.assertEqual(["broken", "valid"], [r["name"] for r in self.records()])
        self.assertTrue(all(not Path(r["cwd"]).exists() for r in self.records()))

    def test_ref_deletions_skip_and_shared_tag_commit_runs_once(self) -> None:
        self.package()
        commit = self.commit()
        self.run_git("tag", "-a", "v1", "-m", "tag")
        tag = self.run_git("rev-parse", "v1")
        zero = "0" * 40
        updates = (
            f"refs/heads/main {commit} refs/heads/main {zero}\n"
            f"refs/tags/v1 {tag} refs/tags/v1 {zero}\n"
            f"(delete) {zero} refs/heads/retired {commit}\n"
        )
        result = self.invoke(updates=updates)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual(1, len(self.records()))

    def test_missing_lock_and_invalid_ref_input_fail_closed(self) -> None:
        package = self.package()
        (package / "package-lock.json").unlink()
        commit = self.commit()
        result = self.invoke("--revision", commit)
        self.assertNotEqual(0, result.returncode)
        self.assertIn("needs package-lock.json", result.stderr)
        self.assertEqual([], self.records())
        result = self.invoke(updates="invalid update")
        self.assertNotEqual(0, result.returncode)


if __name__ == "__main__":
    unittest.main()
