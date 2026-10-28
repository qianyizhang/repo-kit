import { expect, expectTypeOf, test } from 'vitest';
import { z } from 'zod';
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
  type Request = z.output<typeof appRequestSchema>;
  expectTypeOf<Extract<Request, { action: 'source' }>>().toEqualTypeOf<{
    action: 'source';
    args: Input<'source'>;
  }>();
  expectTypeOf<Extract<Request, { action: 'connect' }>>().toEqualTypeOf<{
    action: 'connect';
    args: Input<'connect'>;
  }>();
});

test('every declared action is available through the app request boundary', () => {
  expect(appRequestSchema.options.map((schema) => schema.shape.action.value).sort()).toEqual(
    Object.keys(contracts).sort(),
  );
  expect(appRequestSchema.parse({ action: 'source', args: { path: 'src/index.ts' } })).toEqual({
    action: 'source',
    args: { path: 'src/index.ts' },
  });
  expect(
    appRequestSchema.parse({
      action: 'connect',
      args: { panelId: '11111111-1111-4111-8111-111111111111' },
    }).action,
  ).toBe('connect');
  expect(httpOperation('POST', '/api/connect')).toBeUndefined();
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
