import baseConfig from '../../eslint.config.js';
import * as jsoncParser from 'jsonc-eslint-parser';

export default [
  ...baseConfig,
  {
    ignores: ['dist/**', '**/.vite', '**/node_modules', '**/.cache', 'rustigc/**', '**/rustigc/**'],
  },
  {
    files: ['**/{package,project}.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [],
          ignoredDependencies: [
            '@date-fns/tz',
            '@nx/vite',
            'd3-array',
            'date-fns',
            'vite-plugin-checker',
            'vite',
            'vitest',
            `@stencil/core`,
            `workbox-window`,
            'jsonc-eslint-parser',
          ],
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
