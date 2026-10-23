#!/usr/bin/env python3
"""Check review-map references and geometry; visual completeness needs human review."""

from __future__ import annotations

import argparse
import json
import math
from html.parser import HTMLParser
from pathlib import Path


class ReviewData(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.active = False
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs) -> None:
        self.active = tag == "script" and dict(attrs).get("id") == "review-data"

    def handle_endtag(self, tag) -> None:
        if tag == "script":
            self.active = False

    def handle_data(self, data) -> None:
        if self.active:
            self.parts.append(data)


def validate(path: Path) -> dict:
    parser = ReviewData()
    parser.feed(path.read_text())
    model = json.loads("".join(parser.parts))

    def indexed(key: str) -> dict:
        items = model[key]
        ids = [item["id"] for item in items]
        if len(set(ids)) != len(ids) or any(not value for value in ids):
            raise ValueError(f"Duplicate or empty {key} IDs")
        return dict(zip(ids, items, strict=True))

    elements, screens, journeys = (indexed(key) for key in ("elements", "screens", "journeys"))
    if not screens or not elements or not any(s["kind"] == "current" for s in screens.values()):
        raise ValueError("Incomplete scaffold: map current screens and components first")
    for element in elements.values():
        seen = {element["id"]}
        parent = element.get("parent")
        while parent:
            if parent not in elements or parent in seen:
                raise ValueError(f"Invalid parent chain for {element['id']}")
            seen.add(parent)
            parent = elements[parent].get("parent")
    mapped: set[str] = set()
    for screen in screens.values():
        if screen["kind"] not in {"current", "proposed"}:
            raise ValueError(f"Unknown screen kind: {screen['id']}")
        image = screen.get("image", "")
        if not image or (not image.startswith("data:image/") and not (path.parent / image).is_file()):
            raise ValueError(f"Missing capture for {screen['id']}")
        for mark in screen["marks"]:
            if mark["element"] not in elements:
                raise ValueError(f"Unknown mapped element: {mark['element']}")
            values = [mark[key] for key in ("x", "y", "w", "h")]
            if any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in values):
                raise ValueError("Marker bounds must be finite numbers")
            x, y, width, height = values
            if min(x, y) < 0 or min(width, height) <= 0 or x + width > 100.01 or y + height > 100.01:
                raise ValueError(f"Marker outside capture: {mark['element']}")
            mapped.add(mark["element"])
    if set(elements) - mapped:
        raise ValueError(f"Components without a mapped state: {sorted(set(elements) - mapped)}")
    for journey in journeys.values():
        if not journey["steps"]:
            raise ValueError(f"Journey has no steps: {journey['id']}")
        for step in journey["steps"]:
            if step["screen"] not in screens:
                raise ValueError(f"Unknown journey screen: {step['screen']}")
            visible = {mark["element"] for mark in screens[step["screen"]]["marks"]}
            if not step["elements"] or not set(step["elements"]) <= visible:
                raise ValueError(f"Journey step references components absent from its screen: {step['name']}")
    for finding in model["findings"]:
        if finding["screen"] not in screens or not set(finding["elements"]) <= set(elements):
            raise ValueError(f"Unresolved finding target: {finding['id']}")
        if finding.get("journey"):
            target = journeys.get(finding["journey"])
            index = finding.get("step", 0)
            if not target or not isinstance(index, int) or not 0 <= index < len(target["steps"]):
                raise ValueError(f"Unresolved finding step: {finding['id']}")
    return model


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("page", type=Path)
    args = parser.parse_args()
    try:
        model = validate(args.page)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        parser.exit(1, f"ui-discussion: {exc}\n")
    print(f"References and geometry valid: {len(model['elements'])} components, {len(model['screens'])} states")
    print("Visual completeness and journey quality still require review.")


if __name__ == "__main__":
    main()
