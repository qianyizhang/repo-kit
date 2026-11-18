"""Generate a standalone, explicit-inventory Object Library client."""

import argparse
import json
import re
import shutil
from pathlib import Path

STARTER = Path(__file__).resolve().parents[1] / "assets" / "starter"
ENDPOINT = "https://r2-object-library.landy123007.chatgpt.site"


def scaffold(target: Path, namespace: str) -> None:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*(?:/[a-z0-9][a-z0-9-]*)+", namespace):
        raise ValueError("Use a namespace like my-repo/assets")
    if target.exists() or target.is_symlink() or not target.parent.is_dir():
        raise ValueError("Use a new target with an existing parent")
    config = {"endpoint": ENDPOINT, "namespace": namespace, "files": []}
    target.mkdir()
    try:
        for name in ("backup.py", "README.md", ".gitignore"):
            shutil.copyfile(STARTER / name, target / name)
        (target / "inventory.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    except OSError:
        shutil.rmtree(target)
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--namespace", required=True)
    args = parser.parse_args()
    try:
        scaffold(args.target, args.namespace)
    except (OSError, ValueError) as exc:
        parser.exit(1, f"r2-object-backup: {exc}\n")


if __name__ == "__main__":
    main()
