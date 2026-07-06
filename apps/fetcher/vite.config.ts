import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from '@dotenvx/dotenvx';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Load secrets from secrets.env and secrets.env.local files
  const secretsPath = path.join(__dirname, '../../secrets.env');
  const secretsLocalPath = path.join(__dirname, '../../secrets.env.local');

  const secretsDefine: Record<string, string> = {};

  /**
   * Loads secrets from the first existing file in the provided list.
   *
   * @param filePaths - The list of file paths to check in order.
   * @throws {Error} If none of the files exist.
   */
  const loadSecrets = (...filePaths: string[]) => {
    for (const filePath of filePaths) {
      if (fs.existsSync(filePath)) {
        const envConfig = parse(fs.readFileSync(filePath, 'utf-8'));
        for (const [key, value] of Object.entries(envConfig)) {
          secretsDefine[`SECRETS.${key}`] = JSON.stringify(value);
        }
        return;
      }
    }
    throw new Error(`No secrets file found in: ${filePaths.join(', ')}`);
  };

  loadSecrets(secretsLocalPath, secretsPath);

  return {
    root: __dirname,
    cacheDir: '../../node_modules/.vite/apps/fetcher',

    plugins: [],

    // Configuration for Node.js application
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      reportCompressedSize: true,
      target: 'node22',
      minify: mode === 'production',
      sourcemap: mode === 'production',
      ssr: true,
      rolldownOptions: {
        input: path.resolve(__dirname, 'src/fetcher.ts'),
        output: {
          // Preserve module structure for Node.js
          preserveModules: false,
          entryFileNames: 'index.js',
          format: 'es',
        },
      },
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },

    // Inject secrets as compile-time constants
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      ...secretsDefine,
    },

    // SSR mode for Node.js
    ssr: {
      external: ['@google-cloud/datastore', '@google-cloud/storage', '@google-cloud/pubsub', '@google-cloud/compute'],
    },

    // Vitest configuration
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      coverage: {
        reportsDirectory: '../../coverage/apps/fetcher',
        provider: 'v8',
      },
      passWithNoTests: true,
    },
  };
});
