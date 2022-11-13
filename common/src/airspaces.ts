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

export const ASP_TILE_URL = 'https://airsp.storage.googleapis.com/tiles/{z}/{x}/{y}.pbf';
export const ASP_COLOR_PROHIBITED = '#bf4040';
export const ASP_COLOR_RESTRICTED = '#bfbf40';
export const ASP_COLOR_DANGER = '#bf8040';
export const ASP_COLOR_OTHER = '#808080';

// Returns the color of an airspace given the flags property.
// `alpha` should be in the range 00-ff
export function airspaceColor(flags: number, alpha: number): string {
  const alphaStr = String(alpha).padStart(2, '0');
  if (flags & Flags.AirspaceProhibited) {
    return `${ASP_COLOR_PROHIBITED}${alphaStr}`;
  }
  if (flags & Flags.AirspaceRestricted) {
    return `${ASP_COLOR_RESTRICTED}${alphaStr}`;
  }
  if (flags & Flags.AirspaceDanger) {
    return `${ASP_COLOR_DANGER}${alphaStr}`;
  }
  return `${ASP_COLOR_OTHER}${alphaStr}`;
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
  return ASP_TILE_URL.replace('{x}', String(x)).replace('{y}', String(y)).replace('{z}', String(z));
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
