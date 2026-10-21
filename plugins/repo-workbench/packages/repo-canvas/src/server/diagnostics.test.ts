import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConnectionDiagnostics } from './diagnostics';

it('bounds connection history, rotates private logs and survives unavailable storage', () => {
  const root = mkdtempSync(join(tmpdir(), 'canvas-diagnostics-'));
  try {
    const file = join(root, 'connection.jsonl');
    const log = new ConnectionDiagnostics(file);
    log.record('server.started');
    expect(statSync(file).mode & 0o777).toBe(0o600);
    writeFileSync(file, 'x'.repeat(512 * 1024 + 1));
    log.record('repository.open.failed', { repo: '/example', error: 'bad map' });
    expect(statSync(file + '.1').size).toBe(512 * 1024 + 1);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({
      serverId: log.serverId,
      event: 'repository.open.failed',
    });
    for (let i = 0; i < 210; i++) log.record('binding.created', { bindingId: String(i) });
    expect(log.snapshot().events).toHaveLength(200);
    const unavailable = new ConnectionDiagnostics(join(file, 'impossible'));
    expect(() => unavailable.record('server.started')).not.toThrow();
    expect(unavailable.snapshot().fileError).toBeTruthy();
    expect(unavailable.snapshot().events).toHaveLength(1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
