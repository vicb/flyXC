import { EARTH_RADIUS_M, getPixelCoordinates, lonLatToWebMercator } from './proj';

describe('lonLatToWebMercator', () => {
  it('projects origin and 180deg longitude', () => {
    expect(lonLatToWebMercator(0, 0)).toEqual([0, 0]);
    const [x, y] = lonLatToWebMercator(180, 0);
    expect(x).toBeCloseTo(Math.PI * EARTH_RADIUS_M, 4);
    expect(y).toBe(0);
  });
});

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

  it('non-zero latitude at zoom 10', () => {
    const res = getPixelCoordinates({ lat: 45, lon: 6 }, 10, 256);
    expect(res.tile).toEqual({ x: 529, y: 368 });
    expect(res.world.x).toBe(res.tile.x * 256 + res.px.x);
    expect(res.world.y).toBe(res.tile.y * 256 + res.px.y);
    expect(res.px.x).toBeGreaterThanOrEqual(0);
    expect(res.px.x).toBeLessThan(256);
    expect(res.px.y).toBeGreaterThanOrEqual(0);
    expect(res.px.y).toBeLessThan(256);
  });
});
