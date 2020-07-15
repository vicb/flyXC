import cjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import minifyHTML from 'rollup-plugin-minify-html-literals';
import replace from 'rollup-plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import run from '@rollup/plugin-run';
import stripCode from 'rollup-plugin-strip-code';
import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';
import builtins from 'builtin-modules';
import url from '@rollup/plugin-url';

const prod = !process.env.ROLLUP_WATCH;

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
          'process.env.NODE_ENV': JSON.stringify(prod ? 'production' : 'development'),
          'process.env.USE_CACHE': process.env.USE_CACHE,
          '<%BUILD%>': `${new Date().getFullYear()}${new Date().getMonth() + 1}${new Date().getDate()}`,
        },
      }),
      json(),
      resolve({
        preferBuiltins: true,
      }),
      cjs(),
      typescript({
        tsconfigDefaults: {},
      }),
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
          'process.env.NODE_ENV': JSON.stringify(prod ? 'production' : 'development'),
          '<%BUILD%>': `${new Date().getFullYear()}${new Date().getMonth() + 1}${new Date().getDate()}`,
        },
      }),
      json(),
      resolve({
        preferBuiltins: true,
      }),
      cjs(),
      typescript({}),
      prod && terser({ output: { comments: false } }),
      !prod && run({ env: { ...process.env, PORT: 8084 } }),
    ],
    external: builtins,
  },
  buildFrontEnd('frontend/src/viewer/flyxc.ts', { importUi5: true }),
  buildFrontEnd('frontend/src/archives/archives.ts'),
  buildFrontEnd('frontend/src/tracking/tracking.ts'),
  buildFrontEnd('frontend/src/status/status.ts'),
];

function buildFrontEnd(input, options = {}) {
  return {
    input,

    output: {
      dir: 'frontend/static/js/',
      format: 'esm',
    },

    plugins: [
      replace({
        values: {
          'process.env.NODE_ENV': JSON.stringify(prod ? 'production' : 'development'),
          '<%BUILD%>': `${new Date().getFullYear()}${new Date().getMonth() + 1}${new Date().getDate()}`,
        },
        delimiters: ['', ''],
      }),
      prod &&
        stripCode({
          start_comment: 'strip-from-prod',
          end_comment: 'end-strip-from-prod',
        }),
      minifyHTML(),
      resolve(),
      cjs(),
      typescript(),
      options.importUi5 &&
        url({
          limit: 0,
          include: [/.*assets\/.*\.json/],
          emitFiles: true,
          fileName: '[name].[hash][extname]',
          destDir: 'frontend/static/ui5',
        }),
      prod && terser({ output: { comments: false } }),
    ],
  };
}
