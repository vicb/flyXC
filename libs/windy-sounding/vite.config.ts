/// <reference types='vitest' />
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { certificatePEM, keyPEM } from '@windycom/plugin-devtools';
import type { UserConfig } from 'vite';
import { defineConfig } from 'vite';

export default defineConfig(
  ({ mode }): UserConfig => ({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/libs/windy-sounding',

    plugins: [svelte(), nxViteTsPaths()],

    server: {
      port: 9999,
      host: '0.0.0.0',
      https: {
        key: keyPEM,
        cert: certificatePEM,
      },
      fs: {
        allow: ['..'],
      },
    },

    // See: https://vitejs.dev/guide/build.html#library-mode
    build: {
      outDir: '../../dist/libs/windy-sounding',
      emptyOutDir: false,
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      minify: mode === 'production',
      sourcemap: true,
      lib: {
        entry: 'src/plugin.ts',
        name: 'windy-sounding',
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
      passWithNoTests: true,
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
