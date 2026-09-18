import preact from '@preact/preset-vite';
import type { UserConfig } from 'vite';
import { defineConfig } from 'vite';

import { certificatePEM, keyPEM } from './https.ts';
import { generateWindyExports } from './tools/generate-windy-exports.js';
import { WINDY_ORIGINS, windyDevPlugin } from './tools/vite-plugin-windy-dev.ts';

// Generate src/windy-exports.d.ts from types/client/commonExports.d.ts so W is
// strongly typed without manually modifying any files in the types/ directory.
generateWindyExports();

const PORT = 9999;

export default defineConfig(({ mode }): UserConfig => {
  const isConfigBuild = process.env.BUILD_PLUGIN_CONFIG === 'true';

  return {
    root: import.meta.dirname,

    cacheDir: './node_modules/.vite',

    plugins: isConfigBuild ? [] : [preact(), windyDevPlugin({ port: PORT })],

    server: {
      port: PORT,
      strictPort: true,
      host: 'localhost',
      https: {
        key: keyPEM,
        cert: certificatePEM,
      },
      cors: {
        origin: [...WINDY_ORIGINS],
      },
      hmr: {
        host: 'localhost',
        protocol: 'wss',
        clientPort: PORT,
      },
    },

    preview: {
      port: PORT,
      host: 'localhost',
      https: {
        key: keyPEM,
        cert: certificatePEM,
      },
      open: false,
      cors: {
        origin: [...WINDY_ORIGINS],
      },
    },

    // See: https://vitejs.dev/guide/build.html#library-mode
    build: {
      outDir: './dist',
      emptyOutDir: false,
      reportCompressedSize: true,
      target: 'esnext',
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      cssMinify: mode === 'production',
      minify: mode === 'production',
      sourcemap: process.env.BUILD_PLUGIN_CONFIG !== 'true',
      lib:
        process.env.BUILD_PLUGIN_CONFIG === 'true'
          ? {
              entry: 'src/config.ts',
              fileName: 'config',
              formats: ['es'],
            }
          : {
              entry: 'src/plugin.ts',
              fileName: mode === 'production' ? 'plugin.min' : 'plugin',
              formats: ['es'],
            },
      rolldownOptions: {
        output: {
          // We need to duplicate the minify setting here
          minify: mode === 'production',
          inlineDynamicImports: true,
        },
      },
    },

    define: {
      // Library mode (build.lib) does not replace process.env.NODE_ENV by default.
      // Explicitly define it so bundled dependencies like Redux Toolkit initialize safely in browser environments.
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV ?? (mode === 'production' ? 'production' : 'development'),
      ),
      __BUILD_TIMESTAMP__: JSON.stringify(Date.now()),
      global: 'window',
    },

    test: {
      watch: false,
      globals: true,
      environment: 'node',
      setupFiles: ['./src/test-setup.ts'],
      include: [
        'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        'tools/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      ],
      reporters: ['default'],
      coverage: {
        reportsDirectory: './coverage',
        provider: 'v8',
      },
    },
  };
});
