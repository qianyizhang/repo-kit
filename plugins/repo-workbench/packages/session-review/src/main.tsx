import { createRoot } from 'react-dom/client';
import type { ReviewDocument } from './model/contracts.ts';
import { ReviewProvider } from './app/context.tsx';
import { App } from './app/app.tsx';
import './styles.css';
async function start() {
  const element = document.getElementById('trace-data');
  if (!element) {
    root = createRoot(document.getElementById('root')!);
    root.render(
      <main>
        <h1>Session review</h1>
        <p>Open a generated trace bundle or load a review document to develop this frontend.</p>
        <input
          aria-label="Review JSON"
          type="file"
          accept="application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void file.text().then((text) => mount(JSON.parse(text) as ReviewDocument));
          }}
        />
      </main>,
    );
    return;
  }
  const bytes = Uint8Array.from(atob(element.textContent ?? ''), (c) => c.charCodeAt(0));
  const data = JSON.parse(
    await new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),
    ).text(),
  ) as ReviewDocument;
  element.remove();
  mount(data);
}
let root: ReturnType<typeof createRoot> | undefined;
function mount(document: ReviewDocument) {
  root ??= createRoot(window.document.getElementById('root')!);
  root.render(
    <ReviewProvider document={document}>
      <App />
    </ReviewProvider>,
  );
}
void start().catch((error: unknown) => {
  document.getElementById('root')!.textContent =
    'Unable to open review: ' + (error instanceof Error ? error.message : String(error));
});
