import { readFileSync } from 'node:fs';
import path from 'node:path';

import { decode } from '@vivaxy/png';
import { benchmarkSuite } from 'jest-bench';
import lodepng from 'lodepng';
import { PNG } from 'pngjs';

const png = readFileSync(path.join(__dirname, 'fixtures', 'x529y267z10.png'));

benchmarkSuite('sample', {
  ['@vivaxy/png']: () => {
    const img = decode(png);
    expect(img.width).toEqual(256);
    expect(img.height).toEqual(256);
  },

  ['pngjs']: () => {
    const img = PNG.sync.read(png);
    expect(img.width).toEqual(256);
    expect(img.height).toEqual(256);
  },

  ['lodepng']: (defer) => {
    lodepng.decode(png).then((img) => {
      expect(img.height).toEqual(256);
      expect(img.width).toEqual(256);
      defer.resolve();
    });
  },
});
