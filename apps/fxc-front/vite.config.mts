import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { literalsHtmlCssMinifier } from '@literals/rollup-plugin-html-css-minifier';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type UserConfig } from 'vitest/config';
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
    cacheDir: 'node_modules/.vite/apps/fxc-front',

    server: {
      port: 8080,
      host: '0.0.0.0',
    },

    preview: {
      port: 8080,
      host: '0.0.0.0',
    },

    build: {
      outDir: 'apps/fxc-front/dist',
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

    define: {
      __BUILD_TIMESTAMP__: JSON.stringify(format(new TZDate(new Date(), 'Europe/Paris'), 'yyyyMMdd-HHmm')),
      __AIRSPACE_DATE__: JSON.stringify(getAirspaceDate()),
      'process.env.NODE_ENV': JSON.stringify(mode),
      // Vite does not define global.
      // Required for a dependency of igc-xc-score.
      // See https://stackoverflow.com/questions/72114775/vite-global-is-not-defined/73208485#73208485
      global: {},
    },

    // Vitest configuration
    test: {
      globals: true,
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      coverage: {
        reportsDirectory: '../../coverage/apps/fxc-front',
        provider: 'v8',
      },
      passWithNoTests: true,
    },
  }),
);

// Get the airspace update date from the commit.
function getAirspaceDate() {
  const tileInfo = join(__dirname, '/..', '/fxc-tiles/src/assets/tiles/tiles-info.json');

  if (existsSync(tileInfo)) {
    try {
      return String(execSync(`git log -1 --format="%ad" --date=format:"%Y-%m-%d" -- ${tileInfo}`)).trim();
    } catch {
      return '-';
    }
  }
  return '-';
}
