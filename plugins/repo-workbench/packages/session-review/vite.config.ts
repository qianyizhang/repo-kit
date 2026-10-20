import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { fixtureServer } from './dev-server.ts';
export default defineConfig(({ command }) => ({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [fixtureServer()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(command === 'serve' ? 'development' : 'production'),
  },
  build: {
    target: 'es2023',
    lib: {
      entry: fileURLToPath(new URL('src/main.tsx', import.meta.url)),
      formats: ['es'],
      fileName: 'review',
    },
    cssCodeSplit: false,
    rolldownOptions: { output: { codeSplitting: false } },
  },
}));
