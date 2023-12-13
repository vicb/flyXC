import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { format } from 'date-fns';
import { existsSync } from 'fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import minifyHTML from 'rollup-plugin-minify-html-literals';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import { checker } from 'vite-plugin-checker';

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

export default defineConfig({
  root: __dirname,
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

    chunkSizeWarningLimit: 3800,
  },

  plugins: [
    minifyHTML(),
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
        chunkFileNames: 'static/js/[name]-[hash].js',
        entryFileNames: 'static/js/[name]-[hash].js',
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
    __BUILD_TIMESTAMP__: JSON.stringify(format(new Date(), 'yyyyMMdd.HHmm')),
    __AIRSPACE_DATE__: JSON.stringify(getAirspaceDate()),
  },
});

// Get the airspace update date from the commit.
function getAirspaceDate() {
  const tileInfo = join(__dirname, '/..', '/airspaces/src/assets/airspaces/tiles-info.json');

  if (existsSync(tileInfo)) {
    try {
      return String(execSync(`git log -1 --format="%cd" --date=format:"%Y-%m-%d" -- ${tileInfo}`)).trim();
    } catch (e) {
      return '-';
    }
  }
  return '-';
}
