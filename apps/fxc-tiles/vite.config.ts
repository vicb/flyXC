import fs from 'node:fs';
import path from 'node:path';

import { parse } from '@dotenvx/dotenvx';
import { nodeExternals } from 'rollup-plugin-node-externals';
import { defineConfig } from 'vitest/config';

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
    cacheDir: '../../node_modules/.vite/apps/fxc-tiles',

    plugins: [],

    // Configuration for Node.js application
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      reportCompressedSize: true,
      target: 'node22',
      minify: mode === 'production',
      sourcemap: mode === 'production',
      // Library mode for Node.js application with multiple entry points
      lib: {
        entry: {
          'airspaces/create-geojson': 'src/app/airspaces/create-geojson.ts',
          'airspaces/create-tiles': 'src/app/airspaces/create-tiles.ts',
          'airspaces/download-openaip': 'src/app/airspaces/download-openaip.ts',
          'airspaces/create-tiles-info': 'src/app/airspaces/create-tiles-info.ts',
          'airspaces/stats': 'src/app/airspaces/stats.ts',
          'airspaces/create-tiles-info-diff': 'src/app/airspaces/create-tiles-info-diff.ts',
          'airspaces/upload-tiles-diff': 'src/app/airspaces/upload-tiles-diff.ts',
        },
        formats: ['es'],
      },
      rollupOptions: {
        plugins: [nodeExternals()],
        output: {
          entryFileNames: '[name].js',
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
      noExternal: ['@flyxc/common'],
    },

    // Vitest configuration
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      coverage: {
        reportsDirectory: '../../coverage/apps/fxc-tiles',
        provider: 'v8',
      },
      passWithNoTests: true,
    },
  };
});
