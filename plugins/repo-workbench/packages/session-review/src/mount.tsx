import { createRoot } from 'react-dom/client';
import type { ReviewDocument } from './model/contracts.ts';
import type { RecordSource } from './model/data-source.ts';
import { ReviewProvider } from './app/context.tsx';
import { App } from './app/app.tsx';
let root: ReturnType<typeof createRoot> | undefined;
export function mount(document: ReviewDocument, source?: RecordSource) {
  root ??= createRoot(window.document.getElementById('root')!);
  root.render(
    <ReviewProvider document={document} source={source}>
      <App />
    </ReviewProvider>,
  );
}

export function unmount() {
  root?.unmount();
  root = undefined;
}
