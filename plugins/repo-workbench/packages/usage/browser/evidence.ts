import { summarize, estimate, type UsageRecord, type Prices, type Snapshot } from '../model.ts';
import { element, set, node, exact, money } from './dom.ts';
export function createEvidenceDrawer(options: {
  snapshot: () => Snapshot;
  prices: () => Prices;
  timezone: () => string;
}) {
  let isOpen = false;
  let focusBefore: HTMLElement | null = null;
  function openEvidence(records: UsageRecord[], title: string) {
    focusBefore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    isOpen = true;
    const snapshot = options.snapshot(),
      prices = options.prices();
    set('evidence-title', title);
    const content = element('evidence-content');
    content.replaceChildren();
    const total = summarize(records, prices);
    content.append(
      node(
        'p',
        `${exact(total.events)} usage events · ${exact(total.total)} tokens · ${total.priced ? money(total.knownCost) + ' priced subtotal' : 'unpriced'}`,
        'caption',
      ),
    );
    const sessions = [...new Set(records.map((record) => record.session))];
    const actions = node('div', '', 'tools');
    for (const session of sessions) {
      const link = document.createElement('a');
      link.className = 'trace-link';
      link.textContent =
        sessions.length === 1
          ? 'Open full trace ↗'
          : 'Open full trace · ' + session.slice(0, 8) + ' ↗';
      if (location.protocol === 'http:') {
        link.href = '/trace?session=' + encodeURIComponent(session) + '#view=conversation';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      } else {
        link.setAttribute('aria-disabled', 'true');
        link.title = 'Run npm run usage:dashboard -- --serve to open full local traces.';
      }
      actions.append(link);
    }
    content.append(
      actions,
      node(
        'p',
        location.protocol === 'http:'
          ? 'Full trace includes available messages, tools, outputs and indexed child sessions, regardless of the current usage filters.'
          : 'Full traces require the local dashboard server: npm run usage:dashboard -- --serve.',
        'caption',
      ),
    );
    const usedSources = new Set(records.map((r) => r.source));
    for (const source of snapshot.sources.filter((s) => usedSources.has(s.path))) {
      const d = node('details');
      d.append(node('summary', source.path));
      d.append(
        node(
          'pre',
          `SHA-256: ${source.sha256}\nBytes scanned: ${source.bytes}\nPhysical lines: ${source.lines}\nSession: ${source.session}\nDelegated by: ${source.parent || 'None'}\nForked from: ${source.forkedFrom || 'None'}\nHistory inherited from: ${source.historyBase || 'None'}`,
        ),
      );
      content.append(d);
    }
    // Keep very large usage summaries responsive; full history opens in the trace visualizer.
    const shown = records
      .slice()
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 100);
    for (const r of shown) {
      const d = node('div', '', 'record');
      d.append(
        node(
          'p',
          new Date(r.at).toLocaleString('en', { timeZone: options.timezone() }) +
            ' · ' +
            r.model +
            ' · ' +
            r.effort,
        ),
      );
      d.append(
        node(
          'p',
          `Input ${exact(r.tokens.input)} (read ${exact(r.tokens.cached)}, write ${exact(r.tokens.write)}) · output ${exact(r.tokens.output)} (reasoning ${exact(r.tokens.reasoning)})`,
        ),
      );
      const cost = estimate(r, prices);
      d.append(
        node(
          'p',
          `${cost === null ? 'Unpriced' : money(cost) + ' estimated'} · ${r.method === 'response' ? 'Per-response record' : r.method === 'snapshot' ? 'Last-request snapshot' : 'Cumulative delta'}`,
        ),
      );
      d.append(node('code', `${r.source}:${r.line}`));
      const detail = node('details');
      detail.append(node('summary', 'Normalized record'));
      detail.append(node('pre', JSON.stringify(r, null, 2)));
      d.append(detail);
      content.append(d);
    }
    if (records.length > shown.length)
      content.append(
        node(
          'p',
          `Showing ${shown.length} of ${records.length} records. Open full trace for complete available session history.`,
          'caption',
        ),
      );
    element('evidence').hidden = false;
    element('close-evidence').focus();
  }
  function closeEvidence() {
    element('evidence').hidden = true;
    isOpen = false;
    focusBefore?.focus();
  }
  element('close-evidence').addEventListener('click', closeEvidence);
  element('evidence').addEventListener('click', (e) => {
    if (e.target === element('evidence')) closeEvidence();
  });
  document.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') closeEvidence();
    if (e.key === 'Tab') {
      const focusable = [
        ...element('evidence').querySelectorAll<HTMLElement>('button,summary,a[href]'),
      ];
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });
  return openEvidence;
}
