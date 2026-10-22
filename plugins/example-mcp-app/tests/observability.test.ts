import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Observations } from '../src/observability.ts';
import { sequence, unseenDestination } from '../src/sequence.ts';
import { makeFixture } from '../src/journeys.ts';
import { TraceLog } from '../src/trace.ts';
void test('snapshot ingestion deduplicates overlap, bounds retention, and scopes sequence to connections', () => {
  const store = new Observations(3),
    fixture = makeFixture('tool', 'success');
  const app = fixture.events.filter((e) => e.source === 'app'),
    server = fixture.events.filter((e) => e.source === 'server');
  store.ingest('app', 'panel-1', app);
  store.ingest('app', 'panel-1', app);
  assert.equal(store.all().length, 2);
  store.ingest('server', 'server-1', server);
  assert.equal(store.all().length, 3);
  assert.equal(store.dropped, 1);
  store.ingest('server', 'server-1', server);
  assert.equal(store.dropped, 1);
  store.ingest('server', 'server-2', server);
  assert.equal(store.dropped, 3);
  assert.equal(new Set(store.all().map((e) => e.key)).size, 3);
  assert.ok(store.all().every(Object.isFrozen));
});
void test('late server observations append without inventing cross-source timing or correlation', () => {
  const store = new Observations(),
    fixture = makeFixture('tool', 'success');
  store.ingest(
    'app',
    'a',
    fixture.events.filter((e) => e.source === 'app'),
  );
  store.ingest(
    'server',
    's',
    fixture.events.filter((e) => e.source === 'server'),
  );
  const rows = sequence(store.all(), fixture.run);
  assert.deepEqual(
    rows.map((r) => r.event.source),
    ['app', 'server', 'server', 'app'],
  );
  assert.equal(rows.length, 4);
  assert.ok(rows.every((r) => r.inferredOrder));
  assert.deepEqual(
    store.all().map((e) => e.source),
    ['app', 'app', 'server', 'server'],
  );
  assert.equal(sequence(store.all(), { ...fixture.run, id: 'other' }).length, 0);
  assert.equal(unseenDestination(fixture.run), undefined);
  assert.match(unseenDestination(makeFixture('message', 'success').run)!, /not observed/);
  assert.equal(unseenDestination(makeFixture('message', 'rejected').run), undefined);
});
void test('actual partial input notifications update a stable stream row; raw records stay intact', () => {
  const log = new TraceLog('app'),
    store = new Observations(),
    run = { ...makeFixture('startup', 'success').run, id: 'startup' };
  const emit = (method: string, args: Record<string, unknown>) => {
    log.wire({ jsonrpc: '2.0', method, params: { arguments: args } }, true);
    store.ingest('app', 'panel', log.events);
  };
  emit('ui/notifications/tool-input-partial', { topic: 'par' });
  const key = sequence(store.all(), run)[0]!.key;
  emit('ui/notifications/tool-input-partial', { topic: 'partial input' });
  emit('ui/notifications/tool-input', { topic: 'final input' });
  const rows = sequence(store.all(), run);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.key, key);
  assert.equal(rows[0]!.stream.length, 3);
  assert.match(rows[0]!.event.payload, /final input/);
  assert.equal(store.all().length, 3);
  emit('ui/notifications/tool-input-partial', { next: true });
  assert.equal(sequence(store.all(), run).length, 2);
});
void test('all fixture outcomes use the same graph projection and keep errors at their actual layer', () => {
  const cases = [
    ['tool', 'success'],
    ['tool', 'tool-error'],
    ['resource', 'protocol-error'],
    ['message', 'rejected'],
    ['message', 'timeout'],
    ['context', 'success'],
    ['investigate', 'success'],
  ] as const;
  for (const [journey, scenario] of cases) {
    const fixture = makeFixture(journey, scenario),
      store = new Observations();
    for (const e of fixture.events) store.ingest(e.source, 'fixture', [e]);
    const rows = sequence(store.all(), fixture.run);
    assert.ok(rows.length);
    assert.ok(rows.every((r) => r.from !== 'conversation' && r.to !== 'conversation'));
  }
  assert.equal(makeFixture('tool', 'tool-error').run.status, 'error');
  assert.equal(makeFixture('resource', 'protocol-error').run.status, 'error');
});

void test('ambiguous repeated calls keep receipt order instead of inventing a forwarding match', () => {
  const fixture = makeFixture('tool', 'success'),
    store = new Observations();
  const events = [...fixture.events, { ...fixture.events[1]!, sequence: 20, requestId: 43 }];
  for (const e of events) store.ingest(e.source, 'fixture', [e]);
  const rows = sequence(store.all(), fixture.run);
  assert.ok(rows.every((r) => !r.inferredOrder));
});
