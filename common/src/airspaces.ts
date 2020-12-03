import { Feature } from 'mapbox-vector-tile';

import { Point } from './runtime-track';

// Flags of the airspaces.
export const enum Flags {
  AirspaceProhibited = 1 << 0,
  AirspaceRestricted = 1 << 1,
  AirspaceDanger = 1 << 2,
  AirspaceOther = 1 << 3,
  FloorRefGnd = 1 << 4,
  TopRefGnd = 1 << 5,
}

// Returns a unique tile id for a given (x, y, zoom).
export function tileId(zoom: number, point: Point): number {
  return ((1 << zoom) * point.y + point.x) * 32 + zoom;
}

// Returns the color of an airspace given the flags property.
// `alpha` should be in the range 00-ff
export function airspaceColor(flags: number, alpha: number): string {
  const alphaStr = String(alpha).padStart(2, '0');
  if (flags & Flags.AirspaceProhibited) {
    return `#bf4040${alphaStr}`;
  }
  if (flags & Flags.AirspaceRestricted) {
    return `#bfbf40${alphaStr}`;
  }
  if (flags & Flags.AirspaceDanger) {
    return `#bf8040${alphaStr}`;
  }
  return `#808080${alphaStr}`;
}

// Returns the category of the airspace.
export function airspaceCategory(flags: number): string {
  if (flags & Flags.AirspaceProhibited) {
    return `prohibited`;
  }
  if (flags & Flags.AirspaceRestricted) {
    return `restricted`;
  }
  if (flags & Flags.AirspaceDanger) {
    return `danger`;
  }
  return `other`;
}

// Returns whether the point is inside the polygon feature.
export function isInFeature(point: Point, feature: Feature): boolean {
  const ratio = 256 / feature.extent;
  const polygons = feature.asPolygons() ?? [];
  for (const rings of polygons) {
    // The point must be in the outer ring.
    let isIn = isInPolygon(point, rings[0], ratio);
    if (isIn) {
      for (let i = 1; i < rings.length; ++i) {
        // The point must not be in any hole.
        isIn = isIn && !isInPolygon(point, rings[i], ratio);
      }
    }
    if (isIn) {
      return true;
    }
  }

  return false;
}

export function getAspTileUrl(x: number, y: number, z: number): string {
  return `https://airspaces.storage.googleapis.com/tiles/20200714/${z}/${x}/${y}.pbf`;
}

// Returns whether the point is in the polygon.
function isInPolygon(point: Point, polygon: Point[], ratio: number): boolean {
  const { x, y } = { x: point.x / ratio, y: point.y / ratio };

  let isIn = false;

  let [xa, ya] = [polygon[0].x, polygon[0].y];
  for (let j = 1; j < polygon.length; j++) {
    const [xb, yb] = [polygon[j].x, polygon[j].y];

    if (ya > y != yb > y && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) {
      isIn = !isIn;
    }
    [xa, ya] = [xb, yb];
  }

  return isIn;
}
