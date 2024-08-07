import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { literalsHtmlCssMinifier } from '@literals/rollup-plugin-html-css-minifier';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { formatInTimeZone } from 'date-fns-tz';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type UserConfig } from 'vite';
import { checker } from 'vite-plugin-checker';
import { VitePWA } from 'vite-plugin-pwa';

import { getPwaConfig } from './pwa.config';

const assetFileNames = (assetInfo: any) => {
  if (!assetInfo.name) {
    return '-';
  }
  const info = assetInfo.name.split('.');
  let extType = info[info.length - 1];
  if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
    extType = 'img';
  } else if (/woff|woff2/i.test(extType)) {
    extType = 'css';
  }
  return `static/${extType}/[name]-[hash][extname]`;
};

export default defineConfig(
  ({ mode }): UserConfig => ({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/apps/fxc-front',

    server: {
      port: 8080,
      host: '0.0.0.0',
    },

    preview: {
      port: 8080,
      host: '0.0.0.0',
    },

    build: {
      outDir: '../../dist/apps/fxc-front',
      reportCompressedSize: true,
      commonjsOptions: { transformMixedEsModules: true },
      emptyOutDir: true,
      rollupOptions: {
        output: {
          assetFileNames,
          chunkFileNames: 'static/js/[name]-[hash].js',
          entryFileNames: 'static/js/[name]-[hash].js',
        },
      },

      chunkSizeWarningLimit: 3900,
    },

    plugins: [
      VitePWA(getPwaConfig(mode)),
      literalsHtmlCssMinifier(),
      {
        ...visualizer(),
        apply: 'build',
      },
      checker({
        typescript: {
          root: process.cwd(),
          tsconfigPath: 'apps/fxc-front/tsconfig.app.json',
        },
      }),
      nxViteTsPaths(),
    ],

    worker: {
      plugins: () => [nxViteTsPaths()],
      rollupOptions: {
        output: {
          assetFileNames,
          chunkFileNames: 'static/js/worker/[name]-[hash].js',
          entryFileNames: 'static/js/worker/[name]-[hash].js',
        },
      },
    },

    test: {
      reporters: ['default'],
      coverage: {
        reportsDirectory: '../../coverage/apps/fxc-front',
        provider: 'v8',
      },
      globals: true,
      cache: {
        dir: '../../node_modules/.vitest',
      },
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    },

    define: {
      __BUILD_TIMESTAMP__: JSON.stringify(formatInTimeZone(new Date(), 'Europe/Paris', 'yyyyMMdd-HHmm')),
      __AIRSPACE_DATE__: JSON.stringify(getAirspaceDate()),
      'process.env.NODE_ENV': JSON.stringify(mode),
      // Vite does not define global.
      // Required for a dependency of igc-xc-score.
      // See https://stackoverflow.com/questions/72114775/vite-global-is-not-defined/73208485#73208485
      global: {},
    },
  }),
);

// Get the airspace update date from the commit.
function getAirspaceDate() {
  const tileInfo = join(__dirname, '/..', '/airspaces/src/assets/airspaces/tiles-info.json');

  if (existsSync(tileInfo)) {
    try {
      return String(execSync(`git log -1 --format="%ad" --date=format:"%Y-%m-%d" -- ${tileInfo}`)).trim();
    } catch (e) {
      return '-';
    }
  }
  return '-';
}
