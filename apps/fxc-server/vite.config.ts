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
    cacheDir: '../../node_modules/.vite/apps/fxc-server',

    plugins: [],

    // Configuration for Node.js application
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      reportCompressedSize: true,
      target: 'node22',
      minify: mode === 'production',
      sourcemap: mode === 'production',
      // Library mode for Node.js application
      lib: {
        entry: 'src/main.ts',
        fileName: 'index',
        formats: ['es'],
      },
      rollupOptions: {
        plugins: [nodeExternals()],
        external: (id) => {
          // Mark @google-cloud packages as external to avoid bundling them
          // This prevents issues with dynamic file loading (e.g., proto files)
          if (id.startsWith('@google-cloud/')) {
            return true;
          }
          return false;
        },
        output: {
          // Preserve module structure for Node.js
          preserveModules: false,
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
      noExternal: ['@flyxc/common', '@flyxc/common-node', 'vaadin-nodom'],
    },

    // Vitest configuration
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      coverage: {
        reportsDirectory: '../../coverage/apps/fxc-server',
        provider: 'v8',
      },
      passWithNoTests: true,
    },
  };
});
