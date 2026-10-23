import { createRoot } from 'react-dom/client';
import { parseReviewDocument } from './model/document.ts';
import type { RecordSource } from './model/data-source.ts';
import { ReviewProvider } from './app/context.tsx';
import { App } from './app/app.tsx';
let root: ReturnType<typeof createRoot> | undefined;
export function mount(input: unknown, source?: RecordSource) {
  const document = parseReviewDocument(input);
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
