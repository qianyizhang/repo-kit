import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { makeFixture, journeys } from '../src/journeys.ts';
import { PanelReports, type JourneyId } from '../src/contracts.ts';

void test('fixtures are deterministic and labelled; distinct wire IDs group by interaction', () => {
  for (const journey of Object.keys(journeys) as JourneyId[]) {
    const first = makeFixture(journey, 'success');
    assert.deepEqual(first, makeFixture(journey, 'success'));
    assert.ok(first.events.every((e) => e.provenance === 'fixture'));
    assert.ok(first.events.every((e) => e.runId === first.run.id));
  }
  const fixture = makeFixture('tool', 'success');
  assert.deepEqual(
    fixture.events.map((e) => e.requestId),
    [7, 42, 42, 7],
  );
  assert.equal(makeFixture('message', 'timeout').run.status, 'uncertain');
  assert.equal(makeFixture('message', 'rejected').run.status, 'error');
});
void test('panel reports evict oldest and support selecting one panel', () => {
  const reports = new PanelReports();
  const ids = Array.from({ length: 13 }, () => randomUUID());
  for (const panelId of ids)
    reports.put({
      panelId,
      build: 'test',
      host: { name: 'test', version: '1' },
      connection: 'Connected',
      mode: 'live',
      runs: [],
      events: [],
      dropped: 0,
    });
  assert.equal(reports.list().length, 12);
  assert.equal(reports.list(ids[0]).length, 0);
  assert.equal(reports.list(ids[12]).length, 1);
});
