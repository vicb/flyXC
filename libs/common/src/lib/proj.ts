import SphericalMercator from '@mapbox/sphericalmercator';
import type { LatLon, Point } from './runtime-track';

const mercatorBySize = new Map<number, SphericalMercator>();

// Returns:
// - tile =  coordinates of the tile,
// - px = pixel coordinates in the tile,
// - world = world coordinates.
export function pixelCoordinates(
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
