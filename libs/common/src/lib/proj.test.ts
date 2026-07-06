import { getPixelCoordinates } from './proj';

describe(`getPixelCoordinates`, () => {
  it('tile size 256px', () => {
    expect(getPixelCoordinates({ lat: 0, lon: 90 }, 1, 256)).toEqual({
      px: {
        x: 128,
        y: 0,
      },
      tile: {
        x: 1,
        y: 1,
      },
      world: {
        x: 384,
        y: 256,
      },
    });
  });

  it('tile size 512px', () => {
    expect(getPixelCoordinates({ lat: 0, lon: 90 }, 1, 512)).toEqual({
      px: {
        x: 256,
        y: 0,
      },
      tile: {
        x: 1,
        y: 1,
      },
      world: {
        x: 768,
        y: 512,
      },
    });
  });
});
