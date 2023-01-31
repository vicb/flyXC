import { format } from 'date-fns';
import minifyHTML from 'rollup-plugin-minify-html-literals';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import { checker } from 'vite-plugin-checker';
import viteTsConfigPaths from 'vite-tsconfig-paths';

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
  server: {
    port: 8080,
    host: '0.0.0.0',
  },

  preview: {
    port: 8080,
    host: '0.0.0.0',
  },

  build: {
    rollupOptions: {
      output: {
        assetFileNames,
        chunkFileNames: 'static/js/[name]-[hash].js',
        entryFileNames: 'static/js/[name]-[hash].js',
      },
    },
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
    viteTsConfigPaths({
      root: '../../',
    }),
  ],

  worker: {
    plugins: [
      viteTsConfigPaths({
        root: '../../',
      }),
    ],
    rollupOptions: {
      output: {
        assetFileNames,
        chunkFileNames: 'static/js/[name]-[hash].js',
        entryFileNames: 'static/js/[name]-[hash].js',
      },
    },
  },

  test: {
    globals: true,
    cache: {
      dir: '../../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },

  define: {
    __BUILD_TIMESTAMP__: format(new Date(), 'yyyyMMdd.HHmm'),
  },
});
