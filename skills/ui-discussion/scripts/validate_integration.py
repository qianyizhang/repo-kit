#!/usr/bin/env python3
"""Check the recorded MCP integration review without executing it."""

from __future__ import annotations

import argparse
import json
from html.parser import HTMLParser
from pathlib import Path


class Data(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.active = False
        self.count = 0
        self.text = ""

    def handle_starttag(self, tag, attrs) -> None:
        if tag == "script" and dict(attrs).get("id") == "mcp-review-data":
            self.active = True
            self.count += 1

    def handle_endtag(self, tag) -> None:
        if tag == "script":
            self.active = False

    def handle_data(self, data) -> None:
        if self.active:
            self.text += data


def validate(path: Path) -> list[str]:
    parser = Data()
    parser.feed(path.read_text())
    if parser.count != 1:
        return ["Expected one mcp-review-data block"]
    model = json.loads(parser.text)
    if not isinstance(model, dict):
        return ["Review data must be an object"]
    errors = []

    def text(record, field, at):
        if not isinstance(record.get(field), str) or not record[field].strip():
            errors.append(f"{at}/{field}: record inspected evidence")

    for field in ("baseline", "logPolicy", "standalone"):
        text(model, field, "")
    for field in ("registeredTools", "tools", "fixtures", "coverageGaps"):
        if not isinstance(model.get(field), list):
            return [*errors, f"/{field}: expected an array"]
    registered = model["registeredTools"]
    if not registered or any(not isinstance(name, str) or not name for name in registered):
        errors.append("/registeredTools: capture the actual non-empty tools/list inventory")
    elif len(set(registered)) != len(registered):
        errors.append("/registeredTools: duplicate names")
    documented = []
    for index, tool in enumerate(model["tools"]):
        at = f"/tools/{index}"
        if not isinstance(tool, dict):
            errors.append(f"{at}: expected an object")
            continue
        for field in ("name", "purpose", "operation", "authorization", "effect", "scope", "source"):
            text(tool, field, at)
        if isinstance(tool.get("name"), str):
            documented.append(tool["name"])
        visibility = tool.get("visibility")
        if not isinstance(visibility, list) or not visibility or any(v not in ("app", "model") for v in visibility):
            errors.append(f"{at}/visibility: specify app and/or model")
        for field in ("inputSchema", "outputSchema", "example"):
            if not isinstance(tool.get(field), dict):
                errors.append(f"{at}/{field}: expected an object")
    if sorted(documented) != sorted(name for name in registered if isinstance(name, str)):
        errors.append("/tools: documented names must match registrations exactly")
    kinds = set()
    ids = set()
    for index, fixture in enumerate(model["fixtures"]):
        at = f"/fixtures/{index}"
        if not isinstance(fixture, dict):
            errors.append(f"{at}: expected an object")
            continue
        for field in ("id", "name", "source"):
            text(fixture, field, at)
        identity = fixture.get("id")
        if isinstance(identity, str):
            if identity in ids:
                errors.append(f"{at}/id: duplicate fixture")
            ids.add(identity)
        kind = fixture.get("kind")
        if kind in ("plain", "selection", "failure"):
            kinds.add(kind)
        else:
            errors.append(f"{at}/kind: use plain, selection or failure")
        if fixture.get("mode") not in ("fixture", "observed"):
            errors.append(f"{at}/mode: label fixture or observed")
        for field in ("request", "result"):
            if field not in fixture:
                errors.append(f"{at}/{field}: record the payload or explicit unknown")
        reads = fixture.get("reads")
        if not isinstance(reads, list):
            errors.append(f"{at}/reads: expected an array, including empty for no reads")
        else:
            for read in reads:
                if not isinstance(read, dict) or read.get("tool") not in documented or not read.get("scope"):
                    errors.append(f"{at}/reads: reference a documented tool and scope")
        sequence = fixture.get("sequence")
        if not isinstance(sequence, list) or not sequence:
            errors.append(f"{at}/sequence: record ordered boundaries")
        else:
            for offset, step in enumerate(sequence):
                if not isinstance(step, dict):
                    errors.append(f"{at}/sequence/{offset}: expected an object")
                    continue
                for field in ("from", "to", "action", "evidence"):
                    text(step, field, f"{at}/sequence/{offset}")
    if kinds != {"plain", "selection", "failure"}:
        errors.append("/fixtures: include plain, selection and failure examples")
    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("page", type=Path)
    args = parser.parse_args()
    try:
        errors = validate(args.page)
    except (OSError, ValueError) as exc:
        parser.exit(1, f"mcp-review: {exc}\n")
    if errors:
        parser.exit(1, "\n".join(errors) + "\n")
    print("Recorded MCP integration contract complete; source truth and live behavior still require review.")


if __name__ == "__main__":
    main()
