const baseConfig = require('../../eslint.config.js');

module.exports = [
  ...baseConfig,
  {
    ignores: ['dist/**'],
  },
  {
    files: ['**/{package,project}.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/vite.config.ts', 'vite.config.ts'],
          ignoredDependencies: [
            'igc-parser',
            '@nx/webpack', // should not be added to dependencies
            'webpack', // should not be added to dependencies
          ],
          checkMissingDependencies: true,
          checkObsoleteDependencies: true,
          checkVersionMismatches: true,
        },
      ],
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
  },
];
