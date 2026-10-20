import type { CaseSpec } from './contracts.ts';
/** Synthetic public fixture: browser coverage must not depend on private history. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export async function writeFixture(root: string) {
  const input = resolve(root, 'input'),
    output = resolve(root, 'output');
  await mkdir(input, { recursive: true });
  const page = (id: string, items: unknown[]) => ({
    schemaVersion: 1,
    thread: { id, title: id },
    turns: [{ id: 'turn', ...(id === 'parent' ? { startedAt: 1 } : {}), items }],
  });
  await writeFile(
    resolve(input, 'parent.json'),
    JSON.stringify(
      page('parent', [
        {
          id: 'request',
          type: 'userMessage',
          content: [{ type: 'text', text: 'Revise the wing.' }],
        },
        { id: 'inspect', type: 'imageView', path: 'bird-hero.png' },
        { id: 'review', type: 'agentMessage', text: 'Wing attachment still needs revision.' },
        {
          id: 'dispatch',
          type: 'collabAgentToolCall',
          tool: 'delegate',
          receiverThreadIds: ['worker', 'uncollected-worker'],
          prompt: 'Revise construction.',
        },
        { id: 'unknown', type: 'futureEvent', payload: 'Do not expose this' },
        { id: 'private', type: 'reasoning', text: 'Do not expose this' },
      ]),
    ),
  );
  await writeFile(
    resolve(input, 'worker.json'),
    JSON.stringify(
      page('worker', [
        {
          id: 'edit',
          type: 'fileChange',
          changes: [{ path: 'src/bird.ts', diff: { text: '+ revised', truncated: true } }],
        },
        {
          id: 'check',
          type: 'commandExecution',
          command: 'npm test',
          output: { text: 'Complete available output.\n' + 'x'.repeat(17000) },
          exitCode: 0,
        },
      ]),
    ),
  );
  const ref = (thread: string, event: string, role: string) => ({
    thread,
    turn: 'turn',
    event,
    role,
  });
  const spec: CaseSpec = {
    title: 'Synthetic behavior case',
    assetRoot: 'test-results',
    captureSubjects: ['bird', 'hydra'],
    captureViews: { hero: ['{subject}-hero.png', '{subject}-frame.png', '{subject}-desktop.png'] },
    threads: [
      { id: 'parent', role: 'Parent' },
      { id: 'worker', role: 'Worker', parent: 'parent' },
    ],
    stages: [
      {
        id: 'revision',
        title: 'Wing review',
        thread: 'parent',
        turn: 'turn',
        anchor: 'Wing attachment',
        status: 'Revision needed',
        question: 'Repair the wing',
        change: 'Worker revised the attachment',
        finding: 'Reviewer requests another pass',
        lesson: 'Tests and acceptance differ.',
        subject: 'bird',
        evidence: [
          ref('parent', 'request', 'request'),
          ref('worker', 'edit', 'edit'),
          ref('worker', 'check', 'verification'),
          ref('parent', 'inspect', 'inspection'),
          ref('parent', 'review', 'assessment'),
          ref('parent', 'dispatch', 'handoff'),
        ],
        actors: [
          { threadId: 'worker', role: 'delegated_worker', contribution: 'construction' },
          { threadId: 'parent', role: 'reviewer', contribution: 'review and takeover' },
        ],
        assessments: [
          {
            criterion: 'wing connection',
            subject: 'bird',
            assessment: 'issue',
            actor: 'Parent',
            basis: 'reviewer',
            evidence: [ref('parent', 'review', 'assessment')],
            note: 'Source pairing unknown.',
          },
          {
            criterion: 'user approval',
            subject: 'bird',
            assessment: 'unrecorded',
            actor: 'Case curator',
            basis: 'record_limit',
            evidence: [],
            note: 'No later user response included.',
          },
        ],
      },
    ],
  };
  return { root, input, output, spec };
}
