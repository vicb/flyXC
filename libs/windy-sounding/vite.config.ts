/// <reference types='vitest' />
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import preact from '@preact/preset-vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import type { UserConfig } from 'vite';
import { defineConfig } from 'vite';

import { certificatePEM, keyPEM } from './https';

export default defineConfig(
  ({ mode }): UserConfig => ({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/libs/windy-sounding',

    plugins: [
      svelte(),
      nxViteTsPaths(),
      preact({
        prefreshEnabled: false,
        babel: {
          babelrc: true,
        },
      }),
    ],

    server: {
      port: 9999,
      host: '0.0.0.0',
      https: {
        key: keyPEM,
        cert: certificatePEM,
      },
      fs: {
        allow: ['../..'],
      },
    },

    preview: {
      port: 9999,
      host: '0.0.0.0',
      https: {
        key: keyPEM,
        cert: certificatePEM,
      },
    },

    // See: https://vitejs.dev/guide/build.html#library-mode
    build: {
      outDir: 'libs/windy-sounding/dist',
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
    },

    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      __BUILD_TIMESTAMP__: Date.now(),
      global: {},
    },

    test: {
      watch: false,
      globals: true,
      environment: 'node',
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      reporters: ['default'],
      coverage: {
        reportsDirectory: '../../coverage/libs/windy-sounding',
        provider: 'v8',
      },
    },
  }),
);
