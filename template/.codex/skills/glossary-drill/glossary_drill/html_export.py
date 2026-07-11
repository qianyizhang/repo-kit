"""Self-contained offline HTML quiz (no network, single file).

Presentation only — glossary markdown stays SSOT. The page reads its own
localStorage back (resume + weak-term memory) and can emit `glossary-drill
record …` lines so a browser session is no longer a dead end: results can flow
back into the authoritative CLI state.
"""

from __future__ import annotations

import html
import json
import random
from collections.abc import Sequence
from pathlib import Path

from . import __version__
from .mcq import build_mcq
from .models import Card, DrillState, Locale, McqItem


def items_to_payload(items: Sequence[McqItem]) -> list[dict]:
    """Serialize items verbatim — options are already randomized at build time."""
    return [
        {
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
        for item in items
    ]


def build_quiz_items(
    deck: Sequence[Card],
    *,
    state: DrillState,
    locale: Locale,
    count: int,
    seed: int | None = None,
) -> list[McqItem]:
    rng = random.Random(seed) if seed is not None else random.Random()
    return [build_mcq(card, deck, state=state, locale=locale, rng=rng) for card in list(deck)[: max(1, count)]]


def render_html(
    items: Sequence[McqItem] | Sequence[dict],
    *,
    title: str = "Glossary Drill",
    subtitle: str = "通用语言 · ubiquitous language",
) -> str:
    if items and isinstance(items[0], McqItem):
        payload = items_to_payload(items)  # type: ignore[arg-type]
    else:
        payload = list(items)  # type: ignore[arg-type]
    data_json = json.dumps(payload, ensure_ascii=False).replace("</", "<\\/")
    return _TEMPLATE.format(
        title=html.escape(title),
        subtitle=html.escape(subtitle),
        version=html.escape(__version__),
        count=len(payload),
        data_json=data_json,
    )


def write_html(
    path: Path,
    items: Sequence[McqItem] | Sequence[dict],
    *,
    title: str = "Glossary Drill",
    subtitle: str = "通用语言 · ubiquitous language",
) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_html(items, title=title, subtitle=subtitle), encoding="utf-8")
    return path


_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{title}</title>
<style>
  :root {{
    color-scheme: light dark;
    --bg: #f5f7fa; --surface: #ffffff; --surface-2: #eef1f6; --line: #dbe1ea;
    --ink: #1a2028; --muted: #5c6675; --accent: #2f6fb0; --accent-soft: rgba(47,111,176,0.10);
    --good: #1f9d63; --good-soft: rgba(31,157,99,0.12); --bad: #cf4658; --bad-soft: rgba(207,70,88,0.12);
    --btn-ink: #ffffff;
    --radius: 12px;
    --font: "Inter", "SF Pro Text", "PingFang SC", "Noto Sans SC", system-ui, sans-serif;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  }}
  @media (prefers-color-scheme: dark) {{
    :root {{
      --bg: #0c0f14; --surface: #141a22; --surface-2: #1a222d; --line: #2a3340;
      --ink: #e7ecf3; --muted: #8b95a8; --accent: #5b9fd4; --accent-soft: rgba(91,159,212,0.12);
      --good: #3dba7a; --good-soft: rgba(61,186,122,0.12); --bad: #e06b7a; --bad-soft: rgba(224,107,122,0.12);
      --btn-ink: #0a0e14;
    }}
  }}
  :root[data-theme="light"] {{
    --bg: #f5f7fa; --surface: #ffffff; --surface-2: #eef1f6; --line: #dbe1ea;
    --ink: #1a2028; --muted: #5c6675; --accent: #2f6fb0; --accent-soft: rgba(47,111,176,0.10);
    --good: #1f9d63; --good-soft: rgba(31,157,99,0.12); --bad: #cf4658; --bad-soft: rgba(207,70,88,0.12);
    --btn-ink: #ffffff;
  }}
  :root[data-theme="dark"] {{
    --bg: #0c0f14; --surface: #141a22; --surface-2: #1a222d; --line: #2a3340;
    --ink: #e7ecf3; --muted: #8b95a8; --accent: #5b9fd4; --accent-soft: rgba(91,159,212,0.12);
    --good: #3dba7a; --good-soft: rgba(61,186,122,0.12); --bad: #e06b7a; --bad-soft: rgba(224,107,122,0.12);
    --btn-ink: #0a0e14;
  }}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; min-height: 100%; font-family: var(--font); color: var(--ink);
    background: var(--bg); -webkit-font-smoothing: antialiased; }}
  body {{ display: flex; justify-content: center; padding: 32px 16px 56px; }}
  .shell {{ width: min(640px, 100%); }}
  header {{ display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 20px; }}
  header h1 {{ margin: 0; font-size: 1.25rem; font-weight: 600; letter-spacing: -0.02em; }}
  header p {{ margin: 6px 0 0; color: var(--muted); font-size: 0.875rem; }}
  .theme-btn {{ flex: none; appearance: none; cursor: pointer; border: 1px solid var(--line);
    background: var(--surface); color: var(--muted); border-radius: 8px; width: 34px; height: 34px;
    font-size: 1rem; line-height: 1; }}
  .theme-btn:hover {{ border-color: var(--accent); color: var(--accent); }}
  .bar {{ display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }}
  .progress-wrap {{ flex: 1; height: 4px; border-radius: 99px; background: var(--line); overflow: hidden; }}
  .progress-bar {{ height: 100%; width: 0%; background: var(--accent); transition: width .3s ease; }}
  .count {{ font-family: var(--mono); font-size: 0.75rem; color: var(--muted); white-space: nowrap; }}
  .card {{ background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 24px; }}
  .meta {{ display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }}
  .tag {{ font-family: var(--mono); font-size: 0.7rem; color: var(--muted); border: 1px solid var(--line);
    border-radius: 6px; padding: 3px 8px; background: var(--surface-2); }}
  .tag.accent {{ color: var(--accent); border-color: color-mix(in srgb, var(--accent) 35%, transparent); }}
  .stem {{ font-size: 1rem; line-height: 1.55; white-space: pre-wrap; margin: 0 0 20px; }}
  .options {{ display: grid; gap: 8px; }}
  button.opt {{ appearance: none; width: 100%; text-align: left; border: 1px solid var(--line);
    background: var(--surface-2); color: var(--ink); border-radius: 10px; padding: 12px;
    display: grid; grid-template-columns: 28px 1fr; gap: 12px; align-items: start; cursor: pointer;
    font: inherit; line-height: 1.45; font-size: 0.92rem; transition: border-color .12s, background .12s; }}
  button.opt:hover:not(:disabled) {{ border-color: var(--accent); background: var(--accent-soft); }}
  button.opt:disabled {{ cursor: default; }}
  button.opt .letter {{ width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center;
    font-family: var(--mono); font-size: 0.8rem; font-weight: 600; color: var(--muted);
    background: var(--bg); border: 1px solid var(--line); }}
  button.opt .txt {{ white-space: pre-wrap; }}
  button.opt.correct {{ border-color: var(--good); background: var(--good-soft); }}
  button.opt.correct .letter {{ color: var(--good); border-color: var(--good); }}
  button.opt.wrong {{ border-color: var(--bad); background: var(--bad-soft); }}
  button.opt.wrong .letter {{ color: var(--bad); border-color: var(--bad); }}
  button.opt.dim {{ opacity: 0.45; }}
  .feedback {{ margin-top: 14px; min-height: 1.35em; font-size: 0.9rem; line-height: 1.5; color: var(--muted); }}
  .feedback .head {{ font-family: var(--mono); font-weight: 600; }}
  .feedback.good .head {{ color: var(--good); }}
  .feedback.bad .head {{ color: var(--bad); }}
  .feedback .why {{ display: block; margin-top: 4px; color: var(--muted); }}
  .feedback code {{ font-family: var(--mono); color: var(--accent); }}
  .actions {{ display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 18px; flex-wrap: wrap; }}
  .hint {{ color: var(--muted); font-size: 0.75rem; font-family: var(--mono); }}
  .btn {{ appearance: none; border: 0; cursor: pointer; border-radius: 8px; padding: 10px 16px;
    font: inherit; font-size: 0.9rem; font-weight: 600; background: var(--accent); color: var(--btn-ink);
    transition: opacity .12s; }}
  .btn:hover {{ opacity: 0.92; }}
  .btn:disabled {{ opacity: 0.35; cursor: not-allowed; }}
  .btn.ghost {{ background: transparent; color: var(--muted); border: 1px solid var(--line); font-weight: 500; }}
  .splash {{ text-align: center; padding: 12px 0 4px; }}
  .splash h2 {{ margin: 0 0 8px; font-size: 1.15rem; font-weight: 600; letter-spacing: -0.02em; }}
  .splash p {{ margin: 0 0 16px; color: var(--muted); font-size: 0.9rem; line-height: 1.5; }}
  .resume {{ border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2);
    padding: 12px 14px; margin: 0 0 18px; font-size: 0.82rem; color: var(--muted); text-align: left; }}
  .resume b {{ color: var(--ink); }}
  .resume code {{ font-family: var(--mono); color: var(--accent); }}
  .score-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 20px 0 12px; }}
  .stat {{ background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 12px; text-align: center; }}
  .stat .n {{ font-size: 1.4rem; font-weight: 600; letter-spacing: -0.02em; }}
  .stat .l {{ color: var(--muted); font-size: 0.7rem; margin-top: 4px; text-transform: uppercase; letter-spacing: .05em; }}
  .miss-list {{ margin: 12px 0 0; padding: 0; list-style: none; display: grid; gap: 6px; }}
  .miss-list li {{ border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px;
    background: var(--surface-2); font-size: 0.85rem; color: var(--muted); line-height: 1.5; }}
  .miss-list code {{ font-family: var(--mono); color: var(--accent); font-size: 0.82rem; }}
  details.sync {{ margin-top: 16px; font-size: 0.82rem; color: var(--muted); }}
  details.sync summary {{ cursor: pointer; }}
  details.sync textarea {{ width: 100%; margin-top: 8px; min-height: 96px; resize: vertical;
    font-family: var(--mono); font-size: 0.76rem; background: var(--surface-2); color: var(--ink);
    border: 1px solid var(--line); border-radius: 8px; padding: 10px; }}
  .hidden {{ display: none !important; }}
  @media (max-width: 520px) {{ .score-grid {{ grid-template-columns: 1fr; }} .card {{ padding: 18px; }} }}
</style>
</head>
<body>
  <div class="shell">
    <header>
      <div>
        <h1>{title}</h1>
        <p>{subtitle} · v{version} · {count} items</p>
      </div>
      <button class="theme-btn" id="themeBtn" type="button" title="Toggle theme" aria-label="Toggle theme">◐</button>
    </header>

    <div class="bar">
      <div class="progress-wrap"><div class="progress-bar" id="progress"></div></div>
      <div class="count" id="countLabel">0 / {count}</div>
    </div>

    <section class="card" id="startScreen">
      <div class="splash">
        <h2>Glossary drill</h2>
        <p>中英默认 · 选择题 · A–D 快捷键<br/>Bilingual MCQ · glossary markdown stays SSOT</p>
        <div class="resume hidden" id="resumeBox"></div>
        <button class="btn" id="startBtn" type="button">开始 / Start</button>
        <button class="btn ghost hidden" id="weakBtn" type="button">先练弱项 / Weak-first</button>
      </div>
    </section>

    <section class="card hidden" id="quizScreen">
      <div class="meta">
        <span class="tag" id="qIndex">1 / N</span>
        <span class="tag accent" id="qKind">kind</span>
        <span class="tag" id="scoreLive">0 ✓</span>
      </div>
      <div class="stem" id="stem"></div>
      <div class="options" id="options"></div>
      <div class="feedback" id="feedback"></div>
      <div class="actions">
        <span class="hint">A–D · Enter</span>
        <button class="btn" id="nextBtn" type="button" disabled>下一题 / Next</button>
      </div>
    </section>

    <section class="card hidden" id="doneScreen">
      <div class="splash">
        <h2 id="doneTitle">完成</h2>
        <p id="doneSub"></p>
      </div>
      <div class="score-grid">
        <div class="stat"><div class="n" id="statCorrect">0</div><div class="l">correct</div></div>
        <div class="stat"><div class="n" id="statWrong">0</div><div class="l">missed</div></div>
        <div class="stat"><div class="n" id="statPct">0%</div><div class="l">accuracy</div></div>
      </div>
      <ul class="miss-list" id="missList"></ul>
      <details class="sync" id="syncBox">
        <summary>Sync to CLI state · 同步进度</summary>
        <p>Paste these into your terminal to fold this round into <code>artifacts/glossary-drill</code>:</p>
        <textarea id="syncText" readonly></textarea>
        <button class="btn ghost" id="copySyncBtn" type="button" style="margin-top:8px;">Copy</button>
      </details>
      <div class="actions" style="justify-content:center;margin-top:18px;">
        <button class="btn ghost" id="retryMissedBtn" type="button">重做错题 / Retry missed</button>
        <button class="btn" id="restartBtn" type="button">再来一轮 / Again</button>
      </div>
    </section>
  </div>

  <script id="quiz-data" type="application/json">{data_json}</script>
  <script>
  (function () {{
    const STORE_KEY = 'glossary-drill:v3';
    const THEME_KEY = 'glossary-drill:theme';
    const ALL = JSON.parse(document.getElementById('quiz-data').textContent);
    let deck = ALL.slice();
    let i = 0, correct = 0, wrong = 0, answered = false, missed = [], answers = [];

    const $ = (id) => document.getElementById(id);
    const screens = ['startScreen', 'quizScreen', 'doneScreen'].map($);

    function loadStore() {{
      try {{ return JSON.parse(localStorage.getItem(STORE_KEY)) || {{stats: {{}}}}; }}
      catch (_) {{ return {{stats: {{}}}}; }}
    }}
    function saveStore(s) {{ try {{ localStorage.setItem(STORE_KEY, JSON.stringify(s)); }} catch (_) {{}} }}

    // ---- theme ----
    function applyTheme(t) {{
      if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
      else document.documentElement.removeAttribute('data-theme');
    }}
    let theme = null;
    try {{ theme = localStorage.getItem(THEME_KEY); }} catch (_) {{}}
    applyTheme(theme);
    $('themeBtn').addEventListener('click', () => {{
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        (!document.documentElement.getAttribute('data-theme') &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      theme = isDark ? 'light' : 'dark';
      applyTheme(theme);
      try {{ localStorage.setItem(THEME_KEY, theme); }} catch (_) {{}}
    }});

    function show(el) {{ screens.forEach(s => s.classList.add('hidden')); el.classList.remove('hidden'); }}
    function letter(n) {{ return String.fromCharCode(65 + n); }}

    // ---- resume / weak-term memory ----
    function weakTerms() {{
      const stats = loadStore().stats || {{}};
      const inDeck = new Set(ALL.map(q => q.term));
      return Object.keys(stats).filter(t => inDeck.has(t) &&
        ((stats[t].box || 0) <= 1 || (stats[t].fails || 0) > (stats[t].passes || 0)));
    }}
    function renderResume() {{
      const store = loadStore();
      const weak = weakTerms();
      if (store.last) {{
        const l = store.last;
        $('resumeBox').classList.remove('hidden');
        $('resumeBox').innerHTML = 'Last round · <b>' + l.pct + '%</b> (' + l.correct + '✓ / ' +
          l.wrong + '✗)' + (weak.length ? '<br/>Weak: <code>' + weak.slice(0, 8).join('</code> <code>') +
          '</code>' : '');
      }}
      $('weakBtn').classList.toggle('hidden', weak.length === 0);
    }}

    function renderQuestion() {{
      answered = false;
      $('nextBtn').disabled = true;
      $('feedback').textContent = '';
      $('feedback').className = 'feedback';
      const q = deck[i];
      $('qIndex').textContent = (i + 1) + ' / ' + deck.length;
      $('countLabel').textContent = (i + 1) + ' / ' + deck.length;
      $('qKind').textContent = q.kind;
      $('scoreLive').textContent = correct + ' ✓';
      $('stem').textContent = q.stem;
      $('progress').style.width = ((i / Math.max(deck.length, 1)) * 100) + '%';
      const box = $('options');
      box.innerHTML = '';
      q.options.forEach((opt, idx) => {{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'opt';
        btn.innerHTML = '<span class="letter">' + letter(idx) + '</span><span class="txt"></span>';
        btn.querySelector('.txt').textContent = opt;
        btn.addEventListener('click', () => choose(idx));
        box.appendChild(btn);
      }});
    }}

    function choose(idx) {{
      if (answered) return;
      answered = true;
      const q = deck[i];
      const ok = idx === q.correct_index;
      [...$('options').querySelectorAll('button.opt')].forEach((b, bi) => {{
        b.disabled = true;
        if (bi === q.correct_index) b.classList.add('correct');
        else if (bi === idx && !ok) b.classList.add('wrong');
        else b.classList.add('dim');
      }});
      const fb = $('feedback');
      const answerGloss = q.option_glosses[q.correct_index] || '';
      if (ok) {{
        correct += 1;
        fb.className = 'feedback good';
        fb.innerHTML = '<span class="head">✓ ' + q.correct_term + '</span>';
        answers.push({{term: q.term, correct: true}});
      }} else {{
        wrong += 1;
        const pickedTerm = q.option_terms[idx], pickedGloss = q.option_glosses[idx] || '';
        missed.push({{...q, pickedTerm: pickedTerm, pickedGloss: pickedGloss}});
        answers.push({{term: q.term, correct: false, confused: pickedTerm}});
        let why = 'answer: <code>' + q.correct_term + '</code> — ' + answerGloss;
        if (pickedTerm !== q.correct_term) why += '<br/>you picked: <code>' + pickedTerm + '</code> — ' + pickedGloss;
        if (q.note) why += '<br/>≠ ' + q.note;
        fb.className = 'feedback bad';
        fb.innerHTML = '<span class="head">✗ ' + letter(q.correct_index) + '</span>' +
          '<span class="why">' + why + '</span>';
      }}
      $('scoreLive').textContent = correct + ' ✓';
      $('nextBtn').disabled = false;
      $('nextBtn').focus();
    }}

    function next() {{
      if (!answered) return;
      if (i + 1 >= deck.length) {{ finish(); return; }}
      i += 1;
      renderQuestion();
    }}

    function persistRound(pct) {{
      const store = loadStore();
      store.stats = store.stats || {{}};
      answers.forEach(a => {{
        const s = store.stats[a.term] || {{fails: 0, passes: 0, box: 0}};
        if (a.correct) {{ s.passes += 1; s.box = Math.min((s.box || 0) + 1, 5); }}
        else {{ s.fails += 1; s.box = 0; }}
        store.stats[a.term] = s;
      }});
      store.last = {{correct: correct, wrong: wrong, pct: pct, missed: missed.map(m => m.term)}};
      saveStore(store);
    }}

    function recordLines() {{
      return answers.map(a => {{
        let line = 'glossary-drill record --term "' + a.term + '" ' + (a.correct ? '--correct' : '--wrong');
        if (!a.correct && a.confused && a.confused !== a.term) line += ' --confused-with "' + a.confused + '"';
        return line;
      }}).join('\\n');
    }}

    function finish() {{
      $('progress').style.width = '100%';
      show($('doneScreen'));
      const total = correct + wrong;
      const pct = total ? Math.round((correct / total) * 100) : 0;
      $('statCorrect').textContent = String(correct);
      $('statWrong').textContent = String(wrong);
      $('statPct').textContent = pct + '%';
      $('doneSub').textContent = total + ' answered · source: docs/glossary';
      $('doneTitle').textContent = pct >= 90 ? '很稳 / Locked in' : (pct >= 60 ? '不错 / Solid' : '再练练 / Again');
      const list = $('missList');
      list.innerHTML = '';
      if (!missed.length) {{
        const li = document.createElement('li');
        li.textContent = 'No misses · 全对 🎉';
        list.appendChild(li);
      }} else {{
        missed.forEach((m) => {{
          const li = document.createElement('li');
          const noteHtml = m.note ? '<br/>≠ ' + escapeHtml(m.note) : '';
          li.innerHTML = '<code>' + escapeHtml(m.correct_term) + '</code> — ' +
            escapeHtml(m.option_glosses[m.correct_index] || '') +
            '<br/><span style="opacity:.8">you picked <code>' + escapeHtml(m.pickedTerm) +
            '</code></span>' + noteHtml;
          list.appendChild(li);
        }});
      }}
      $('retryMissedBtn').disabled = missed.length === 0;
      $('syncText').value = recordLines();
      persistRound(pct);
      renderResume();
    }}

    function escapeHtml(s) {{
      return String(s).replace(/[&<>]/g, c => ({{'&': '&amp;', '<': '&lt;', '>': '&gt;'}}[c]));
    }}

    function start(from) {{
      deck = from.slice();
      i = 0; correct = 0; wrong = 0; missed = []; answers = [];
      if (!deck.length) {{ alert('No items'); return; }}
      show($('quizScreen'));
      renderQuestion();
    }}

    $('startBtn').addEventListener('click', () => start(ALL));
    $('restartBtn').addEventListener('click', () => start(ALL));
    $('weakBtn').addEventListener('click', () => {{
      const weak = new Set(weakTerms());
      const ordered = ALL.slice().sort((a, b) => (weak.has(b.term) ? 1 : 0) - (weak.has(a.term) ? 1 : 0));
      start(ordered);
    }});
    $('retryMissedBtn').addEventListener('click', () => {{ if (missed.length) start(missed); }});
    $('nextBtn').addEventListener('click', next);
    $('copySyncBtn').addEventListener('click', () => {{
      const ta = $('syncText'); ta.select();
      try {{ navigator.clipboard.writeText(ta.value); }} catch (_) {{ document.execCommand('copy'); }}
      $('copySyncBtn').textContent = 'Copied ✓';
      setTimeout(() => {{ $('copySyncBtn').textContent = 'Copy'; }}, 1200);
    }});
    document.addEventListener('keydown', (e) => {{
      if ($('quizScreen').classList.contains('hidden')) return;
      const k = e.key.toUpperCase();
      if (!answered && k >= 'A' && k <= 'Z') {{
        const idx = k.charCodeAt(0) - 65;
        if (idx < deck[i].options.length) choose(idx);
      }} else if ((e.key === 'Enter' || e.key === ' ') && answered) {{ e.preventDefault(); next(); }}
    }});

    renderResume();
  }})();
  </script>
</body>
</html>
"""
