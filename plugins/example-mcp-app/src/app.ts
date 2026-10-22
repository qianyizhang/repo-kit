import { App, PostMessageTransport, applyDocumentTheme } from '@modelcontextprotocol/ext-apps';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { TraceLog, observedTransport, boundedPayload } from './trace.ts';
import {
  serverIdentitySchema,
  snapshotSchema,
  type JourneyId,
  type Run,
  type TraceEvent,
} from './contracts.ts';
import { journeys, makeFixture, hostEvidence, runEvents, type Scenario } from './journeys.ts';
declare const EXAMPLE_BUILD: string;
function el<T extends HTMLElement>(id: string, type: { new (): T }): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error(`Missing ${id}`);
  return node;
}
const text = (id: string, value: string) => {
  el(id, HTMLElement).textContent = value;
};
const button = (id: string) => el(id, HTMLButtonElement);
const select = (id: string) => el(id, HTMLSelectElement);
const panelId = crypto.randomUUID();
const hostAvailable = window.parent !== window;
let mode: 'fixture' | 'live' = hostAvailable ? 'live' : 'fixture',
  journey: JourneyId = 'startup';
let connection = hostAvailable ? 'Connecting' : 'No native host',
  busy = false,
  ordinal = 0,
  scheduled = false;
let serverEvents: TraceEvent[] = [],
  serverDropped = 0,
  serverInstance = '',
  serverBuild = '',
  reportState = '';
const liveRuns: Run[] = [],
  fixtures = new Map<JourneyId, ReturnType<typeof makeFixture>>();
const selectedRuns = new Map<JourneyId, string>();
const log = new TraceLog('app', () => {
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      renderEvidence();
    });
  }
});
const lifetime = new AbortController();
const options = { timeout: 10000, signal: lifetime.signal };
const app = new App(
  { name: 'Example MCP App', version: '0.2.0' },
  { availableDisplayModes: ['inline', 'fullscreen'] },
  { autoResize: true, strict: true },
);
function currentRun(): Run | undefined {
  if (mode === 'fixture') return fixtures.get(journey)?.run;
  return (
    liveRuns.find((run) => run.id === selectedRuns.get(journey)) ??
    liveRuns.findLast((run) => run.journey === journey)
  );
}
function evidence(): TraceEvent[] {
  return mode === 'fixture'
    ? (fixtures.get(journey)?.events ?? [])
    : [...log.events, ...serverEvents];
}
const statusLabel: Record<Run['status'], string> = {
  running: 'In progress',
  success: 'Succeeded',
  error: 'Failed',
  uncertain: 'Not confirmed',
  closed: 'Cleanup acknowledged',
};
function eventCard(event: TraceEvent) {
  const card = document.createElement('article');
  card.className = 'event';
  card.dataset.error = String(event.status.includes('error'));
  const heading = document.createElement('h4');
  heading.textContent =
    event.kind === 'response'
      ? 'Response'
      : event.kind === 'request'
        ? 'Request'
        : event.kind === 'notification'
          ? 'Notification'
          : 'Local observation';
  const method = document.createElement('div');
  method.className = 'method';
  method.textContent = event.method;
  const meta = document.createElement('div');
  meta.className = 'event-meta';
  const direction = document.createElement('span');
  direction.textContent = event.direction;
  const status = document.createElement('span');
  status.textContent =
    event.kind === 'response'
      ? event.status === 'success'
        ? 'Success'
        : event.status
      : event.status === 'captured'
        ? 'Captured'
        : event.status;
  if (event.provenance === 'fixture') status.textContent = `Example · ${status.textContent}`;
  meta.append(direction, status);
  const details = document.createElement('details'),
    summary = document.createElement('summary');
  summary.textContent = 'Wire details';
  const note = document.createElement('p');
  note.className = 'wire-note';
  note.textContent = `${event.provenance === 'fixture' ? 'Fixture envelope' : 'Captured envelope'} · ${event.source} event ${event.sequence}${event.requestId === undefined ? ' · no response ID' : ` · wire ID ${event.requestId}`}${event.elapsedMs === undefined ? '' : ` · ${event.elapsedMs} ms local request–response interval`}. Wire IDs are local to this connection.`;
  const pre = document.createElement('pre');
  pre.textContent = event.payload;
  details.append(summary, note, pre);
  card.append(heading, method, meta, details);
  return card;
}
function putEvents(id: string, events: TraceEvent[], empty: string) {
  const container = el(id, HTMLDivElement);
  // Retain expanded JSON and focus across incoming trace updates.
  const openKeys = new Set(
    [...container.querySelectorAll<HTMLElement>('article[data-key]')]
      .filter((n) => n.querySelector('details')?.open)
      .map((n) => n.dataset.key),
  );
  const active = document.hasFocus() ? document.activeElement : null;
  const focusKey =
    active instanceof HTMLElement ? active.closest<HTMLElement>('article')?.dataset.key : undefined;
  const cards = events.map((event) => {
    const node = eventCard(event);
    node.dataset.key = `${event.source}:${event.sequence}`;
    if (openKeys.has(node.dataset.key)) node.querySelector('details')!.open = true;
    return node;
  });
  if (!cards.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = empty;
    container.replaceChildren(p);
  } else container.replaceChildren(...cards);
  if (focusKey)
    cards
      .find((node) => node.dataset.key === focusKey)
      ?.querySelector('summary')
      ?.focus({ preventScroll: true });
}
function renderEvidence() {
  const run = currentRun(),
    events = run ? runEvents(run, evidence()) : [];
  text(
    'run-title',
    run
      ? `${mode === 'fixture' ? 'Fixture' : `Run ${run.ordinal}`} · ${journeys[run.journey].title}`
      : 'No interaction yet',
  );
  const outcome = el('outcome', HTMLDivElement);
  outcome.replaceChildren();
  outcome.className = run ? 'outcome' : '';
  if (run) {
    outcome.dataset.status = run.status;
    const label = document.createElement('b');
    label.textContent = `${mode === 'fixture' ? 'Example outcome' : 'Actual outcome'}: ${statusLabel[run.status]}`;
    outcome.append(label, document.createTextNode(run.summary));
  }
  text('route', journeys[journey].route);
  putEvents(
    'app-events',
    events.filter((e) => e.source === 'app'),
    run
      ? 'No app event captured for this interaction.'
      : 'Run this journey to see the app’s messages.',
  );
  putEvents(
    'server-events',
    events.filter((e) => e.source === 'server'),
    ['context', 'message', 'teardown'].includes(journey)
      ? 'No demo server operation belongs to this journey. Evidence collection is separate.'
      : run
        ? 'No correlated server event captured. Refresh evidence to check.'
        : 'The server’s part will appear here.',
  );
  const host = el('host-events', HTMLDivElement);
  host.replaceChildren();
  if (run) {
    const meaning = hostEvidence(run, events),
      card = document.createElement('article'),
      title = document.createElement('h4'),
      body = document.createElement('p');
    card.className = 'host-card';
    title.textContent = meaning.label;
    body.textContent = meaning.body;
    card.append(title, body);
    host.append(card);
  } else {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent =
      'Host forwarding will be labelled as inferred. Actual bridge acknowledgments will be identified separately.';
    host.append(p);
  }
  el('result-details', HTMLDetailsElement).hidden = !run;
  text('result', run?.result ?? '');
  const history = select('history'),
    runs = liveRuns
      .filter((r) => r.journey === journey)
      .slice()
      .reverse();
  el('history-label', HTMLLabelElement).hidden = mode === 'fixture' || runs.length < 2;
  history.replaceChildren(
    ...runs.map((r) => new Option(`Run ${r.ordinal} · ${statusLabel[r.status]}`, r.id)),
  );
  if (run) history.value = run.id;
  const background = [...log.events, ...serverEvents].filter(
    (event) => event.observer || !event.runId,
  );
  el('background', HTMLDetailsElement).hidden = mode === 'fixture';
  text(
    'background-title',
    `Background traffic · ${background.length} retained events · ${log.dropped + serverDropped} evicted`,
  );
  // Only render background payloads when explicitly opened.
  if (el('background', HTMLDetailsElement).open)
    putEvents('background-events', background.slice(-30).reverse(), 'No background events.');
  text('diagnostic-status', reportState);
}
function liveBlockReason(): string | undefined {
  if (mode === 'fixture') return;
  if (!hostAvailable) return 'Open the installed Example MCP App in Codex to run live.';
  if (connection !== 'Connected') return `Live actions unavailable: ${connection.toLowerCase()}.`;
  if (serverBuild && serverBuild !== EXAMPLE_BUILD)
    return 'Build mismatch. Restart the MCP connection and reopen the plugin.';
  const caps = app.getHostCapabilities();
  const allowed =
    journey === 'teardown' ||
    (journey === 'message'
      ? caps?.message
      : journey === 'context'
        ? caps?.updateModelContext
        : journey === 'resource' ||
            (journey === 'error' && select('scenario').value === 'protocol-error')
          ? caps?.serverResources
          : caps?.serverTools);
  if (!allowed) return 'This host did not advertise the capability needed for this journey.';
}
function availability(): string {
  if (mode === 'fixture')
    return 'Authored example only. This action makes no host or server calls.';
  return (
    liveBlockReason() ??
    (journey === 'message'
      ? 'This will send your demo text to the real host conversation.'
      : journey === 'teardown'
        ? 'The host may close this panel. Export evidence first.'
        : 'Actual SDK calls. No fixture fallback.')
  );
}
function updateControls() {
  const reason = availability();
  text('availability', reason);
  button('run').disabled = busy || Boolean(liveBlockReason());
  for (const node of document.querySelectorAll<HTMLButtonElement>('[data-journey]'))
    node.disabled = busy;
  select('scenario').disabled = busy;
  button('fixture-mode').disabled = busy;
  button('live-mode').disabled = busy || !hostAvailable;
  button('fixture-mode').setAttribute('aria-pressed', String(mode === 'fixture'));
  button('live-mode').setAttribute('aria-pressed', String(mode === 'live'));
  button('run').textContent = busy
    ? 'Running…'
    : mode === 'fixture'
      ? 'Play fixture'
      : journeys[journey].button;
  button('refresh').disabled =
    busy ||
    mode === 'fixture' ||
    connection !== 'Connected' ||
    !app.getHostCapabilities()?.serverTools;
  text('connection', mode === 'fixture' ? 'Fixture mode' : connection);
  text(
    'mode-note',
    mode === 'fixture'
      ? 'Deterministic teaching examples. No demo request, context update or chat message is sent.'
      : `${app.getHostVersion()?.name ?? 'Connecting to host'} · Live SDK traffic. Missing or failed calls stay visible; fixtures are never substituted.`,
  );
  document.body.className = `mode-${mode}`;
}
function renderPage() {
  const definition = journeys[journey],
    ids = Object.keys(journeys) as JourneyId[];
  text(
    'journey-number',
    `JOURNEY ${String(ids.indexOf(journey) + 1).padStart(2, '0')} / ${ids.length}`,
  );
  text('journey-title', definition.title);
  text('description', definition.description);
  text('expected', definition.expected);
  el('input-label', HTMLLabelElement).hidden = mode === 'fixture' || !definition.input;
  const scenarios =
    journey === 'error'
      ? [
          ['tool-error', 'Tool error'],
          ['protocol-error', 'Protocol error'],
        ]
      : journey === 'message' && mode === 'fixture'
        ? [
            ['success', 'Acknowledged'],
            ['rejected', 'Rejected'],
            ['timeout', 'No reply / timeout'],
          ]
        : [['success', 'Success']];
  select('scenario').replaceChildren(
    ...scenarios.map(([value, label]) => new Option(label, value)),
  );
  el('scenario-label', HTMLLabelElement).hidden = scenarios.length === 1;
  for (const node of document.querySelectorAll<HTMLButtonElement>('[data-journey]'))
    node.setAttribute('aria-current', node.dataset.journey === journey ? 'page' : 'false');
  updateControls();
  renderEvidence();
}
function connectionDetails() {
  text(
    'details',
    boundedPayload({
      panelId,
      mode,
      connection,
      appBuild: EXAMPLE_BUILD,
      serverBuild,
      serverInstance,
      host: app.getHostVersion(),
      capabilities: app.getHostCapabilities(),
      hostContext: app.getHostContext(),
      scope:
        'Server trace is captured at the MCP transport. Panel reports are self-reported UI evidence. Host internals and model execution are not observed.',
    }),
  );
}
async function refreshServer() {
  const response = await app.callServerTool({ name: 'example_trace', arguments: {} }, options);
  if (response.isError) throw new Error('Server rejected the evidence read');
  // Check the stable identity before the version-specific trace schema. Older
  // servers may omit fields; that must still block incompatible live actions.
  const identity = serverIdentitySchema.parse(response.structuredContent);
  serverBuild = identity.build;
  if (serverBuild !== EXAMPLE_BUILD) {
    serverEvents = [];
    throw new Error('Build mismatch. Restart the MCP connection and reopen the plugin.');
  }
  const snapshot = snapshotSchema.parse(response.structuredContent);
  if (serverInstance && serverInstance !== snapshot.instance)
    reportState = 'Server restarted. Previous server captures are no longer available.';
  serverInstance = snapshot.instance;
  serverBuild = snapshot.build;
  serverEvents = snapshot.events;
  serverDropped = snapshot.dropped;
  connectionDetails();
  updateControls();
  renderEvidence();
}
async function publishReport() {
  if (mode !== 'live' || connection !== 'Connected' || !app.getHostCapabilities()?.serverTools)
    return;
  const response = await app.callServerTool(
    {
      name: 'example_report',
      arguments: {
        report: {
          panelId,
          build: EXAMPLE_BUILD,
          host: app.getHostVersion() ?? { name: 'Unknown', version: 'unknown' },
          mode,
          connection,
          runs: liveRuns.slice(-30),
          events: log.events.filter((e) => !e.observer),
          dropped: log.dropped,
        },
      },
    },
    options,
  );
  if (response.isError) throw new Error('Server rejected the app evidence report');
  reportState =
    'Live panel evidence shared with this MCP server. Model delivery remains a separate check.';
}
async function syncEvidence() {
  try {
    await refreshServer();
    await publishReport();
  } catch (error) {
    reportState = `Evidence collection failed: ${String(error)}`;
  }
  connectionDetails();
  renderEvidence();
}
function startRun(id: string = crypto.randomUUID()): Run {
  const run: Run = {
    id,
    ordinal: ++ordinal,
    journey,
    mode: 'live',
    status: 'running',
    summary: 'Waiting for a response.',
    result: '',
    startedAt: new Date().toISOString(),
  };
  liveRuns.push(run);
  if (liveRuns.length > 30) liveRuns.shift();
  selectedRuns.set(journey, run.id);
  return run;
}
async function execute() {
  if (busy) return;
  if (mode === 'fixture') {
    fixtures.set(journey, makeFixture(journey, select('scenario').value as Scenario));
    renderEvidence();
    return;
  }
  if (liveBlockReason()) return;
  busy = true;
  updateControls();
  if (journey === 'startup') {
    await syncEvidence();
    busy = false;
    updateControls();
    return;
  }
  const run = startRun();
  log.activeRun = run.id;
  renderEvidence();
  const input = el('demo-text', HTMLTextAreaElement).value;
  try {
    let result: unknown;
    if (
      journey === 'tool' ||
      (journey === 'error' && select('scenario').value !== 'protocol-error')
    ) {
      const response = await app.callServerTool(
        {
          name: 'example_echo',
          arguments: { text: input, fail: journey === 'error', runId: run.id },
        },
        options,
      );
      result = response;
      run.status = response.isError ? 'error' : 'success';
      run.summary = response.isError
        ? 'Expected tool error returned. JSON-RPC completed, but the tool reported failure.'
        : 'The server returned the demo text. Inspect both connections below.';
    } else if (journey === 'resource' || journey === 'error') {
      result = await app.readServerResource(
        { uri: `example://sample/${journey === 'error' ? 'missing' : 'run'}/${run.id}` },
        options,
      );
      run.status = 'success';
      run.summary = 'JSON resource returned through the host.';
    } else if (journey === 'message') {
      const response = await app.sendMessage(
        { role: 'user', content: [{ type: 'text', text: input }] },
        options,
      );
      result = response;
      run.status = response.isError ? 'error' : 'success';
      run.summary = response.isError
        ? 'The host rejected this message.'
        : 'Host acknowledgment captured. Check this conversation for actual arrival and any reply; neither is proven by this response.';
    } else if (journey === 'context') {
      result = await app.updateModelContext({ content: [{ type: 'text', text: input }] }, options);
      run.status = 'success';
      run.summary =
        'Host acknowledged the context update. No model turn was requested; model use is not observed.';
    } else {
      log.teardownRun = run.id;
      await app.requestTeardown();
      result = { request: 'sent' };
      if (run.status !== 'closed') {
        run.status = 'uncertain';
        run.summary =
          'Closure requested. Waiting for a host cleanup request; the notification alone is not confirmation.';
      }
    }
    run.result = boundedPayload(result);
  } catch (error) {
    const timeout = error instanceof McpError && error.code === Number(ErrorCode.RequestTimeout);
    run.status = timeout ? 'uncertain' : 'error';
    run.summary = timeout
      ? 'No acknowledgment arrived. Delivery is uncertain; no automatic retry.'
      : `Request failed: ${String(error)}`;
    run.result = boundedPayload({ error: String(error) });
    log.local('action.failed', { error: String(error) }, 'error', run.id);
  } finally {
    log.activeRun = undefined;
    renderEvidence();
    if (connection === 'Connected') await syncEvidence();
    busy = false;
    updateControls();
  }
}
app.onhostcontextchanged = (context) => {
  if (context.theme) applyDocumentTheme(context.theme);
  connectionDetails();
};
app.ontoolinput = () => {};
app.ontoolinputpartial = () => {};
app.ontoolresult = () => {
  renderEvidence();
};
app.ontoolcancelled = (params) => {
  log.local('host.tool-cancelled', params, 'captured', 'startup');
};
app.onteardown = () => {
  let run = liveRuns.find((r) => r.id === log.teardownRun);
  if (!run) {
    run = {
      id: 'host-teardown',
      ordinal: ++ordinal,
      journey: 'teardown',
      mode: 'live',
      status: 'running',
      summary: '',
      result: '{}',
      startedAt: new Date().toISOString(),
    };
    liveRuns.push(run);
    selectedRuns.set('teardown', run.id);
  }
  run.status = 'closed';
  run.summary =
    'The host requested cleanup. This handler is acknowledging; the host controls removal.';
  log.local('app.cleanup', {}, 'captured', run.id);
  connection = 'Closed';
  lifetime.abort(new Error('Panel closed'));
  updateControls();
  renderEvidence();
  return {};
};
app.onclose = () => {
  if (connection !== 'Closed') connection = 'Disconnected';
  updateControls();
};
app.onerror = (error) => {
  log.local('app.error', String(error), 'error');
};
for (const [key, value] of Object.entries(journeys)) {
  const node = document.createElement('button');
  node.textContent = value.title;
  node.dataset.journey = key;
  node.onclick = () => {
    journey = key as JourneyId;
    renderPage();
  };
  el('journeys', HTMLElement).append(node);
}
button('fixture-mode').onclick = () => {
  mode = 'fixture';
  renderPage();
  connectionDetails();
};
button('live-mode').onclick = () => {
  mode = 'live';
  renderPage();
  connectionDetails();
};
button('run').onclick = () => {
  void execute();
};
select('scenario').onchange = () => {
  updateControls();
};
select('history').onchange = () => {
  selectedRuns.set(journey, select('history').value);
  renderEvidence();
};
el('background', HTMLDetailsElement).ontoggle = () => renderEvidence();
button('refresh').onclick = () => {
  void (async () => {
    if (busy) return;
    busy = true;
    updateControls();
    await syncEvidence();
    busy = false;
    updateControls();
  })();
};
button('export').onclick = () => {
  void (async () => {
    const body = JSON.stringify(
      {
        format: 'example-mcp-journeys/v2',
        mode,
        panelId,
        build: EXAMPLE_BUILD,
        host: mode === 'live' ? app.getHostVersion() : null,
        scope:
          mode === 'fixture'
            ? 'Authored fixture. No live demo calls.'
            : 'Captured app/server transport evidence. No internal host or model execution visibility.',
        runs: mode === 'fixture' ? [...fixtures.values()].map((f) => f.run) : liveRuns,
        events:
          mode === 'fixture'
            ? [...fixtures.values()].flatMap((f) => f.events)
            : [...log.events, ...serverEvents],
      },
      null,
      2,
    );
    try {
      if (mode === 'live' && app.getHostCapabilities()?.downloadFile) {
        const result = await app.downloadFile(
          {
            contents: [
              {
                type: 'resource',
                resource: {
                  uri: 'example://export/trace.json',
                  mimeType: 'application/json',
                  text: body,
                },
              },
            ],
          },
          options,
        );
        reportState = result.isError
          ? 'Host declined the export.'
          : 'Host acknowledged the export request.';
      } else {
        const blob = new Blob([body], { type: 'application/json' }),
          url = URL.createObjectURL(blob),
          a = document.createElement('a');
        a.href = url;
        a.download = `example-mcp-${mode}-trace.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        reportState = 'Export requested. Downloads depend on the host sandbox.';
      }
    } catch (error) {
      reportState = `Export failed: ${String(error)}`;
    }
    renderEvidence();
  })();
};
renderPage();
connectionDetails();
async function connect() {
  if (!hostAvailable) return;
  busy = true;
  updateControls();
  const run = startRun('startup');
  log.local('app.mounted', { build: EXAMPLE_BUILD }, 'captured', 'startup');
  try {
    await app.connect(
      observedTransport(new PostMessageTransport(window.parent, window.parent), log),
      options,
    );
    connection = 'Connected';
    const context = app.getHostContext();
    if (context?.theme) applyDocumentTheme(context.theme);
    run.status = 'success';
    run.summary =
      'The live app bridge is connected. Server startup and HTML-loading evidence are shown separately.';
    run.result = boundedPayload({
      host: app.getHostVersion(),
      capabilities: app.getHostCapabilities(),
    });
    await syncEvidence();
  } catch (error) {
    connection = 'Connection failed';
    run.status = 'error';
    run.summary = String(error);
    run.result = boundedPayload({ error: String(error) });
  }
  busy = false;
  updateControls();
  connectionDetails();
  renderEvidence();
}
void connect();
