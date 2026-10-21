import { parseChat } from '../model/document.ts';
import { contracts } from '../model/contracts.ts';
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
  args = contracts[action].input.parse(args);
  switch (action) {
    case 'view_write':
      return bridge.session.observe(args.view);
    case 'agent_read':
      return bridge.session.inbox();
    case 'command_ack':
      return bridge.session.acknowledge(args.id, args.status, args.message);
    case 'proposal_dismiss':
      return bridge.session.dismiss(args.id);
    case 'state':
      return repository.snapshot();
    case 'source':
      return repository.source(args.path);
    case 'source_save':
      return repository.saveSource(
        String(args.reference),
        String(args.revision),
        String(args.content),
        args.document,
      );
    case 'discussion_read':
      return bridge.discussion.read();
    case 'discussion_write':
      return bridge.discussion.write(Number(args.revision), String(args.composer), args.comments);
    case 'discussion_clear':
      return bridge.discussion.clear(Number(args.revision));
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
