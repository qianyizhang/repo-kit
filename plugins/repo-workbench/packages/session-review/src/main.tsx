import { createRoot } from 'react-dom/client';
import { parseReviewDocument } from './model/document.ts';
import { mount } from './mount.tsx';
let root: ReturnType<typeof createRoot>;
import './styles.css';
async function start() {
  const element = document.getElementById('trace-data');
  if (!element) {
    root = createRoot(document.getElementById('root')!);
    root.render(
      <main>
        <h1>Session review</h1>
        <p>Open a generated trace bundle or load a review document to develop this frontend.</p>
        <p id="load-error" role="alert" />
        <input
          aria-label="Review JSON"
          type="file"
          accept="application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
              void file
                .text()
                .then((text) => {
                  const data = parseReviewDocument(JSON.parse(text));
                  root.unmount();
                  mount(data);
                })
                .catch((error: unknown) => {
                  const status = document.getElementById('load-error');
                  if (status) status.textContent = String(error);
                });
          }}
        />
      </main>,
    );
    return;
  }
  const bytes = Uint8Array.from(atob(element.textContent ?? ''), (c) => c.charCodeAt(0));
  const data = parseReviewDocument(
    JSON.parse(
      await new Response(
        new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),
      ).text(),
    ),
  );
  element.remove();
  mount(data);
}
void start().catch((error: unknown) => {
  document.getElementById('root')!.textContent =
    'Unable to open review: ' + (error instanceof Error ? error.message : String(error));
});
