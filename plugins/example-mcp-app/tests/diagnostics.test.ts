import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Diagnostics } from '../src/diagnostics.ts';
import { TraceLog } from '../src/trace.ts';

void test('existing frozen trace records feed metadata logs and one explicit capture without duplicates', () => {
  const root = mkdtempSync(join(tmpdir(), 'example-diagnostics-'));
  try {
    const diagnostics = new Diagnostics(root),
      panel = crypto.randomUUID(),
      run = crypto.randomUUID();
    const log = new TraceLog('app');
    log.activeRun = run;
    log.local('test.request', { text: 'private selected text', token: 'private credential' });
    const event = log.events[0]!;
    diagnostics.record(panel, event);
    diagnostics.record(panel, event);
    assert.equal(diagnostics.store.events.length, 1);
    const metadata = readFileSync(join(diagnostics.store.directory, 'app.jsonl'), 'utf8');
    assert.doesNotMatch(metadata, /private selected text|private credential/);
    assert.equal(
      readdirSync(diagnostics.store.directory).some((name) => name.startsWith('capture-')),
      false,
    );
    log.local('test.other', 'unrelated text', 'captured', crypto.randomUUID());
    diagnostics.record(panel, log.events[1]!);
    const saved = diagnostics.store.capture(run);
    const capture = readFileSync(saved.path, 'utf8');
    assert.match(capture, /private selected text/);
    assert.doesNotMatch(capture, /private credential|unrelated text/);
    assert.equal(saved.eventCount, 1);
    assert.throws(() => diagnostics.store.capture(crypto.randomUUID()), /expired/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
