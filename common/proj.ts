import SphericalMercator from '@mapbox/sphericalmercator';

import { LatLon, Point } from './track';

const TILE_SIZE = 256;
const mercator = new SphericalMercator({ size: TILE_SIZE });

// Returns:
// - tile =  coordinates of the tile,
// - px = pixel coordinates in the tile,
// - word = world coordinates.
export function pixelCoordinates(latLon: LatLon, zoom: number): { tile: Point; px: Point; world: Point } {
  const [x, y] = mercator.px([latLon.lon, latLon.lat], zoom);

  const tile = {
    x: Math.floor(x / TILE_SIZE),
    y: Math.floor(y / TILE_SIZE),
  };

  const px = {
    x: x % TILE_SIZE,
    y: y % TILE_SIZE,
  };

  return {
    tile,
    px,
    world: { x, y },
  };
}
