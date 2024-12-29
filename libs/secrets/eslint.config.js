const baseConfig = require('../../eslint.config.js');

module.exports = [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': 'error',
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
  },
  {
    ignores: ['node_modules/*'],
  },
];
