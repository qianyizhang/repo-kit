import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../app/app.tsx';
import { ReviewProvider } from '../app/context.tsx';
import type { ReviewDocument } from '../model/contracts.ts';
import { examples } from './examples.ts';
import '../styles.css';
import './styles.css';

async function start() {
  const id = new URLSearchParams(location.search).get('fixture');
  const example = examples.find((item) => item.id === id);
  let document: ReviewDocument | undefined;
  if (example) {
    const response = await fetch('/__review-fixture?id=' + example.id);
    if (!response.ok) throw new Error(await response.text());
    document = (await response.json()) as ReviewDocument;
    if (!location.hash) {
      const events = document.threads.flatMap((thread) =>
        thread.turns.flatMap((turn) => turn.events),
      );
      const anchor = events.find((event) =>
        example.call ? event.callId === example.call : event.kind === example.kind,
      );
      const hash = new URLSearchParams({
        view: 'events',
        kind: example.kind,
        ...(anchor ? { event: anchor.key } : {}),
      });
      history.replaceState(null, '', '#' + hash.toString());
    }
  }
  createRoot(window.document.getElementById('root')!).render(
    <StrictMode>
      <aside className="fixture-gallery" aria-label="Development examples">
        <div>
          <strong>Session review examples</strong>
          <span>Development only · synthetic source records</span>
        </div>
        <nav aria-label="Choose example">
          {examples.map((item) => (
            <a
              key={item.id}
              href={'?fixture=' + item.id}
              aria-current={item.id === id ? 'page' : undefined}
            >
              {item.title}
            </a>
          ))}
          <a href="/document.html">Load review JSON</a>
        </nav>
        {example ? (
          <p>
            <strong>Expected:</strong> {example.expected}
          </p>
        ) : (
          <p>
            Choose an example to inspect it with the production review renderer. These cases are
            shared with browser tests.
          </p>
        )}
      </aside>
      {document && (
        <ReviewProvider key={id} document={document}>
          <App />
        </ReviewProvider>
      )}
    </StrictMode>,
  );
}
void start().catch((error: unknown) => {
  document.getElementById('root')!.textContent =
    'Unable to open example: ' + (error instanceof Error ? error.message : String(error));
});
