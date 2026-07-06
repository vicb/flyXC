const nxEslintPlugin = require('@nx/eslint-plugin');
const eslintPluginRequireNodeImportPrefix = require('eslint-plugin-require-node-import-prefix');
const eslintPluginSimpleImportSort = require('eslint-plugin-simple-import-sort');
const eslintPluginImport = require('eslint-plugin-import');
const eslintPluginWc = require('eslint-plugin-wc');
const eslintPluginLit = require('eslint-plugin-lit');
const nxTypescript = require('@nx/eslint-plugin/typescript');

module.exports = [
  {
    plugins: {
      '@nx': nxEslintPlugin,
      'require-node-import-prefix': eslintPluginRequireNodeImportPrefix,
      'simple-import-sort': eslintPluginSimpleImportSort,
      import: eslintPluginImport,
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['@windy'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
      'require-node-import-prefix/no-empty-import-prefix': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      'no-extra-semi': 'error',
    },
  },
  ...nxTypescript.configs.typescript.map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.cts', '**/*.mts'],
    rules: {
      ...config.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-extra-semi': 'error',
    },
  })),
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.cts', '**/*.mts'],
    ...eslintPluginWc.configs['flat/recommended'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.cts', '**/*.mts'],
    ...eslintPluginLit.configs['flat/recommended'],
  },
  {
    ignores: [
      '**/.vite/',
      '**/.cache/',
      '**/node_modules/',
      '**/apps/fxc-tiles/src/assets/airspaces/',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      '**/dist/',
    ],
  },
];
