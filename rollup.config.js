import alias from '@rollup/plugin-alias';
import cjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import minifyHTML from 'rollup-plugin-minify-html-literals';
import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import run from '@rollup/plugin-run';
import stripCode from 'rollup-plugin-strip-code';
import { terser } from 'rollup-plugin-terser';
import typescript from '@rollup/plugin-typescript';
import builtins from 'builtin-modules';
import url from '@rollup/plugin-url';
import visualizer from 'rollup-plugin-visualizer';
import postcss from 'rollup-plugin-postcss';
import cssnano from 'cssnano';

const prod = !process.env.ROLLUP_WATCH;
const build =
  String(new Date().getFullYear()) +
  String(new Date().getMonth() + 1).padStart(2, '0') +
  String(new Date().getDate()).padStart(2, '0');
const nodeEnv = JSON.stringify(prod ? 'production' : 'development');

export default [
  {
    input: 'app/src/server.ts',

    output: {
      dir: 'app/',
      format: 'cjs',
    },

    plugins: [
      replace({
        values: {
          'process.env.NODE_ENV': nodeEnv,
          'process.env.USE_CACHE': process.env.USE_CACHE,
          '<%BUILD%>': build,
        },
      }),
      json(),
      resolve({
        preferBuiltins: true,
      }),
      cjs(),
      typescript(),
      prod && terser({ output: { comments: false } }),
      !prod && run({ execArgv: ['--inspect'] }),
    ],
    external: builtins,
  },
  {
    input: 'run/src/server.ts',

    output: {
      file: 'run/index.js',
      format: 'cjs',
    },

    plugins: [
      replace({
        values: {
          'process.env.NODE_ENV': nodeEnv,
          '<%BUILD%>': build,
        },
      }),
      json(),
      resolve({
        preferBuiltins: true,
      }),
      cjs(),
      typescript(),
      prod && terser({ output: { comments: false } }),
      !prod && run({ env: { ...process.env, PORT: 8084 } }),
    ],
    external: builtins,
  },
  buildFrontEnd('frontend/src/viewer/flyxc.ts', { importUi5: true, visualizer: true }),
  buildFrontEnd('frontend/src/viewer/workers/track.ts', { isWorker: true }),
  buildFrontEnd('frontend/src/archives/archives.ts'),
  buildFrontEnd('frontend/src/tracking/devices.ts'),
  buildFrontEnd('frontend/src/status/status.ts'),
];

function buildFrontEnd(input, options = {}) {
  const m = input.match(/\/(\w+)\.ts$/);
  if (m == null) {
    throw Error('Can not find project name');
  }
  const outDir = options.isWorker ? 'frontend/static/js/workers/' : 'frontend/static/js/';

  return {
    input,

    output: {
      dir: outDir,
      format: 'esm',
    },

    plugins: [
      replace({
        values: {
          'process.env.NODE_ENV': nodeEnv,
          '<%BUILD%>': build,
        },
        delimiters: ['', ''],
      }),
      prod &&
        stripCode({
          start_comment: 'strip-from-prod',
          end_comment: 'end-strip-from-prod',
        }),
      postcss({
        plugins: [cssnano()],
      }),
      minifyHTML(),
      alias({
        entries: [
          {
            find: 'lit-html/lib/shady-render.js',
            replacement: 'frontend/node_modules/lit-html/lit-html.js',
          },
        ],
      }),
      resolve(),
      cjs(),
      typescript({
        lib: options.isWorker ? ['webworker'] : ['es6', 'dom'],
      }),
      options.importUi5 &&
        url({
          limit: 0,
          include: [/.*assets\/.*\.json/],
          emitFiles: true,
          fileName: '[name].[hash][extname]',
          destDir: 'frontend/static/ui5',
        }),
      prod && terser({ output: { comments: false } }),
      process.env.ROLLUP_VISU && options.visualizer && visualizer(),
    ],
  };
}
