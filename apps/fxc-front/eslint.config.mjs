import baseConfig from '../../eslint.config.js';
import * as jsoncParser from 'jsonc-eslint-parser';

export default [
  ...baseConfig,
  {
    ignores: ['dist/**', '**/.vite', '**/node_modules', '**/.cache'],
  },
  {
    files: ['**/{package,project}.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/vite.config.ts', 'vite.config.ts'],
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
