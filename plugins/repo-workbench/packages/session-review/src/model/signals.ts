import type { TraceAction } from './actions.ts';
export const signalLabels = {
  steering: 'Mid-turn input',
  compaction: 'Compaction',
  question: 'User questions',
  rejected: 'Rejected',
  failed: 'Errors',
  'missing-result': 'No recorded result',
  'missing-call': 'Unmatched result',
  truncated: 'Truncated source',
};
export type ReviewSignal = keyof typeof signalLabels;
export function actionSignals(action: TraceAction): ReviewSignal[] {
  const flags = new Set<ReviewSignal>();
  if (action.anchor.kind === 'compaction') flags.add('compaction');
  if (action.anchor.kind === 'ask') flags.add('question');
  for (const event of action.records) {
    const result = /\/(function_call_output|custom_tool_call_output)$/.test(event.sourceType ?? '');
    const output = event.output ?? '';
    if (event.sourceTruncated) flags.add('truncated');
    if (
      (event.exitCode != null && event.exitCode !== 0) ||
      /^(failed|error|errored)$/i.test(event.status) ||
      (result && /^Script failed\r?\n/.test(output))
    )
      flags.add('failed');
    // Match the tool failure envelope, never mentions of errors/rejections inside prose or source code.
    if (
      /^(rejected|denied)$/i.test(event.status) ||
      (result &&
        /^Script failed\r?\n/.test(output) &&
        /(?:CreateProcess|exec_command failed)[\s\S]*?Rejected\(/.test(output))
    )
      flags.add('rejected');
    if (
      result &&
      !action.records.some(
        (r) =>
          r.callId === event.callId &&
          /\/(function_call|custom_tool_call)$/.test(r.sourceType ?? ''),
      )
    )
      flags.add('missing-call');
  }
  if (
    action.anchor.callId &&
    /\/(function_call|custom_tool_call)$/.test(action.anchor.sourceType ?? '') &&
    !action.results.length &&
    !action.executions.length
  )
    flags.add('missing-result');
  if (flags.has('rejected')) flags.delete('failed');
  return [...flags];
}
