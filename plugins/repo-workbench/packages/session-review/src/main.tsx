import { createRoot } from 'react-dom/client';
import type { ReviewDocument } from './model/contracts.ts';
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
        <input
          aria-label="Review JSON"
          type="file"
          accept="application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
              void file.text().then((text) => {
                const data = JSON.parse(text) as ReviewDocument;
                root.unmount();
                mount(data);
              });
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
void start().catch((error: unknown) => {
  document.getElementById('root')!.textContent =
    'Unable to open review: ' + (error instanceof Error ? error.message : String(error));
});
