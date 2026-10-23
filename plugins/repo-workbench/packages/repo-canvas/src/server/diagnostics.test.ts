import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConnectionDiagnostics } from './diagnostics';
import { LogStore, MAX_FILE_BYTES } from '../../../diagnostics/store';

it('bounds connection history, rotates private logs and survives unavailable storage', () => {
  const root = mkdtempSync(join(tmpdir(), 'canvas-diagnostics-'));
  try {
    const store = new LogStore('repo-canvas', root);
    const file = join(store.directory, 'server.jsonl');
    const log = new ConnectionDiagnostics(store);
    log.record('server.started');
    expect(statSync(file).mode & 0o777).toBe(0o600);
    writeFileSync(file, 'x'.repeat(MAX_FILE_BYTES));
    log.record('repository.open.failed', { repo: '/example', error: 'bad map' });
    expect(statSync(file + '.1').size).toBe(MAX_FILE_BYTES);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({
      method: 'repository.open.failed',
      payload: { omitted: true },
    });
    for (let i = 0; i < 210; i++) log.record('binding.created', { bindingId: String(i) });
    expect(log.snapshot().events).toHaveLength(200);
    expect(readFileSync(file, 'utf8')).not.toContain('bad map');
    const unavailable = new ConnectionDiagnostics(
      new LogStore('repo-canvas', join(file, 'impossible')),
    );
    expect(() => unavailable.record('server.started')).not.toThrow();
    expect(unavailable.snapshot().fileError).toBeTruthy();
    expect(unavailable.snapshot().events).toHaveLength(1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
