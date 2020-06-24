import SphericalMercator from '@mapbox/sphericalmercator';

import { LatLon, Point } from './track';

const TILE_SIZE = 256;
const mercator = new SphericalMercator({ size: TILE_SIZE });

// Returns the coordinates of the tile and the pixel inside the tile.
export function tileCoordinates(latLon: LatLon, zoom: number): { tile: Point; px: Point } {
  const screenPx = mercator.px([latLon.lon, latLon.lat], zoom);

  const tile = {
    x: Math.floor(screenPx[0] / TILE_SIZE),
    y: Math.floor(screenPx[1] / TILE_SIZE),
  };

  const px = {
    x: screenPx[0] % TILE_SIZE,
    y: screenPx[1] % TILE_SIZE,
  };

  return {
    tile,
    px,
  };
}
