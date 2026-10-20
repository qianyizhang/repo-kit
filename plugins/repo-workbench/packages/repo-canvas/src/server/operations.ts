import { parseChat } from '../model/document.ts';
import type { Operation } from '../model/operations.ts';
import type { CanvasBridge } from './bridge.ts';
import type { Repository } from './repository.ts';

/** Own operation semantics; transports retain authentication and response envelopes. */
export function operate(
  action: Operation,
  args: Record<string, unknown>,
  repository: Repository,
  bridge: CanvasBridge,
) {
  switch (action) {
    case 'state':
      return repository.snapshot();
    case 'source':
      return repository.source(args.path);
    case 'save':
      return repository.save(args.document, String(args.revision));
    case 'send':
      return bridge.enqueue(args.canvasId, parseChat(args));
    case 'chat':
      return bridge.current(args.canvasId);
    case 'cancel':
      return bridge.cancel(args.canvasId, args.id);
    case 'draft_read':
      return bridge.draft();
    case 'draft_write':
      return bridge.storeDraft(args.draft);
  }
}
