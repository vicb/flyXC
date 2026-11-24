import { SphericalMercator } from '@mapbox/sphericalmercator';

import { DEG_TO_RAD } from './math';
import type { LatLon, Point } from './runtime-track';

/** WGS84 equatorial Earth radius in meters. */
export const EARTH_RADIUS_M = 6378137;
const MERC_X_SCALE = (Math.PI * EARTH_RADIUS_M) / 180;
const MERC_HALF_R = EARTH_RADIUS_M * 0.5;

/**
 * Projects WGS84 `(lon, lat)` degrees directly into EPSG:3857 WebMercator meters.
 */
export function lonLatToWebMercator(lon: number, lat: number): [number, number] {
  const sinLat = Math.sin(lat * DEG_TO_RAD);
  return [lon * MERC_X_SCALE, MERC_HALF_R * Math.log((1 + sinLat) / (1 - sinLat))];
}

const mercatorBySize = new Map<number, InstanceType<typeof SphericalMercator>>();

// Returns:
// - tile =  coordinates of the tile,
// - px = pixel coordinates in the tile,
// - world = world coordinates.
export function getPixelCoordinates(
  latLon: LatLon,
  zoom: number,
  tileSize: number,
): { tile: Point; px: Point; world: Point } {
  if (!mercatorBySize.has(tileSize)) {
    mercatorBySize.set(tileSize, new SphericalMercator({ size: tileSize }));
  }
  const mercator = mercatorBySize.get(tileSize)!;

  const [x, y] = mercator.px([latLon.lon, latLon.lat], zoom);

  const tile = {
    x: Math.floor(x / tileSize),
    y: Math.floor(y / tileSize),
  };

  const px = {
    x: x % tileSize,
    y: y % tileSize,
  };

  return {
    tile,
    px,
    world: { x, y },
  };
}
