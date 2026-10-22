import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { TraceLog, observedTransport } from '../src/trace.ts';

void test('trace bounds, immutable payloads, explicit redaction and truncation', () => {
  const log = new TraceLog('app');
  const value = { text: 'original', authorization: 'secret' };
  log.local('demo', value);
  value.text = 'changed';
  assert.match(log.events[0]!.payload, /original/);
  assert.doesNotMatch(log.events[0]!.payload, /secret/);
  assert.match(log.events[0]!.payload, /redacted/);
  log.local('large', 'x'.repeat(13000));
  assert.match(log.events[1]!.payload, /truncated/);
  for (let i = 0; i < 260; i++) log.local('bounded', {});
  assert.equal(log.events.length, 250);
  assert.equal(log.dropped, 12);
});
void test('correlation keeps opposite-direction IDs separate', () => {
  const log = new TraceLog('app');
  log.wire({ jsonrpc: '2.0', id: 1, method: 'outbound' }, false);
  log.wire({ jsonrpc: '2.0', id: 1, method: 'inbound' }, true);
  log.wire({ jsonrpc: '2.0', id: 1, result: {} }, true);
  log.wire({ jsonrpc: '2.0', id: 1, error: { code: -1, message: 'demo' } }, false);
  assert.equal(log.events[2]!.method, 'outbound');
  assert.equal(log.events[3]!.method, 'inbound');
  assert.equal(log.events[3]!.status, 'RPC error');
});
void test('transport forwards messages, errors and closure without swallowing failed sends', async () => {
  const log = new TraceLog('server');
  let received = false,
    closed = false,
    failed = false;
  const inner: Transport = {
    start: () => Promise.resolve(),
    send: () => Promise.reject(new Error('send failed')),
    close() {
      this.onclose?.();
      return Promise.resolve();
    },
  };
  const outer = observedTransport(inner, log);
  outer.onmessage = () => {
    received = true;
  };
  outer.onclose = () => {
    closed = true;
  };
  outer.onerror = () => {
    failed = true;
  };
  await outer.start();
  inner.onmessage?.({ jsonrpc: '2.0', method: 'notifications/initialized' });
  inner.onerror?.(new Error('bad input'));
  await assert.rejects(outer.send({ jsonrpc: '2.0', id: 1, result: {} }), /send failed/);
  await outer.close();
  assert.ok(received && closed && failed);
  assert.ok(log.events.some((e) => e.method === 'transport.send-failed'));
});
