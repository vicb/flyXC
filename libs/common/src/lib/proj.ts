import { DEG_TO_RAD } from './math';
import type { LatLon, Point } from './runtime-track';

/** WGS84 equatorial Earth radius in meters. */
export const EARTH_RADIUS_M = 6378137;
const MERC_X_SCALE = (Math.PI * EARTH_RADIUS_M) / 180;
const MERC_HALF_R = EARTH_RADIUS_M * 0.5;
const MERC_CIRCUMFERENCE = 2 * Math.PI * EARTH_RADIUS_M;

/**
 * Projects WGS84 `(lon, lat)` degrees directly into EPSG:3857 WebMercator meters.
 */
export function lonLatToWebMercator(lon: number, lat: number): [number, number] {
  const sinLat = Math.sin(lat * DEG_TO_RAD);
  return [lon * MERC_X_SCALE, MERC_HALF_R * Math.log((1 + sinLat) / (1 - sinLat))];
}

// Returns:
// - tile = coordinates of the tile,
// - px = pixel coordinates in the tile,
// - world = world coordinates.
export function getPixelCoordinates(
  latLon: LatLon,
  zoom: number,
  tileSize: number,
): { tile: Point; px: Point; world: Point } {
  const [mx, my] = lonLatToWebMercator(latLon.lon, latLon.lat);
  const totalPx = tileSize * 2 ** zoom;
  const x = Math.round((0.5 + mx / MERC_CIRCUMFERENCE) * totalPx);
  const y = Math.round((0.5 - my / MERC_CIRCUMFERENCE) * totalPx);

  return {
    tile: {
      x: Math.floor(x / tileSize),
      y: Math.floor(y / tileSize),
    },
    px: {
      x: x % tileSize,
      y: y % tileSize,
    },
    world: { x, y },
  };
}
