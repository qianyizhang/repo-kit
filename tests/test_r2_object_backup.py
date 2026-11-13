"""Exercise the generated client without sending bytes to the public service."""

import os
import runpy
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SCAFFOLD = ROOT / "skills/r2-object-backup/scripts/scaffold.py"


class R2ObjectBackupTest(unittest.TestCase):
    def test_generated_workflow_resumes_rejects_bad_bytes_and_restores(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            tool = root / "object-backup"
            subprocess.run(
                [sys.executable, str(SCAFFOLD), "--target", str(tool), "--namespace", "test-project/assets"],
                check=True,
            )
            for name, data in {"a.bin": b"a", "b.bin": b"b", "private.bin": b"not listed"}.items():
                (root / name).write_bytes(data)
            api = runpy.run_path(str(tool / "backup.py"))
            functions = api["main"].__globals__
            config = {**api["read_json"](tool / "inventory.json"), "files": ["b.bin", "a.bin"]}
            api["write_json"](tool / "inventory.json", config)
            manifest = tool / "manifest.json"
            planned = api["plan"](config, root, None)
            self.assertEqual(set(planned["files"]), {"a.bin", "b.bin"})
            store = {}
            posts = []

            def fake_request(endpoint, route, query, data=None, headers=None):
                self.assertEqual(endpoint, config["endpoint"])
                if route == "/api/upload":
                    self.assertEqual(headers["x-content-sha256"], api["sha"](data))
                    self.assertEqual(headers["x-upload-password"], "fixture")
                    self.assertNotIn("Origin", headers)
                    key = f"library/{query['folder']}/{query['name']}"
                    store[key] = data
                    posts.append(key)
                    return api["json"].dumps({"key": key}).encode()
                self.assertEqual(route, "/download")
                return store[query["key"]]

            def cli(*args):
                with patch.object(sys, "argv", ["backup.py", *args]):
                    api["main"]()

            with (
                patch.dict(functions, {"request": fake_request}),
                patch.dict(os.environ, {"OBJECT_LIBRARY_UPLOAD_PASSWORD": "fixture"}),
            ):
                cli("plan")
                with self.assertRaises(SystemExit):
                    cli("upload")
                cli("upload", "--public-approved", "--limit", "1")
                with self.assertRaisesRegex(ValueError, "Sync incomplete"):
                    cli("record", "--output", str(root / "partial"))
                self.assertFalse(manifest.exists())
                (root / "b.bin").write_bytes(b"changed after plan")
                with self.assertRaisesRegex(ValueError, "source bytes changed"):
                    cli("upload", "--public-approved")
                (root / "b.bin").write_bytes(b"b")
                cli("upload", "--public-approved")
                self.assertEqual(len(posts), 2)
                cli("record", "--output", str(root / "review"))
                before = manifest.read_bytes()
                cli("plan")
                with patch.dict(os.environ, {"OBJECT_LIBRARY_UPLOAD_PASSWORD": ""}):
                    cli("upload", "--public-approved")
                    self.assertEqual(len(posts), 2)
                    cli("restore", "--output", str(root / "restored"))
                self.assertEqual((root / "restored/a.bin").read_bytes(), b"a")
                self.assertFalse((root / "restored/private.bin").exists())
                with self.assertRaisesRegex(ValueError, "new restore destination"):
                    cli("restore", "--output", str(root / "restored"))
                store[posts[0]] = b"wrong bytes"
                with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                    cli("record", "--output", str(root / "bad"))
                self.assertEqual(manifest.read_bytes(), before)
                self.assertFalse((root / "bad").exists())
            (root / "alias.bin").symlink_to(root / "a.bin")
            with self.assertRaisesRegex(ValueError, "symlink"):
                api["plan"]({**config, "files": ["alias.bin"]}, root, None)
            with self.assertRaisesRegex(ValueError, "Invalid inventory path"):
                api["plan"]({**config, "files": ["../a.bin"]}, root, None)
