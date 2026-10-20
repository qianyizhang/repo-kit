import { createCharts } from './charts.ts';
import { createEvidenceDrawer } from './evidence.ts';
import {
  element,
  input,
  set,
  node,
  compact,
  exact,
  money,
  share,
  shortProject,
  group,
  download,
} from './dom.ts';
import { officialPrices, priceDate, priceSource } from '../pricing.ts';
import {
  csv,
  dateKey,
  parsePrices,
  selectRecords,
  summarize,
  type Filters,
  type Prices,
  type Snapshot,
  type UsageRecord,
} from '../model.ts';
async function main() {
  const encoded = element('usage-data');
  const compressed = Uint8Array.from(atob(encoded.textContent ?? ''), (c) => c.charCodeAt(0));
  const data = await new Response(
    new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')),
  ).text();
  let snapshot = JSON.parse(data) as Snapshot;
  encoded.remove();
  let prices: Prices = parsePrices(officialPrices);
  const storageKey = 'codex-offline-usage-prices-v2';
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) prices = parsePrices(JSON.parse(saved));
    else {
      const legacy = localStorage.getItem('codex-offline-usage-prices-v1');
      if (legacy) prices = parsePrices({ ...officialPrices, ...parsePrices(JSON.parse(legacy)) });
      localStorage.setItem(storageKey, JSON.stringify(prices));
    }
  } catch {
    /* Unavailable browser storage or invalid saved rates: use the official defaults. */
  }
  const autoReviewToggle = element<HTMLInputElement>('ignore-auto-review');
  const autoReviewKey = 'codex-offline-usage-ignore-auto-review-v1';
  try {
    autoReviewToggle.checked = localStorage.getItem(autoReviewKey) !== 'false';
  } catch {
    /* The default still works when storage is unavailable. */
  }
  const filters = (): Filters => ({
    from: input('from').value,
    to: input('to').value,
    model: input('model').value,
    project: input('project').value,
    effort: input('effort').value,
    search: input('search').value,
    timezone: input('timezone').value,
    ignoreAutoReview: autoReviewToggle.checked,
  });
  const selected = () => selectRecords(snapshot.records, filters());
  let page = 0;
  const pageSize = 15;
  let sortKey = 'tokens';
  let sortDirection = -1;
  const openEvidence = createEvidenceDrawer({
    snapshot: () => snapshot,
    prices: () => prices,
    timezone: () => filters().timezone,
  });
  const charts = createCharts({
    prices: () => prices,
    filters,
    inspect: openEvidence,
    select: (fields) => {
      for (const [key, value] of Object.entries(fields)) input(key).value = value;
      page = 0;
      render();
    },
  });
  function message(text: string, error = false) {
    set('message', text);
    element('message').className = error ? 'error' : '';
  }
  function populateFilters() {
    for (const [id, key, label] of [
      ['model', 'model', 'models'],
      ['project', 'project', 'projects'],
      ['effort', 'effort', 'efforts'],
    ] as const) {
      const select = element<HTMLSelectElement>(id);
      const value = select.value;
      select.replaceChildren(new Option(`All ${label}`, ''));
      for (const item of [...new Set(snapshot.records.map((r) => r[key]))].sort()) {
        const option = new Option(id === 'project' ? shortProject(item) : item, item);
        option.title = item;
        select.add(option);
      }
      if ([...select.options].some((o) => o.value === value)) select.value = value;
    }
  }
  function range(days: number | null) {
    if (days === null) {
      input('from').value = '';
      input('to').value = '';
    } else {
      const end = dateKey(new Date().toISOString(), input('timezone').value);
      const start = new Date(end + 'T12:00:00Z');
      start.setUTCDate(start.getUTCDate() - days + 1);
      input('from').value = start.toISOString().slice(0, 10);
      input('to').value = end;
    }
    page = 0;
    render();
  }
  function tab(name: string) {
    for (const t of ['overview', 'pricing', 'sources']) element(t).hidden = t !== name;
    document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === name);
      b.setAttribute('aria-current', b.dataset.tab === name ? 'page' : 'false');
    });
    if (name === 'pricing') renderPrices();
    if (name === 'sources') renderSources();
  }
  function renderSessions(records: UsageRecord[]) {
    const groups = [...group(records, (r) => r.session)].map(([session, rows]) => ({
      session,
      rows,
      total: summarize(rows, prices),
    }));
    type Session = (typeof groups)[number];
    const columns: [string, string, (g: Session) => string | number | null][] = [
      ['session', 'Session / project', (g) => g.session + ' ' + g.rows[0].project],
      ['models', 'Models', (g) => [...new Set(g.rows.map((r) => r.model))].sort().join(', ')],
      ['effort', 'Effort', (g) => [...new Set(g.rows.map((r) => r.effort))].sort().join(', ')],
      ['last', 'Last activity', (g) => g.rows[g.rows.length - 1].at],
      ['events', 'Events', (g) => g.total.events],
      ['tokens', 'Tokens', (g) => g.total.total],
      ['reasoning', 'Reasoning / output', (g) => g.total.reasoningShare],
      ['cost', 'Estimated USD', (g) => (g.total.priced ? g.total.knownCost : null)],
    ];
    const column = columns.find(([key]) => key === sortKey) ?? columns[5];
    groups.sort((a, b) => {
      const x = column[2](a),
        y = column[2](b);
      if (x === null || y === null)
        return x === y ? a.session.localeCompare(b.session) : x === null ? 1 : -1;
      const comparison =
        typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return comparison * sortDirection || a.session.localeCompare(b.session);
    });
    const pages = Math.max(1, Math.ceil(groups.length / pageSize));
    page = Math.min(page, pages - 1);
    set('session-count', `${groups.length} sessions`);
    const container = element('sessions');
    container.replaceChildren();
    const table = node('table'),
      head = node('thead'),
      header = node('tr');
    for (const [key, text] of columns) {
      const th = node('th');
      th.setAttribute('scope', 'col');
      th.setAttribute(
        'aria-sort',
        sortKey === key ? (sortDirection === 1 ? 'ascending' : 'descending') : 'none',
      );
      const button = node(
        'button',
        text + (sortKey === key ? (sortDirection === 1 ? ' ↑' : ' ↓') : ''),
        'sort-header',
      );
      button.setAttribute('aria-label', 'Sort by ' + text);
      button.addEventListener('click', () => {
        sortDirection =
          sortKey === key ? -sortDirection : ['session', 'models', 'effort'].includes(key) ? 1 : -1;
        sortKey = key;
        page = 0;
        renderSessions(records);
        container.querySelector<HTMLElement>(`button[aria-label="Sort by ${text}"]`)?.focus();
      });
      th.append(button);
      header.append(th);
    }
    head.append(header);
    table.append(head);
    const body = node('tbody');
    for (const g of groups.slice(page * pageSize, (page + 1) * pageSize)) {
      const row = node('tr', '', 'session-row');
      row.tabIndex = 0;
      row.setAttribute('aria-label', 'Inspect session ' + g.session);
      const inspect = () => {
        row.focus();
        openEvidence(g.rows, 'Session · ' + g.session.slice(0, 8));
      };
      row.addEventListener('click', inspect);
      row.addEventListener('keydown', (e) => {
        if (e instanceof KeyboardEvent && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          inspect();
        }
      });
      const first = node('td');
      first.append(
        node('span', g.session.slice(0, 8)),
        node('div', shortProject(g.rows[0].project), 'caption'),
      );
      first.title = g.session + '\n' + g.rows[0].project;
      const reasoning = node(
        'td',
        share(g.total.reasoningShare) + (g.total.missingReasoning ? ' ≥' : ''),
        'number',
      );
      reasoning.title = `${exact(g.total.tokens.reasoning)} recorded reasoning / ${exact(g.total.tokens.output)} output tokens${g.total.missingReasoning ? '; missing counters make this a lower bound' : ''}`;
      row.append(
        first,
        node('td', String(columns[1][2](g))),
        node('td', String(columns[2][2](g))),
        node('td', dateKey(g.rows[g.rows.length - 1].at, filters().timezone)),
        node('td', exact(g.total.events), 'number'),
        node('td', compact(g.total.total), 'number'),
        reasoning,
        node(
          'td',
          g.total.priced
            ? money(g.total.knownCost) + (g.total.priced < g.total.events ? ' · partial' : '')
            : '—',
          'number',
        ),
      );
      body.append(row);
    }
    table.append(body);
    container.append(table);
    if (!groups.length) container.append(node('p', 'No sessions match these filters.', 'empty'));
    set('page-count', `${page + 1} / ${pages}`);
    element<HTMLButtonElement>('previous').disabled = page === 0;
    element<HTMLButtonElement>('next').disabled = page >= pages - 1;
  }
  function renderPrices() {
    const link = element<HTMLAnchorElement>('price-source');
    link.href = priceSource;
    link.textContent = `Official OpenAI rates · checked ${priceDate}`;
    const container = element('price-table');
    container.replaceChildren();
    const table = node('table');
    const tr = node('tr');
    for (const text of ['Model', 'Uncached input', 'Cache read', 'Cache write', 'Output'])
      tr.append(node('th', text));
    const head = node('thead');
    head.append(tr);
    table.append(head);
    const body = node('tbody');
    for (const model of [
      ...new Set([...snapshot.records.map((r) => r.model), ...Object.keys(prices)]),
    ].sort()) {
      const row = node('tr');
      row.append(node('td', model));
      for (const key of ['input', 'cached', 'write', 'output'] as const) {
        const td = node('td');
        const i = document.createElement('input');
        i.type = 'number';
        i.min = '0';
        i.step = 'any';
        i.placeholder = 'Unpriced';
        i.className = 'price-input';
        i.dataset.model = model;
        i.dataset.key = key;
        i.setAttribute('aria-label', `${model} ${key} USD per million`);
        if (prices[model]) i.value = String(prices[model][key]);
        td.append(i);
        row.append(td);
      }
      body.append(row);
    }
    table.append(body);
    container.append(table);
  }
  function renderSources() {
    set(
      'source-summary',
      `${snapshot.sources.length} files · ${snapshot.cachedFiles} unchanged files reused · ${snapshot.appendedFiles} appended files · ${snapshot.reindexedFiles} full scans · ${compact(snapshot.scannedBytes)} bytes scanned · ${snapshot.duplicates} duplicates ignored · ${snapshot.inherited} inherited records ignored`,
    );
    set('gap-label', `Coverage gaps (${snapshot.gaps.length})`);
    const totals = element('gap-summary');
    totals.replaceChildren();
    for (const [reason, rows] of group(snapshot.gaps, (g) => g.reason))
      totals.append(
        node(
          'p',
          `${reason}: ${exact(rows.reduce((n, g) => n + g.count, 0))} occurrences in ${new Set(rows.map((g) => g.source)).size} files`,
        ),
      );
    const gaps = element('gaps');
    gaps.replaceChildren();
    for (const g of snapshot.gaps) {
      const d = node('div', '', 'source');
      d.append(node('p', g.reason + (g.count > 1 ? ` · ${g.count} occurrences` : '')));
      if (g.example) d.append(node('p', 'Example: ' + g.example, 'caption'));
      d.append(node('code', g.source + (g.line ? ':' + g.line : '')));
      gaps.append(d);
    }
    if (!snapshot.gaps.length) gaps.append(node('p', 'No detected coverage gaps.'));
    set('source-label', `Source files (${snapshot.sources.length})`);
    const list = element('source-list');
    list.replaceChildren();
    for (const s of snapshot.sources) {
      const d = node('div', '', 'source');
      d.append(node('code', s.path));
      d.append(
        node(
          'p',
          `${exact(s.bytes)} bytes · ${exact(s.lines)} physical lines · ${exact(s.records)} retained events`,
        ),
      );
      const details = node('details');
      details.append(node('summary', 'Hash and session metadata'));
      details.append(node('pre', JSON.stringify(s, null, 2)));
      d.append(details);
      list.append(d);
    }
  }
  function render() {
    const records = selected();
    const s = summarize(records, prices);
    const f = filters();
    const invalid = !!f.from && !!f.to && f.from > f.to;
    if (invalid) message('The start date must be on or before the end date.', true);
    else if (element('message').textContent?.startsWith('The start date')) message('');
    set(
      'updated',
      'Scanned ' + new Date(snapshot.generatedAt).toLocaleString('en', { timeZone: f.timezone }),
    );
    set('total', compact(s.total));
    element('total').title = exact(s.total) + ' tokens';
    set('token-sub', `${compact(s.tokens.input)} input · ${compact(s.tokens.output)} output`);
    set('events', exact(s.events));
    set(
      'event-sub',
      `${exact(s.sessions)} sessions · ${new Set(records.map((r) => r.model)).size} models`,
    );
    set(
      'cache',
      s.tokens.input ? ((s.tokens.cached / s.tokens.input) * 100).toFixed(1) + '%' : '—',
    );
    set(
      'cache-sub',
      `${compact(s.tokens.cached)} cache-read tokens / ${compact(s.tokens.input)} input`,
    );
    set('reasoning', share(s.reasoningShare));
    set(
      'reasoning-sub',
      `${compact(s.tokens.reasoning)} reasoning / ${compact(s.tokens.output)} output${s.missingReasoning ? ` · lower bound: ${s.missingReasoning} events lack counters` : ''}`,
    );
    set('cost', s.priced ? money(s.knownCost) : '—');
    set(
      'cost-sub',
      `${s.priced} / ${s.events} events priced${s.priced < s.events ? ' · add rates in Pricing' : ' · estimated, not billed'}`,
    );
    const coverage = element('coverage');
    coverage.hidden = !snapshot.gaps.length;
    coverage.replaceChildren();
    if (snapshot.gaps.length) {
      coverage.append(
        document.createTextNode(
          `${snapshot.gaps.length} source coverage gaps. Totals include readable, supported usage only. `,
        ),
      );
      const b = node('button', 'Inspect coverage');
      b.addEventListener('click', () => {
        tab('sources');
        element('gaps').parentElement?.setAttribute('open', '');
      });
      coverage.append(b);
    }
    set(
      'footer-count',
      `${exact(records.length)} of ${exact(snapshot.records.length)} usage events · ${f.from || 'earliest'} through ${f.to || 'latest'} · ${f.timezone}${f.ignoreAutoReview ? ' · auto-review sessions hidden' : ''}`,
    );
    charts.render(records);
    renderSessions(records);
  }
  for (const id of ['from', 'to', 'model', 'project', 'effort', 'timezone'])
    input(id).addEventListener('change', () => {
      page = 0;
      render();
    });
  autoReviewToggle.addEventListener('change', () => {
    try {
      localStorage.setItem(autoReviewKey, String(autoReviewToggle.checked));
    } catch {
      /* Apply the filter even when browser storage is unavailable. */
    }
    page = 0;
    render();
  });
  input('search').addEventListener('input', () => {
    page = 0;
    render();
  });
  input('measure').addEventListener('change', () => charts.trend(selected()));
  document
    .querySelectorAll<HTMLButtonElement>('[data-tab]')
    .forEach((b) => b.addEventListener('click', () => tab(b.dataset.tab ?? 'overview')));
  document
    .querySelectorAll<HTMLButtonElement>('[data-range]')
    .forEach((b) =>
      b.addEventListener('click', () =>
        range(b.dataset.range === 'all' ? null : Number(b.dataset.range)),
      ),
    );
  element('reset').addEventListener('click', () => {
    for (const id of ['model', 'project', 'effort', 'search']) input(id).value = '';
    message('');
    range(30);
  });
  element('previous').addEventListener('click', () => {
    page--;
    renderSessions(selected());
  });
  element('next').addEventListener('click', () => {
    page++;
    renderSessions(selected());
  });
  element('export').addEventListener('click', () =>
    download('codex-usage.csv', csv(selected(), prices), 'text/csv;charset=utf-8'),
  );
  element('save-prices').addEventListener('click', () => {
    try {
      const proposed: Record<string, Record<string, number | boolean>> = {};
      const all = [...element('price-table').querySelectorAll<HTMLInputElement>('input')];
      for (const model of [...new Set(all.map((i) => i.dataset.model ?? ''))]) {
        const fields = all.filter((i) => i.dataset.model === model);
        if (fields.every((i) => i.value === '')) continue;
        if (fields.some((i) => i.value === ''))
          throw new Error(`Fill all four rates for ${model}, or leave them all blank.`);
        const price: Record<string, number | boolean> = {};
        for (const i of fields) price[i.dataset.key ?? ''] = Number(i.value);
        if (officialPrices[model]?.longContext) price.longContext = true;
        if (prices[model]?.writeUnpublished && price.write === 0) price.writeUnpublished = true;
        Object.defineProperty(proposed, model, { value: price, enumerable: true });
      }
      prices = parsePrices(proposed);
      localStorage.setItem(storageKey, JSON.stringify(prices));
      set('price-status', 'Saved in this browser.');
      render();
    } catch (e) {
      set('price-status', e instanceof Error ? e.message : String(e));
    }
  });
  element('reset-prices').addEventListener('click', () => {
    prices = parsePrices(officialPrices);
    localStorage.setItem(storageKey, JSON.stringify(prices));
    renderPrices();
    render();
    set('price-status', `Restored official rates checked ${priceDate}.`);
  });
  element('export-prices').addEventListener('click', () =>
    download('codex-usage-prices.json', JSON.stringify(prices, null, 2), 'application/json'),
  );
  element('import-prices').addEventListener('click', () =>
    element<HTMLInputElement>('price-file').click(),
  );
  element<HTMLInputElement>('price-file').addEventListener('change', () => {
    void (async () => {
      try {
        const file = element<HTMLInputElement>('price-file').files?.[0];
        if (!file) return;
        const imported = parsePrices(JSON.parse(await file.text()));
        localStorage.setItem(storageKey, JSON.stringify(imported));
        prices = imported;
        renderPrices();
        render();
        set('price-status', 'Imported and saved prices.');
      } catch (e) {
        set('price-status', e instanceof Error ? e.message : String(e));
      } finally {
        element<HTMLInputElement>('price-file').value = '';
      }
    })();
  });
  element('refresh').addEventListener('click', () => {
    if (!['http:', 'https:'].includes(location.protocol)) {
      message(
        'This is a saved snapshot. Re-run npm run usage:dashboard, or use --serve for local refresh.',
      );
      return;
    }
    const b = element<HTMLButtonElement>('refresh');
    b.disabled = true;
    message('Scanning local logs…');
    void (async () => {
      try {
        const response = await fetch('/refresh', {
          method: 'POST',
          headers: { 'X-Usage-Refresh': '1' },
        });
        if (!response.ok) throw new Error(await response.text());
        const data = (await response.json()) as Snapshot;
        if (data.schemaVersion !== 1 || !Array.isArray(data.records))
          throw new Error('Invalid usage snapshot');
        snapshot = data;
        populateFilters();
        render();
        if (!element('sources').hidden) renderSources();
        if (!element('pricing').hidden) renderPrices();
        message('Refreshed local usage logs.');
      } catch (e) {
        message(
          `Refresh failed: ${e instanceof Error ? e.message : String(e)}. Start with npm run usage:dashboard -- --serve.`,
          true,
        );
      } finally {
        b.disabled = false;
      }
    })();
  });
  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => charts.trend(selected()));
  });
  populateFilters();
  range(30);
}
void main().catch((error: unknown) => {
  const target = document.getElementById('message');
  if (target) {
    target.textContent = `Could not load the offline usage report: ${error instanceof Error ? error.message : String(error)}`;
    target.className = 'error';
  }
});
