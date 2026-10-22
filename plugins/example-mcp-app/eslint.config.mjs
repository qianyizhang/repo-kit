import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
export default [
  {
    ignores: ['.cache/**', 'dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'],
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: globals.node },
    rules: js.configs.recommended.rules,
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({ ...config, files: ['**/*.ts'] })),
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
