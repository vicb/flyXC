const baseConfig = require('../../eslint.config.js');

module.exports = [
  ...baseConfig,
  {
    ignores: ['dist/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: false,
          optionalDependencies: false,
          peerDependencies: false,
        },
      ],
      'no-restricted-imports': ['error', '@windycom'],
    },
  },
  {
    files: ['**/{package,project}.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/vite.config.ts', 'vite.config.*'],
          ignoredDependencies: ['react-redux', 'preact'],
        },
      ],
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
  },
  {
    ignores: ['node_modules/', 'generate-manifest.js', 'vite.config.ts', 'types/'],
  },
];
