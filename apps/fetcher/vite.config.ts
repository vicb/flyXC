import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from '@dotenvx/dotenvx';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Load secrets from secrets.env.local file
  const secretsPath = path.join(__dirname, '../../secrets.env.local');

  const secretsDefine: Record<string, string> = {};

  if (fs.existsSync(secretsPath)) {
    const envConfig = parse(fs.readFileSync(secretsPath, 'utf-8'));

    // Create define object for secrets injection
    for (const [key, value] of Object.entries(envConfig)) {
      secretsDefine[`SECRETS.${key}`] = JSON.stringify(value);
    }
  }

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
      rollupOptions: {
        external: (id) => {
          // Mark @google-cloud packages as external to avoid bundling them
          // This prevents issues with dynamic file loading (e.g., proto files)
          if (id.startsWith('@google-cloud/')) {
            return true;
          }
          return false;
        },
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
      noExternal: ['@flyxc/common', '@flyxc/common-node', 'node-os-utils'],
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
