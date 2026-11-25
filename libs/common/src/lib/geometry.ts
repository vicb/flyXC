import { METERS_PER_DEG_LAT } from './distance';

/**
 * 2D bounding box representing minimum and maximum coordinates.
 */
export interface Bounds2D {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

/**
 * Packed 2D coordinates and ring end offsets for flat polygons and wall extrusion.
 */
export interface FlatRings {
  coords: Float64Array;
  ends: Uint32Array;
}

/**
 * Returns whether bounding box `a` overlaps bounding box `b` (or `true` if `a` is undefined).
 */
export function boundsOverlap(a: Bounds2D | undefined, b: Bounds2D): boolean {
  if (!a) {
    return true;
  }
  return a.xmax >= b.xmin && a.xmin <= b.xmax && a.ymax >= b.ymin && a.ymin <= b.ymax;
}

/**
 * Computes the squared equirectangular distance in km² from `(lon, lat)` to the nearest point on `bounds`.
 */
export function boundsDistanceSquaredKm(bounds: Bounds2D, lon: number, lat: number, cosLat: number): number {
  const kmPerDegLat = METERS_PER_DEG_LAT / 1000;
  const dLonKm = Math.max(bounds.xmin - lon, lon - bounds.xmax, 0) * kmPerDegLat * cosLat;
  const dLatKm = Math.max(bounds.ymin - lat, lat - bounds.ymax, 0) * kmPerDegLat;
  return dLonKm * dLonKm + dLatKm * dLatKm;
}

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
 * Tests whether a point (x, y) is inside a flat polygon with outer boundary and holes.
 *
 * @param x - X coordinate / longitude.
 * @param y - Y coordinate / latitude.
 * @param coords - Contiguous coordinates [x0, y0, x1, y1, ...].
 * @param ends - End index offsets marking each ring in `coords`.
 * @param ringStart - First ring index in `ends` (defaults to 0).
 * @param ringEnd - Exclusive end ring index in `ends` (defaults to `ends.length`).
 */
export function pointInFlatPolygon(
  x: number,
  y: number,
  coords: ArrayLike<number>,
  ends: ArrayLike<number>,
  ringStart = 0,
  ringEnd = ends.length,
): boolean {
  if (ringStart >= ringEnd) {
    return false;
  }
  const start0 = ringStart === 0 ? 0 : ends[ringStart - 1];
  const end0 = ends[ringStart];
  if (end0 - start0 < 6) {
    return false;
  }

  // Fast path for the exterior boundary (ringStart)
  let inside = false;
  let xj = coords[end0 - 2];
  let yj = coords[end0 - 1];
  for (let i = start0; i < end0; i += 2) {
    const xi = coords[i];
    const yi = coords[i + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
    xj = xi;
    yj = yi;
  }

  // Fast exit: if outside the exterior ring or no holes exist, no need to check holes
  if (!inside || ringEnd - ringStart === 1) {
    return inside;
  }

  // Check interior holes (rings ringStart + 1 .. ringEnd - 1)
  let start = end0;
  for (let r = ringStart + 1; r < ringEnd; r++) {
    const end = ends[r];
    if (end - start >= 6) {
      let hxj = coords[end - 2];
      let hyj = coords[end - 1];
      for (let i = start; i < end; i += 2) {
        const hxi = coords[i];
        const hyi = coords[i + 1];
        if (hyi > y !== hyj > y && x < ((hxj - hxi) * (y - hyi)) / (hyj - hyi) + hxi) {
          inside = !inside;
        }
        hxj = hxi;
        hyj = hyi;
      }
    }
    start = end;
  }

  return inside;
}

/**
 * Subdivides segments in flat geographic rings longer than `maxStepMeters` and strips consecutive duplicate points.
 *
 * @param coords - Interleaved coordinates [lon0, lat0, lon1, lat1, ...].
 * @param ends - End index offsets marking each ring in `coords`.
 * @param maxStepMeters - Optional maximum allowed segment length in meters. If <= 0 or omitted, only duplicate points are stripped.
 * @returns Flat coordinates and ends with subdivided/cleaned rings.
 */
export function densifyFlatRings(
  coords: ArrayLike<number>,
  ends: ArrayLike<number>,
  maxStepMeters = 0,
): { coords: Float64Array; ends: Uint32Array } {
  const numRings = ends.length;
  if (numRings === 0) {
    return { coords: new Float64Array(0), ends: new Uint32Array(0) };
  }

  const maxStepM2 = maxStepMeters > 0 ? maxStepMeters * maxStepMeters : 0;

  // Pass 1: Count required vertices to allocate exact TypedArray once (zero reallocations)
  let totalVertices = 0;
  let hasSubdivisions = false;
  let hasDuplicates = false;
  let validRingCount = 0;

  let start = 0;
  for (let r = 0; r < numRings; r++) {
    const end = ends[r];
    const count = (end - start) >> 1;
    if (count < 3) {
      start = end;
      continue;
    }

    validRingCount++;
    let ringVertices = 1;
    let prevLon = coords[start];
    let prevLat = coords[start + 1];

    const cosLat = Math.max(0.1, Math.cos((prevLat * Math.PI) / 180));
    const mPerDegLon = METERS_PER_DEG_LAT * cosLat;

    for (let i = start + 2; i < end; i += 2) {
      const currLon = coords[i];
      const currLat = coords[i + 1];
      if (currLon === prevLon && currLat === prevLat) {
        hasDuplicates = true;
        continue;
      }
      if (maxStepM2 > 0) {
        const dx = (currLon - prevLon) * mPerDegLon;
        const dy = (currLat - prevLat) * METERS_PER_DEG_LAT;
        const d2 = dx * dx + dy * dy;
        if (d2 > maxStepM2) {
          const segLenM = Math.sqrt(d2);
          const steps = Math.ceil(segLenM / maxStepMeters);
          if (steps > 1) {
            hasSubdivisions = true;
            ringVertices += steps - 1;
          }
        }
      }
      ringVertices++;
      prevLon = currLon;
      prevLat = currLat;
    }

    if (ringVertices >= 3) {
      totalVertices += ringVertices;
    }
    start = end;
  }

  // Fast path: if no points were added or removed and all rings valid
  if (
    !hasSubdivisions &&
    !hasDuplicates &&
    validRingCount === numRings &&
    coords instanceof Float64Array &&
    ends instanceof Uint32Array
  ) {
    return { coords, ends };
  }

  // Pass 2: Allocate exact output buffers and populate
  const outCoords = new Float64Array(totalVertices * 2);
  const outEnds = new Uint32Array(validRingCount);
  let outCount = 0;
  let outRingIdx = 0;

  start = 0;
  for (let r = 0; r < numRings; r++) {
    const end = ends[r];
    const count = (end - start) >> 1;
    if (count < 3) {
      start = end;
      continue;
    }

    const ringStartIdx = outCount;
    let prevLon = coords[start];
    let prevLat = coords[start + 1];

    outCoords[outCount++] = prevLon;
    outCoords[outCount++] = prevLat;

    const cosLat = Math.max(0.1, Math.cos((prevLat * Math.PI) / 180));
    const mPerDegLon = METERS_PER_DEG_LAT * cosLat;

    for (let i = start + 2; i < end; i += 2) {
      const currLon = coords[i];
      const currLat = coords[i + 1];
      if (currLon === prevLon && currLat === prevLat) {
        continue;
      }
      if (maxStepM2 > 0) {
        const dx = (currLon - prevLon) * mPerDegLon;
        const dy = (currLat - prevLat) * METERS_PER_DEG_LAT;
        const d2 = dx * dx + dy * dy;
        if (d2 > maxStepM2) {
          const segLenM = Math.sqrt(d2);
          const steps = Math.ceil(segLenM / maxStepMeters);
          if (steps > 1) {
            const invSteps = 1 / steps;
            const dLon = currLon - prevLon;
            const dLat = currLat - prevLat;
            for (let k = 1; k < steps; k++) {
              const t = k * invSteps;
              outCoords[outCount++] = prevLon + dLon * t;
              outCoords[outCount++] = prevLat + dLat * t;
            }
          }
        }
      }
      outCoords[outCount++] = currLon;
      outCoords[outCount++] = currLat;
      prevLon = currLon;
      prevLat = currLat;
    }

    const ringVertices = (outCount - ringStartIdx) >> 1;
    if (ringVertices >= 3) {
      outEnds[outRingIdx++] = outCount;
    } else {
      outCount = ringStartIdx;
    }
    start = end;
  }

  return {
    coords: outCoords,
    ends: outRingIdx === validRingCount ? outEnds : outEnds.slice(0, outRingIdx),
  };
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
