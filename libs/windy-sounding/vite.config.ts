/// <reference types='vitest' />
import preact from '@preact/preset-vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import type { UserConfig } from 'vite';
import { defineConfig } from 'vite';

import { certificatePEM, keyPEM } from './https';

export default defineConfig(
  ({ mode }): UserConfig => {
    const isConfigBuild = process.env.BUILD_PLUGIN_CONFIG === 'true';

    return {
      root: __dirname,
      cacheDir: './node_modules/.vite',

      plugins: isConfigBuild
        ? []
        : [
            svelte(),
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
      },

      preview: {
        port: 9999,
        host: '0.0.0.0',
        https: {
          key: keyPEM,
          cert: certificatePEM,
        },
        open: false,
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
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
          },
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
          reportsDirectory: './coverage',
          provider: 'v8',
        },
      },
    };
  },
);
