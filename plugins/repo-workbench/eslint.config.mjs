import js from '@eslint/js';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
export default [
  { ignores: ['node_modules/**', 'dist/**', 'test-results/**', 'playwright-report/**'] },
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: globals.node },
    rules: js.configs.recommended.rules,
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': hooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error' },
  },
  {
    files: ['packages/session-review/src/model/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react/*',
                'react-dom',
                'react-dom/*',
                '**/app/**',
                '**/actions/**',
                '**/conversation/**',
                '**/records/**',
                '**/curation/**',
                '**/*.tsx',
              ],
              message: 'Presentation depends on the review model.',
            },
          ],
        },
      ],
    },
  },
];
