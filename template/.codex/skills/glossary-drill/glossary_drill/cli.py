"""CLI for glossary-drill: onboard / quiz / lint / record / status / html."""

from __future__ import annotations

import argparse
import json
import random
import sys
from dataclasses import dataclass
from pathlib import Path

from . import __version__
from .binding import filter_excluded, load_binding, resolve_glossary_paths
from .deck import default_deck, due_order, full_deck, onboard_order
from .lint import format_findings, lint_text
from .mcq import build_mcq, format_mcq
from .models import Binding, Card, DrillState, Locale, McqItem
from .parse import parse_glossary_paths
from .state import (
    bump_session,
    bump_weak,
    coverage,
    default_profile,
    load_state,
    record_answer,
    repo_id_from_root,
    save_state,
)


@dataclass
class Context:
    repo_root: Path
    cards: list[Card]
    binding: Binding
    locale: Locale
    state: DrillState
    state_dir: Path

    def deck(self, all_terms: bool) -> list[Card]:
        return full_deck(self.cards) if all_terms else default_deck(self.cards, self.binding)

    def save(self) -> Path:
        return save_state(self.state_dir, self.state)


def _load_context(args: argparse.Namespace) -> Context:
    repo_root = args.repo_root.resolve()
    binding = load_binding(repo_root, binding_path=args.binding)
    if args.glossary_dir is not None:
        paths = [args.glossary_dir]
    else:
        paths = resolve_glossary_paths(repo_root, binding)
    cards = filter_excluded(parse_glossary_paths(paths), binding)

    locale: Locale = args.locale if args.locale in {"en", "zh", "bilingual"} else binding.locale
    state_dir = args.state_dir or (repo_root / binding.state_dir)
    if not state_dir.is_absolute():
        state_dir = repo_root / state_dir
    profile = args.profile or default_profile()
    state = load_state(state_dir, profile=profile, repo_id=repo_id_from_root(repo_root))
    return Context(repo_root, cards, binding, locale, state, state_dir)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="glossary-drill",
        description="Portable ubiquitous-language onboard / MCQ quiz / lint (offline core).",
    )
    parser.add_argument("--version", action="version", version=f"glossary-drill {__version__}")
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--glossary-dir", type=Path, default=None, help="Override glossary root (file or dir)")
    parser.add_argument("--binding", type=Path, default=None, help="Optional drill-binding.yaml")
    parser.add_argument("--state-dir", type=Path, default=None)
    parser.add_argument("--profile", default=None, help="Learner profile (defaults to $USER)")
    parser.add_argument("--locale", choices=["en", "zh", "bilingual"], default=None)
    parser.add_argument("--all", action="store_true", help="Use the full glossary instead of the default pool")

    sub = parser.add_subparsers(dest="command", required=True)

    for name, help_text in (("onboard", "Guided ordered path (MCQ items)"), ("quiz", "Spaced-repetition MCQ round")):
        p = sub.add_parser(name, help=help_text)
        p.add_argument("--count", type=int, default=5)
        p.add_argument("--seed", type=int, default=None, help="Reproducible RNG (default: fresh each round)")
        p.add_argument("--json", action="store_true", help="Emit machine-readable items")

    lint_p = sub.add_parser("lint", help="Lint prose against glossary avoid/confusable maps")
    lint_p.add_argument("--text", default=None)
    lint_p.add_argument("--file", type=Path, default=None)
    lint_p.add_argument("--record", action="store_true", help="Nudge flagged terms up the drill queue")

    rec = sub.add_parser("record", help="Record one answer for a term (agent session)")
    rec.add_argument("--term", required=True)
    rec.add_argument("--correct", action="store_true")
    rec.add_argument("--wrong", action="store_true")
    rec.add_argument("--confused-with", default=None, help="Term id of the wrong option picked")

    status = sub.add_parser("status", help="Coverage / mastery snapshot for this profile")
    status.add_argument("--json", action="store_true")

    html_p = sub.add_parser("html", help="Write the self-contained offline Mastery Ladder game")
    html_p.add_argument("--out", type=Path, default=None, help="Default: <state-dir>/ladder.html")
    html_p.add_argument("--count", type=int, default=15)
    html_p.add_argument("--title", default="Glossary Mastery Ladder")
    html_p.add_argument("--mode", choices=["quiz", "onboard"], default="quiz")
    html_p.add_argument("--open", action="store_true", help="Open the file in the default browser")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    ctx = _load_context(args)
    handlers = {
        "onboard": _cmd_drill,
        "quiz": _cmd_drill,
        "lint": _cmd_lint,
        "record": _cmd_record,
        "status": _cmd_status,
        "html": _cmd_html,
    }
    return handlers[args.command](ctx, args)


def _ordered_for(ctx: Context, mode: str, all_terms: bool) -> list[Card]:
    deck = ctx.deck(all_terms)
    if mode == "onboard":
        return onboard_order(deck, ctx.binding)
    return due_order(deck, ctx.state)


def _cmd_drill(ctx: Context, args: argparse.Namespace) -> int:
    mode = args.command
    ordered = _ordered_for(ctx, mode, args.all)
    if not ordered:
        print("No cards in deck. Add docs/glossary/*.md tables or pass --glossary-dir.", file=sys.stderr)
        return 1
    if mode == "quiz":
        bump_session(ctx.state)  # advances the spaced-repetition clock
        ctx.save()

    rng = random.Random(args.seed) if args.seed is not None else random.Random()
    deck = ctx.deck(args.all)
    items = [
        build_mcq(card, deck, state=ctx.state, locale=ctx.locale, rng=rng) for card in ordered[: max(1, args.count)]
    ]

    if args.json:
        print(json.dumps([_item_to_dict(i) for i in items], ensure_ascii=False, indent=2))
        return 0

    title = "ONBOARD" if mode == "onboard" else "QUIZ"
    print(f"=== {title} ({len(items)} item(s), profile={ctx.state.profile}, locale={ctx.locale}) ===\n")
    for n, item in enumerate(items, 1):
        print(f"--- item {n} ({item.kind}) ---")
        print(format_mcq(item))
        print()
    return 0


def _cmd_record(ctx: Context, args: argparse.Namespace) -> int:
    if args.correct == args.wrong:
        print("Specify exactly one of --correct or --wrong", file=sys.stderr)
        return 1
    record_answer(
        ctx.state,
        args.term,
        correct=bool(args.correct),
        confused_with=args.confused_with,
    )
    path = ctx.save()
    ts = ctx.state.term_state(args.term)
    print(f"recorded term={args.term} correct={bool(args.correct)} box={ts.box} state={path}")
    return 0


def _cmd_lint(ctx: Context, args: argparse.Namespace) -> int:
    if args.file:
        text = args.file.read_text(encoding="utf-8")
    elif args.text is not None:
        text = args.text
    else:
        text = sys.stdin.read()
    findings = lint_text(text, ctx.cards)
    print(format_findings(findings))
    if args.record and findings:
        nudged = {f.suggest_term for f in findings if f.suggest_term}
        for term in nudged:
            bump_weak(ctx.state, term)
        ctx.save()
        if nudged:
            print(f"\ndrill queue: nudged {', '.join(sorted(nudged))}")
    return 0 if not findings else 2


def _cmd_status(ctx: Context, args: argparse.Namespace) -> int:
    cov = coverage(ctx.state, ctx.deck(args.all))
    if args.json:
        print(json.dumps(cov, ensure_ascii=False, indent=2))
        return 0
    boxes = " ".join(f"b{i}={n}" for i, n in enumerate(cov["boxes"]))
    print(f"=== glossary-drill status · profile={cov['profile']} · session {cov['sessions']} ===")
    print(f"coverage : {cov['seen']}/{cov['total']} seen · {cov['mastered']} mastered · {len(cov['unseen'])} unseen")
    print(f"boxes    : {boxes}")
    if cov["weak"]:
        print(f"weak     : {', '.join(cov['weak'])}")
    if cov["unseen"]:
        preview = cov["unseen"][:12]
        tail = " …" if len(cov["unseen"]) > len(preview) else ""
        print(f"unseen   : {', '.join(preview)}{tail}")
    return 0


def _cmd_html(ctx: Context, args: argparse.Namespace) -> int:
    from .html_export import build_ladder_payload, write_html

    ordered = _ordered_for(ctx, args.mode, args.all)
    if not ordered:
        print("No cards in deck. Add docs/glossary/*.md tables or pass --glossary-dir.", file=sys.stderr)
        return 1

    board = ordered[: max(1, args.count)]
    payload = build_ladder_payload(board, state=ctx.state, locale=ctx.locale)

    out = args.out or (ctx.state_dir / "ladder.html")
    if not out.is_absolute():
        out = ctx.repo_root / out
    path = write_html(
        out,
        payload,
        title=args.title,
        subtitle=f"{args.mode} · {ctx.locale} · SSOT docs/glossary",
    )
    print(path)
    if args.open:
        import webbrowser

        webbrowser.open(path.resolve().as_uri())
    return 0


def _item_to_dict(item: McqItem) -> dict:
    return {
        "kind": item.kind,
        "term": item.term,
        "stem": item.stem,
        "options": list(item.options),
        "option_terms": list(item.option_terms),
        "option_glosses": list(item.option_glosses),
        "correct_index": item.correct_index,
        "correct_term": item.correct_term,
        "note": item.note,
        "locale": item.locale,
    }


if __name__ == "__main__":
    raise SystemExit(main())
