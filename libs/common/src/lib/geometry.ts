import { METERS_PER_DEG_LAT } from './distance';
import type { Point } from './runtime-track';

/**
 * 2D bounding box representing minimum and maximum coordinates.
 */
export interface Bounds2D {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export type PolygonPoint = Point | [number, number] | readonly number[] | number[];
export type PolygonRing = ReadonlyArray<PolygonPoint>;

/**
 * Computes the squared Euclidean distance from a 2D point (px, py) to a line segment (x1, y1)-(x2, y2).
 *
 * @param px - X coordinate of the query point.
 * @param py - Y coordinate of the query point.
 * @param x1 - X coordinate of the segment start point.
 * @param y1 - Y coordinate of the segment start point.
 * @param x2 - X coordinate of the segment end point.
 * @param y2 - Y coordinate of the segment end point.
 * @returns Squared Euclidean distance between the point and the closest point on the segment.
 */
export function pointToSegmentSquared2D(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  let x = x1;
  let y = y1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 > 0) {
    const t = Math.max(0, Math.min(1, ((px - x) * dx + (py - y) * dy) / l2));
    x += dx * t;
    y += dy * t;
  }
  const rx = px - x;
  const ry = py - y;
  return rx * rx + ry * ry;
}

/**
 * Computes the intersection of two 2D line segments: (x1, y1)-(x2, y2) and (x3, y3)-(x4, y4).
 *
 * If the two segments intersect, returns the parametric scalar `t` along the first segment
 * `(x1, y1) + t * (x2 - x1, y2 - y1)` where `0 <= t <= 1`.
 * Returns `null` if the segments are parallel, collinear, or do not intersect within their bounds.
 *
 * @param x1 - X coordinate of first segment start point.
 * @param y1 - Y coordinate of first segment start point.
 * @param x2 - X coordinate of first segment end point.
 * @param y2 - Y coordinate of first segment end point.
 * @param x3 - X coordinate of second segment start point.
 * @param y3 - Y coordinate of second segment start point.
 * @param x4 - X coordinate of second segment end point.
 * @param y4 - Y coordinate of second segment end point.
 * @returns Parametric distance `t` in [0, 1] along the first segment if an intersection occurs, or `null`.
 */
export function segmentIntersection(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
): number | null {
  const dx1 = x2 - x1;
  const dy1 = y2 - y1;
  const dx2 = x4 - x3;
  const dy2 = y4 - y3;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-12) {
    return null;
  }
  const t = ((x3 - x1) * dy2 - (y3 - y1) * dx2) / denom;
  const u = ((x3 - x1) * dy1 - (y3 - y1) * dx1) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

/**
 * Extracts the X coordinate from a {@link PolygonPoint} (`[x, y]` tuple or `{x, y}` {@link Point} object).
 * Kept as a separate primitive function so V8 can inline it without heap allocations.
 */
export function getPointX(point: PolygonPoint): number {
  return 'x' in (point as Point) ? (point as Point).x : (point as [number, number])[0];
}

/**
 * Extracts the Y coordinate from a {@link PolygonPoint} (`[x, y]` tuple or `{x, y}` {@link Point} object).
 * Kept as a separate primitive function so V8 can inline it without heap allocations.
 */
export function getPointY(point: PolygonPoint): number {
  return 'y' in (point as Point) ? (point as Point).y : (point as [number, number])[1];
}

/**
 * Returns whether a point (x/lon, y/lat) is inside a polygon defined by its rings (outer ring and optional holes).
 * Uses the ray-casting algorithm (even-odd rule) and supports rings made of Point objects ({x, y}) or coordinate tuples ([x, y]).
 *
 * @param x - X coordinate / longitude of the query point.
 * @param y - Y coordinate / latitude of the query point.
 * @param rings - Array of polygon rings (outer ring followed by optional hole rings).
 * @returns True if the point is inside the polygon area and outside all holes.
 */
export function pointInPolygonRings(x: number, y: number, rings: ReadonlyArray<PolygonRing>): boolean {
  let inside = false;
  for (const ring of rings) {
    const len = ring.length;
    if (len < 3) {
      continue;
    }
    let xj = getPointX(ring[len - 1]);
    let yj = getPointY(ring[len - 1]);
    for (let i = 0; i < len; i++) {
      const p = ring[i];
      const xi = getPointX(p);
      const yi = getPointY(p);
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
      xj = xi;
      yj = yi;
    }
  }
  return inside;
}

/**
 * Computes the 2D bounding box (xmin, ymin, xmax, ymax) of an array of points or nested rings of points.
 *
 * @param pointsOrRings - Either a 1D array of points [x, y] / {x, y} or an array of rings.
 * @returns The bounding box, or undefined if no valid coordinates were found.
 */
export function computeBounds(pointsOrRings: ReadonlyArray<PolygonPoint | PolygonRing>): Bounds2D | undefined {
  if (pointsOrRings.length === 0) {
    return undefined;
  }

  let xmin = Number.POSITIVE_INFINITY;
  let ymin = Number.POSITIVE_INFINITY;
  let xmax = Number.NEGATIVE_INFINITY;
  let ymax = Number.NEGATIVE_INFINITY;

  const first = pointsOrRings[0];
  const rings =
    !Array.isArray(first) || typeof first[0] === 'number'
      ? ([pointsOrRings] as ReadonlyArray<PolygonRing>)
      : (pointsOrRings as ReadonlyArray<PolygonRing>);

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    if (!Array.isArray(ring)) {
      continue;
    }
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const x = getPointX(p);
      const y = getPointY(p);
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
    }
  }

  return xmin <= xmax && ymin <= ymax ? { xmin, ymin, xmax, ymax } : undefined;
}

/**
 * Tests whether two 2D bounding boxes overlap (AABB intersection).
 *
 * @param a - First bounding box.
 * @param b - Second bounding box.
 * @returns True if the bounding boxes intersect.
 */
export function boundsOverlap(a: Bounds2D, b: Bounds2D): boolean {
  return a.xmax >= b.xmin && a.xmin <= b.xmax && a.ymax >= b.ymin && a.ymin <= b.ymax;
}

/**
 * Subdivides segments in a geographic polyline longer than `maxStepMeters` and strips consecutive duplicate points.
 *
 * @param coords - Sequence of [lon, lat] coordinates.
 * @param maxStepMeters - Optional maximum allowed segment length in meters. If <= 0 or omitted, only duplicate points are stripped.
 * @returns A densified sequence of [lon, lat] coordinates.
 */
export function densifyPolyline(coords: [number, number][], maxStepMeters = 0): [number, number][] {
  if (coords.length <= 1) {
    return coords;
  }
  const out: [number, number][] = [[coords[0][0], coords[0][1]]];
  for (let i = 1; i < coords.length; i++) {
    const prev = out[out.length - 1];
    const lon0 = prev[0];
    const lat0 = prev[1];
    const curr = coords[i];
    const lon1 = curr[0];
    const lat1 = curr[1];
    if (lon0 === lon1 && lat0 === lat1) {
      continue;
    }
    if (maxStepMeters > 0) {
      const cosLat = Math.max(0.1, Math.cos(((lat0 + lat1) * 0.5 * Math.PI) / 180));
      const dx = (lon1 - lon0) * METERS_PER_DEG_LAT * cosLat;
      const dy = (lat1 - lat0) * METERS_PER_DEG_LAT;
      const segLenM = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.ceil(segLenM / maxStepMeters));
      if (steps > 1) {
        const invSteps = 1 / steps;
        const dLon = lon1 - lon0;
        const dLat = lat1 - lat0;
        for (let k = 1; k < steps; k++) {
          const t = k * invSteps;
          out.push([lon0 + dLon * t, lat0 + dLat * t]);
        }
      }
    }
    out.push([lon1, lat1]);
  }
  return out;
}

/**
 * Recursive step for the Ramer-Douglas-Peucker line simplification algorithm.
 * Finds the point with the maximum perpendicular distance from the segment between
 * `points[first]` and `points[last]`, and recursively subdivides if that distance
 * exceeds `sqTol`.
 *
 * @param points - Array of 2D coordinates `[x, y]`.
 * @param first - Index of the start point of the current segment.
 * @param last - Index of the end point of the current segment.
 * @param sqTol - Squared tolerance distance.
 * @param simplified - Target array accumulating simplified points.
 */
export function simplifyDPStep(
  points: [number, number][],
  first: number,
  last: number,
  sqTol: number,
  simplified: [number, number][],
): void {
  let maxSqDist = sqTol;
  let index = 0;

  const p1 = points[first];
  const p2 = points[last];
  const x1 = p1[0];
  const y1 = p1[1];
  const dx = p2[0] - x1;
  const dy = p2[1] - y1;
  const l2 = dx * dx + dy * dy;
  const invL2 = l2 > 0 ? 1 / l2 : 0;

  for (let i = first + 1; i < last; i++) {
    const pi = points[i];
    const px = pi[0];
    const py = pi[1];
    let sqDist: number;
    if (l2 === 0) {
      const rx = px - x1;
      const ry = py - y1;
      sqDist = rx * rx + ry * ry;
    } else {
      let t = ((px - x1) * dx + (py - y1) * dy) * invL2;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const rx = px - (x1 + dx * t);
      const ry = py - (y1 + dy * t);
      sqDist = rx * rx + ry * ry;
    }
    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }

  if (maxSqDist > sqTol) {
    if (index - first > 1) {
      simplifyDPStep(points, first, index, sqTol, simplified);
    }
    simplified.push(points[index]);
    if (last - index > 1) {
      simplifyDPStep(points, index, last, sqTol, simplified);
    }
  }
}

/**
 * Simplifies a sequence of 2D points using the Ramer-Douglas-Peucker algorithm.
 *
 * @param points - Array of 2D coordinates `[x, y]`.
 * @param tolerance - Maximum perpendicular distance threshold.
 * @returns Simplified array of 2D points.
 */
export function simplifyDouglasPeucker(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length <= 2) {
    return points;
  }
  const sqTolerance = tolerance * tolerance;
  const simplified: [number, number][] = [points[0]];
  simplifyDPStep(points, 0, points.length - 1, sqTolerance, simplified);
  simplified.push(points[points.length - 1]);
  return simplified;
}

/**
 * Fast distance-based pre-filter (radial distance) that removes consecutive points within tolerance.
 *
 * @param points - Array of 2D coordinates `[x, y]`.
 * @param tolerance - Minimum Euclidean distance required between consecutive points.
 * @returns Array of surviving 2D points.
 */
export function simplifyRadialDist(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length <= 1) {
    return points;
  }
  const sqTolerance = tolerance * tolerance;
  let prevPoint = points[0];
  const newPoints: [number, number][] = [prevPoint];
  let point = prevPoint;

  for (let i = 1, len = points.length; i < len; i++) {
    point = points[i];
    const dx = point[0] - prevPoint[0];
    const dy = point[1] - prevPoint[1];
    if (dx * dx + dy * dy > sqTolerance) {
      newPoints.push(point);
      prevPoint = point;
    }
  }

  if (prevPoint !== point) {
    newPoints.push(point);
  }

  return newPoints;
}

/**
 * Simplifies a 2D path by combining radial distance decimation with the Ramer-Douglas-Peucker algorithm.
 *
 * @param points - Array of 2D coordinates `[x, y]`.
 * @param tolerance - Distance tolerance threshold in coordinate units.
 * @returns Simplified array of 2D points.
 */
export function simplifyPath(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length <= 2) {
    return points;
  }
  const filtered = simplifyRadialDist(points, tolerance);
  return simplifyDouglasPeucker(filtered, tolerance);
}

/**
 * Simplifies a sequence of [lon, lat] coordinates using the Ramer-Douglas-Peucker algorithm
 * with equirectangular projection metric tolerance.
 *
 * Converts the metric tolerance in meters to longitude degrees based on the latitude
 * of the coordinates, preserving the start and end coordinates, closed rings,
 * and ensuring polygon rings retain at least 4 coordinates (the RFC 7946 GeoJSON minimum
 * for a closed linear ring: 3 distinct vertices plus 1 closing vertex [A, B, C, A]).
 *
 * @param coords - Sequence of [lon, lat] coordinates to simplify.
 * @param toleranceMeters - Maximum allowed deviation from the original line in meters (defaults to 15m).
 * @returns A simplified sequence of [lon, lat] coordinates.
 */
export function simplifyCoords(coords: [number, number][], toleranceMeters = 15): [number, number][] {
  // A valid closed GeoJSON polygon ring requires >= 4 coordinates (3 distinct vertices + 1 closing vertex).
  // A 4-point ring is already a minimal triangle and cannot be simplified further.
  if (coords.length <= 4 || toleranceMeters <= 0) {
    return coords;
  }
  const midLat = coords[0][1];
  const cosLat = Math.max(0.1, Math.cos((midLat * Math.PI) / 180));
  const tolDeg = toleranceMeters / (METERS_PER_DEG_LAT * cosLat);
  const simplified = simplifyDouglasPeucker(coords, tolDeg);
  // RFC 7946 §3.1.6: Rings with < 4 coordinates are degenerate (lines/points) and will break
  // downstream polygon tessellation (Earcut) and tile clipping. Fall back to original coords.
  if (simplified.length < 4) {
    return coords;
  }
  return simplified;
}
