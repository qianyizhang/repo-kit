/** Shared gallery destinations. Expectations describe behavior, not implementation structure. */
export const examples = [
  {
    id: 'parallel',
    title: 'Parallel calls',
    kind: 'command',
    call: 'parallel',
    expected:
      'One batch shows 4 parallel tool calls: 3 shell executions and 1 MCP read. The thread result reads as a conversation; private content stays excluded.',
  },
  {
    id: 'interleaved',
    title: 'Interleaved edit',
    kind: 'edit',
    call: 'patch',
    expected:
      'The edit and its result stay together even though commentary intervenes. Source sequence keeps the intervening records inspectable.',
  },
  {
    id: 'questions',
    title: 'Questions and replies',
    kind: 'ask',
    call: 'ask',
    expected:
      'Delivery acknowledgement is not a user answer. One question has no linked reply; the other records the selection Narrow.',
  },
  {
    id: 'compaction',
    title: 'Compaction',
    kind: 'compaction',
    call: '',
    expected:
      'A visible compaction action reports window 2 and 2.0 seconds, without exposing compacted private content.',
  },
  {
    id: 'ambiguity',
    title: 'Ambiguous relationship',
    kind: 'command',
    call: '',
    expected:
      'Two identical overlapping calls must not absorb the native result. Three separate command actions remain; no relationship is invented.',
  },
] as const;
