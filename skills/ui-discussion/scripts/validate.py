#!/usr/bin/env python3
"""Diagnose UI review structure and readiness without changing the review."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from html.parser import HTMLParser
from pathlib import Path
from typing import Literal, TypedDict

Stage = Literal["structure", "ready"]


class Diagnostic(TypedDict):
    code: str
    severity: Literal["error", "warning"]
    message: str
    subject: dict[str, str]
    evidence: dict[str, object]
    supportedFixes: list[str]


class ReadinessResult(TypedDict):
    schemaVersion: int
    stage: Stage
    status: Literal["blocked", "structurally-valid", "ready", "ready-with-gaps"]
    ok: bool
    input: str
    sha256: str | None
    diagnostics: list[Diagnostic]
    limits: list[str]


class ReviewData(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.active = False
        self.count = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs) -> None:
        if tag == "script" and dict(attrs).get("id") == "review-data":
            self.active = True
            self.count += 1

    def handle_endtag(self, tag) -> None:
        if tag == "script":
            self.active = False

    def handle_data(self, data) -> None:
        if self.active:
            self.parts.append(data)


def pointer(path: str, key: str | int) -> str:
    return path + "/" + str(key).replace("~", "~0").replace("/", "~1")


class Checks:
    def __init__(self, page: Path) -> None:
        self.page = page
        self.diagnostics: list[Diagnostic] = []

    def issue(
        self,
        code: str,
        path: str,
        message: str,
        fix: str,
        *,
        identity: str = "",
        evidence: dict[str, object] | None = None,
        warning: bool = False,
    ) -> None:
        self.diagnostics.append(
            {
                "code": code,
                "severity": "warning" if warning else "error",
                "message": message,
                "subject": {"path": path, **({"id": identity} if identity else {})},
                "evidence": evidence or {},
                "supportedFixes": [fix],
            }
        )

    def records(self, value: object, path: str) -> list[tuple[str, dict]]:
        if not isinstance(value, list):
            self.issue("structure/list", path, "Expected a list.", "Provide an array at this path.")
            return []
        result = []
        for i, item in enumerate(value):
            at = pointer(path, i)
            if not isinstance(item, dict):
                self.issue("structure/object", at, "Expected a record.", "Provide an object at this path.")
            else:
                result.append((at, item))
        return result

    def indexed(self, model: dict, key: str) -> tuple[list[tuple[str, dict]], dict[str, dict]]:
        records = self.records(model.get(key), "/" + key)
        by_id: dict[str, dict] = {}
        for at, item in records:
            identity = item.get("id")
            if not isinstance(identity, str) or not identity.strip():
                self.issue(
                    "identity/missing",
                    pointer(at, "id"),
                    "Missing stable ID.",
                    "Assign a non-empty stable string ID; retain existing IDs across revisions.",
                )
            elif identity in by_id:
                self.issue(
                    "identity/duplicate",
                    pointer(at, "id"),
                    "Duplicate identifier.",
                    "Give distinct records distinct IDs and update their references.",
                    identity=identity,
                )
            else:
                by_id[identity] = item
        return records, by_id

    def names(self, value: object, path: str, *, nonempty: bool = False) -> list[str]:
        if not isinstance(value, list) or any(not isinstance(v, str) or not v.strip() for v in value):
            self.issue(
                "structure/string-list",
                path,
                "Expected a list of non-empty strings.",
                "Provide string values; use an empty list only when none apply.",
            )
            return []
        if nonempty and not value:
            self.issue(
                "reference/empty",
                path,
                "No participating components.",
                "Reference the components actually visible in this state.",
            )
        return value

    def text(self, record: dict, keys: tuple[str, ...], path: str) -> None:
        for key in keys:
            value = record.get(key)
            if not isinstance(value, str) or not value.strip():
                self.issue(
                    "readiness/required-text",
                    pointer(path, key),
                    f"Missing {key}.",
                    f"Record {key} from inspected evidence; explain when it is inapplicable.",
                    identity=record.get("id") if isinstance(record.get("id"), str) else "",
                )

    def targets(self, record: dict, at: str, screens: dict, visible: dict[str, set[str]]) -> None:
        screen = record.get("screen")
        if not isinstance(screen, str) or screen not in screens:
            self.issue(
                "reference/screen", pointer(at, "screen"), "Unknown screen.", "Use an existing captured screen ID."
            )
            screen = ""
        targets = self.names(record.get("elements"), pointer(at, "elements"), nonempty=True)
        absent = sorted(set(targets) - visible.get(screen, set()))
        if absent:
            self.issue(
                "reference/visible-elements",
                pointer(at, "elements"),
                "Components absent from the referenced screen.",
                "Link the actual screen and its marked component IDs.",
                evidence={"absent": absent},
            )

    def model(self, model: dict, stage: Stage) -> None:
        element_records, elements = self.indexed(model, "elements")
        screen_records, screens = self.indexed(model, "screens")
        journey_records, journeys = self.indexed(model, "journeys")
        finding_records, _ = self.indexed(model, "findings")
        if not screens or not elements or not any(s.get("kind") == "current" for s in screens.values()):
            self.issue(
                "coverage/empty",
                "",
                "Incomplete scaffold: map current screens and components first.",
                "Add an inspected current screen, component records and matching markers.",
            )
        for at, element in element_records:
            parent = element.get("parent")
            seen = {element.get("id")} if isinstance(element.get("id"), str) else set()
            while parent not in (None, ""):
                if not isinstance(parent, str) or parent not in elements or parent in seen:
                    self.issue(
                        "reference/parent",
                        pointer(at, "parent"),
                        "Invalid parent chain.",
                        "Use an existing parent ID without a cycle, or null for a root.",
                    )
                    break
                seen.add(parent)
                parent = elements[parent].get("parent")
        mapped: set[str] = set()
        visible: dict[str, set[str]] = {}
        for at, screen in screen_records:
            if screen.get("kind") not in ("current", "proposed"):
                self.issue(
                    "structure/screen-kind",
                    pointer(at, "kind"),
                    "Unknown screen kind.",
                    "Use current or proposed; keep the baseline separate from proposals.",
                )
            capture = screen.get("image")
            if (
                not isinstance(capture, str)
                or not capture
                or not (capture.startswith("data:image/") or (self.page.parent / capture).is_file())
            ):
                self.issue(
                    "capture/missing",
                    pointer(at, "image"),
                    "Missing capture.",
                    "Reference an existing capture relative to this page, or embed an image data URL.",
                )
            screen_elements: set[str] = set()
            for mark_at, mark in self.records(screen.get("marks"), pointer(at, "marks")):
                target = mark.get("element")
                if not isinstance(target, str) or target not in elements:
                    self.issue(
                        "reference/marker",
                        pointer(mark_at, "element"),
                        "Unknown mapped element.",
                        "Use an existing component ID or add its inspected inventory record.",
                    )
                else:
                    screen_elements.add(target)
                    mapped.add(target)
                values = [mark.get(k) for k in ("x", "y", "w", "h")]
                if any(type(v) not in (int, float) or not math.isfinite(v) for v in values):
                    self.issue(
                        "geometry/number",
                        mark_at,
                        "Marker bounds must be finite numbers.",
                        "Supply numeric x, y, w and h as percentages of the capture.",
                    )
                    continue
                x, y, width, height = values
                if min(x, y) < 0 or min(width, height) <= 0 or x + width > 100.01 or y + height > 100.01:
                    self.issue(
                        "geometry/outside-capture",
                        mark_at,
                        "Marker outside capture.",
                        "Match the captured component: x/y >= 0, w/h > 0, x+w and y+h <= 100.",
                        evidence={"bounds": dict(zip(("x", "y", "w", "h"), values, strict=True))},
                    )
                for key in ("labelX", "labelY"):
                    if key in mark and (
                        type(mark[key]) not in (int, float) or not math.isfinite(mark[key]) or not 0 <= mark[key] <= 100
                    ):
                        self.issue(
                            "geometry/label",
                            pointer(mark_at, key),
                            "Label offset outside marker.",
                            "Use a finite percentage from 0 to 100 within the marker.",
                        )
            if isinstance(screen.get("id"), str):
                visible[screen["id"]] = screen_elements
        for identity in sorted(set(elements) - mapped):
            self.issue(
                "coverage/unmapped-element",
                "/elements",
                "Component has no mapped state.",
                "Add its marker to an inspected screen; do not invent a capture.",
                identity=identity,
            )
        steps_by_journey: dict[str, list] = {}
        for at, journey in journey_records:
            steps = self.records(journey.get("steps"), pointer(at, "steps"))
            if isinstance(journey.get("id"), str):
                steps_by_journey[journey["id"]] = journey.get("steps") if isinstance(journey.get("steps"), list) else []
            if not steps:
                self.issue(
                    "journey/empty",
                    pointer(at, "steps"),
                    "Journey has no steps.",
                    "Record the observed path from its start to success, including recovery.",
                )
            for step_at, step in steps:
                self.targets(step, step_at, screens, visible)
                if stage == "ready":
                    self.text(step, ("name", "before", "cue", "action", "after", "deferred", "recovery"), step_at)
        for at, finding in finding_records:
            self.targets(finding, at, screens, visible)
            if "journey" in finding:
                target = finding["journey"]
                index = finding.get("step")
                if (
                    not isinstance(target, str)
                    or target not in journeys
                    or type(index) is not int
                    or not 0 <= index < len(steps_by_journey.get(target, []))
                ):
                    self.issue(
                        "reference/finding-step",
                        at,
                        "Unresolved finding step.",
                        "Use an existing journey ID and zero-based step index, or omit both fields.",
                    )
                else:
                    step = steps_by_journey[target][index]
                    if isinstance(step, dict) and finding.get("screen") != step.get("screen"):
                        self.issue(
                            "reference/finding-screen",
                            at,
                            "Finding and journey step name different screens.",
                            "Target the screen actually shown by this journey step.",
                        )
            elif "step" in finding:
                self.issue(
                    "reference/finding-step", at, "Finding step has no journey.", "Provide its journey ID or omit step."
                )
        for at, gap in self.records(model.get("coverageGaps", []), "/coverageGaps"):
            self.text(gap, ("scope", "reason"), at)
            if all(isinstance(gap.get(k), str) and gap[k].strip() for k in ("scope", "reason")):
                self.issue(
                    "coverage/declared-gap",
                    at,
                    "Declared coverage gap.",
                    "Inspect the named area when access is available; retain the limitation until then.",
                    evidence={"scope": gap["scope"], "reason": gap["reason"]},
                    warning=True,
                )
        if stage != "ready":
            return
        self.text(model, ("revision", "scope", "baseline"), "")
        if isinstance(model.get("scope"), str) and model["scope"].startswith("Incomplete scaffold."):
            self.issue(
                "readiness/scaffold",
                "/scope",
                "Scope is still scaffold guidance.",
                "Describe the actual included surfaces, states and exclusions.",
            )
        if isinstance(model.get("baseline"), str) and model["baseline"].startswith("Record source revision/build,"):
            self.issue(
                "readiness/scaffold",
                "/baseline",
                "Baseline is still scaffold guidance.",
                "Record source/build revision, capture origin/time, viewport and fixture/live status.",
            )
        if not journeys:
            self.issue(
                "readiness/journeys",
                "/journeys",
                "No primary journey recorded.",
                "Map a primary goal through the current UI; use structure checks during spatial-only authoring.",
            )
        for at, element in element_records:
            self.text(element, ("name", "location", "purpose", "reveal", "source", "instances"), at)
            for key in ("facts", "actions"):
                self.names(element.get(key), pointer(at, key))
        for at, screen in screen_records:
            self.text(screen, ("name", "coverage"), at)
        for at, journey in journey_records:
            self.text(journey, ("name", "goal", "start", "success"), at)
        for at, finding in finding_records:
            self.text(finding, ("kind", "evidence", "effect", "proposal", "status"), at)


def _review(path: Path, stage: Stage) -> tuple[dict | None, ReadinessResult]:
    if stage not in ("structure", "ready"):
        raise ValueError("Unknown review stage")
    checks = Checks(path)
    model = None
    digest = None
    try:
        raw = path.read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        parser = ReviewData()
        parser.feed(raw.decode("utf-8"))
        if parser.count != 1:
            checks.issue(
                "input/review-data",
                "",
                "Expected exactly one review-data script.",
                "Keep one inline JSON script with id review-data.",
                evidence={"count": parser.count},
            )
        else:
            value = json.loads("".join(parser.parts))
            if not isinstance(value, dict):
                checks.issue(
                    "input/model",
                    "",
                    "Review model must be an object.",
                    "Use the review-data object described in the review-surface contract.",
                )
            else:
                model = value
                checks.model(model, stage)
    except (OSError, UnicodeError, ValueError) as exc:
        checks.issue(
            "input/read",
            "",
            "Cannot read the review model.",
            "Provide a readable UTF-8 HTML file containing valid review-data JSON.",
            evidence={"reason": str(exc)},
        )
    blocked = any(d["severity"] == "error" for d in checks.diagnostics)
    status = (
        "blocked"
        if blocked
        else "structurally-valid"
        if stage == "structure"
        else "ready-with-gaps"
        if checks.diagnostics
        else "ready"
    )
    return model, {
        "schemaVersion": 1,
        "stage": stage,
        "status": status,
        "ok": not blocked,
        "input": str(path.resolve()),
        "sha256": digest,
        "diagnostics": checks.diagnostics,
        "limits": [
            "Checks cover recorded structure and content, not visual completeness, source accuracy or usability.",
            "The hash identifies this HTML only; capture files and the live app need separate inspection.",
        ],
    }


def diagnose(path: Path, stage: Stage = "ready") -> ReadinessResult:
    """Return stable diagnostics for these exact HTML bytes; never write or repair."""
    return _review(path, stage)[1]


def validate(path: Path) -> dict:
    """Return a structurally valid review model or raise its diagnostic messages."""
    model, result = _review(path, "structure")
    if not result["ok"]:
        raise ValueError("; ".join(d["message"] for d in result["diagnostics"] if d["severity"] == "error"))
    assert model is not None
    return model


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("page", type=Path)
    parser.add_argument("--stage", choices=("structure", "ready"), default="structure")
    parser.add_argument("--json", action="store_true", help="Emit one machine-readable result, including failures")
    args = parser.parse_args()
    result = diagnose(args.page, args.stage)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, allow_nan=False))
    else:
        print(f"UI review: {result['status']} ({result['stage']})")
        for item in result["diagnostics"]:
            print(f"[{item['code']}] {item['subject']['path'] or '/'}: {item['message']}")
            for fix in item["supportedFixes"]:
                print(f"  Fix: {fix}")
        print(result["limits"][0])
    raise SystemExit(0 if result["ok"] else 1)


if __name__ == "__main__":
    main()
