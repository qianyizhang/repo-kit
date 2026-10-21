import { useState } from 'react';
import { parseDocument, type Architecture } from '../model/document';
import { typeChanges } from '../model/type-changes';

interface Props {
  current: Architecture;
  proposal: { id: string; baseDocument: Architecture; document: Architecture };
  explanation?: string;
  origin: 'agent' | 'discussion';
  apply: (document: Architecture) => void;
  dismiss: () => void;
}

/** Both proposal origins use the same comparison, consent, and draft-only Apply policy. */
export function ProposalReview({ current, proposal, explanation, origin, apply, dismiss }: Props) {
  const [accepted, setAccepted] = useState<string | null>(null);
  const identity = JSON.stringify([proposal.id, proposal.baseDocument, proposal.document]);
  let stale = true;
  let document: Architecture | null = null;
  let impacts: string[] = [];
  try {
    const basis = parseDocument(current);
    document = parseDocument(proposal.document);
    stale = JSON.stringify(basis) !== JSON.stringify(parseDocument(proposal.baseDocument));
    impacts = typeChanges(basis, document);
  } catch {
    stale = true;
    document = null;
    // Invalid proposals cannot reach Apply even if delivered outside the normal validated path.
  }
  const canApply = !stale && document !== null && (!impacts.length || accepted === identity);
  const contents = (
    <>
      {explanation && <p>{explanation}</p>}
      <details>
        <summary>Review proposed document</summary>
        <pre>{JSON.stringify(proposal.document, null, 2)}</pre>
      </details>
      {impacts.length > 0 && (
        <>
          <ul>
            {impacts.map((change, i) => (
              <li key={i}>{change}</li>
            ))}
          </ul>
          <label>
            <input
              type="checkbox"
              checked={accepted === identity}
              onChange={(e) => setAccepted(e.target.checked ? identity : null)}
            />
            Accept these type migrations
          </label>
        </>
      )}
      {stale && (
        <p>
          {document
            ? 'The draft changed. Ask for a fresh proposal.'
            : 'The proposal is invalid. Ask for a fresh proposal.'}
        </p>
      )}
      <button
        className={origin === 'agent' ? 'primary' : undefined}
        disabled={!canApply}
        onClick={() => {
          if (!canApply || !document) return;
          apply(document);
          dismiss();
        }}
      >
        Apply to draft
      </button>
      <button onClick={dismiss}>{origin === 'agent' ? 'Dismiss proposal' : 'Dismiss'}</button>
    </>
  );
  return (
    <section
      className={origin === 'agent' ? 'agent-proposal' : 'proposal'}
      aria-label={origin === 'agent' ? 'Agent map proposal' : 'Discussion map proposal'}
    >
      {origin === 'agent' ? (
        <details>
          <summary>Review proposed map · {proposal.document.modules.length} concepts</summary>
          {contents}
        </details>
      ) : (
        <>
          <b>Proposed map change</b>
          {contents}
        </>
      )}
    </section>
  );
}
