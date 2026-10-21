import { expect, expectTypeOf, test } from 'vitest';
import {
  appRequestSchema,
  contracts,
  parseOutput,
  type Input,
  type Output,
  type Session,
} from './contracts.ts';
import { httpOperation } from './operations.ts';

test('an operation determines its input and result types', () => {
  expectTypeOf<Output<'state'>>().toEqualTypeOf<Session | { needsRepository: true }>();
  expectTypeOf<Input<'save'>>().toHaveProperty('revision').toBeString();
  expectTypeOf<Input<'source'>>().toEqualTypeOf<{ path: string }>();
  expectTypeOf<Output<'draft_read'>>().toBeNullable();
});

test('request schemas reject missing fields and removed connection operations', () => {
  for (const request of [
    { action: 'save', args: { revision: 'base' } },
    { action: 'source', args: {} },
    { action: 'connect', args: { panelId: 'invalid' } },
    { action: 'command_ack', args: { id: 'one', status: 'pending' } },
    { action: 'binding_create', args: {} },
  ])
    expect(appRequestSchema.safeParse(request).success).toBe(false);
  expect(appRequestSchema.parse({ action: 'state', args: {} })).toEqual({
    action: 'state',
    args: {},
  });
});

test('malformed tool output is rejected before UI state can consume it', () => {
  expect(() => parseOutput('state', { document: {}, token: 'mcp-app' })).toThrow();
  expect(() => parseOutput('connect', { target: null })).toThrow();
  expect(() => parseOutput('agent_read', { command: { status: 'new' }, proposal: null })).toThrow();
  expect(() => parseOutput('catalog', [{ path: '/tmp', available: 'yes' }])).toThrow();
  expect(contracts.draft_read.output.parse(null)).toBeNull();
});

test('HTTP method dispatch rejects unsupported draft mutations', () => {
  expect(httpOperation('GET', '/api/draft')).toBe('draft_read');
  expect(httpOperation('PUT', '/api/draft')).toBe('draft_write');
  expect(httpOperation('DELETE', '/api/draft')).toBeUndefined();
});
