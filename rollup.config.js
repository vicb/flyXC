import cjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import minifyHTML from 'rollup-plugin-minify-html-literals';
import replace from 'rollup-plugin-replace';
import resolve from 'rollup-plugin-node-resolve';
import run from 'rollup-plugin-run';
import stripCode from 'rollup-plugin-strip-code';
import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';

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
      prod && terser(),
      !prod && run({ execArgv: ['--inspect'] }),
    ],
  },
  {
    input: 'run/src/index.ts',

    output: {
      dir: 'run/',
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
      prod && terser(),
      !prod && run({ env: { ...process.env, PORT: 8081 } }),
    ],
  },
  buildFrontEnd('frontend/src/viewer/flyxc.ts'),
  buildFrontEnd('frontend/src/archives/archives.ts'),
  buildFrontEnd('frontend/src/tracking/tracking.ts'),
  buildFrontEnd('frontend/src/status/status.ts'),
];

function buildFrontEnd(input) {
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
      prod && terser(),
    ],
  };
}
