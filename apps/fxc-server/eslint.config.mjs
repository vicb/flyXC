import baseConfig from '../../eslint.config.js';
import jsoncParser from 'jsonc-eslint-parser';

export default [
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
          ignoredDependencies: ['@dotenvx/dotenvx', '@google-cloud/pubsub', 'igc-parser', 'jsonc-eslint-parser'],
          checkMissingDependencies: true,
          checkObsoleteDependencies: true,
          checkVersionMismatches: true,
        },
      ],
    },
    languageOptions: {
      parser: jsoncParser,
    },
  },
];
