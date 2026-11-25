import {
  type AirspaceTyped,
  type Bounds2D,
  clamp,
  densifyFlatRings,
  type FlatRings,
  METERS_PER_DEG_LAT,
  pointInFlatPolygon,
  pointToSegmentSquared2D,
} from '@flyxc/common';
import { Delaunay } from 'd3-delaunay';
import earcut from 'earcut';
import { classifyRingsFlat } from 'mapbox-vector-tile';

export type { FlatRings };

const MIN_DENSIFY_STEP_M = 1000;
const TARGET_DENSIFY_SEGMENTS = 48;

/**
 * Lightweight 2D polygon shape compatible with flat vector tile geometry.
 */
export interface AirspacePolygonLike {
  coords: Float64Array;
  ends: Uint32Array;
  extent?: Bounds2D | null;
}

/**
 * Intermediate 2D triangulation in geographic `(lon, lat)` coordinates.
 */
export interface Triangulated2D {
  xy: Float64Array;
  faces: Uint32Array;
}

/**
 * Cached 2D geometry and triangulated caps for an airspace polygon, independent of altitude exaggeration or terrain.
 */
export interface AirspaceFootprint {
  wallRings: FlatRings;
  flatCap?: Triangulated2D;
  terrainCap?: Triangulated2D;
  /** Level of detail: 0 = coarse, 1 = fine (default: 1). */
  lod?: number;
}

/**
 * Options for footprint generation, supporting progressive refinement.
 */
export interface BuildFootprintOptions {
  /** If true, uses coarser Steiner grid spacing for fast first-pass rendering (default: false). */
  coarse?: boolean;
  /** Maximum edge length in meters for cap triangulation (default: computed from AGL clearance). */
  maxEdgeM?: number;
}

function estimateExtentMeters(extent: Bounds2D): { widthM: number; heightM: number } {
  const midLat = (extent.ymin + extent.ymax) / 2;
  const cosLat = Math.max(0.1, Math.cos((midLat * Math.PI) / 180));
  return {
    widthM: (extent.xmax - extent.xmin) * METERS_PER_DEG_LAT * cosLat,
    heightM: (extent.ymax - extent.ymin) * METERS_PER_DEG_LAT,
  };
}

export function packEdgeKey(a: number, b: number): number {
  return a < b ? a * 10_000_000 + b : b * 10_000_000 + a;
}

function triangulateSinglePolygon2D(
  coords: Float64Array,
  ends: Uint32Array,
  ringStart: number,
  ringEnd: number,
): number[] {
  const numRings = ringEnd - ringStart;
  const coordStart = ringStart === 0 ? 0 : ends[ringStart - 1];
  const coordEnd = ends[ringEnd - 1];
  const polyCoords = coordStart === 0 && coordEnd === coords.length ? coords : coords.subarray(coordStart, coordEnd);
  const holeIndices = numRings > 1 ? new Array<number>(numRings - 1) : null;
  if (holeIndices) {
    for (let r = 0; r < numRings - 1; r++) {
      holeIndices[r] = (ends[ringStart + r] - coordStart) >> 1;
    }
  }
  const indices = earcut(polyCoords, holeIndices, 2);
  if (coordStart > 0) {
    const vertOffset = coordStart >> 1;
    for (let i = 0; i < indices.length; i++) {
      indices[i] += vertOffset;
    }
  }
  return indices;
}

function triangulateFlatRings2D(wallRings: FlatRings, polygonEnds?: ArrayLike<number>): Triangulated2D {
  const { coords, ends } = wallRings;
  const numRings = ends.length;
  if (numRings === 0) {
    return { xy: new Float64Array(0), faces: new Uint32Array(0) };
  }
  const groups =
    polygonEnds ??
    (numRings === 1 ? [1] : classifyRingsFlat(coords as unknown as number[], ends as unknown as number[]));
  if (groups.length === 1) {
    return { xy: coords, faces: new Uint32Array(triangulateSinglePolygon2D(coords, ends, 0, numRings)) };
  }
  const allFaces: number[] = [];
  let ringStart = 0;
  for (let p = 0; p < groups.length; p++) {
    const polyEnd = groups[p];
    const part = triangulateSinglePolygon2D(coords, ends, ringStart, polyEnd);
    for (let i = 0; i < part.length; i++) {
      allFaces.push(part[i]);
    }
    ringStart = polyEnd;
  }
  return { xy: coords, faces: new Uint32Array(allFaces) };
}

/**
 * Triangulates a polygon cap by injecting a regular 2D grid of interior Steiner points and
 * computing a conformal Delaunay triangulation.
 *
 * Standard polygon triangulation (e.g. earcut without Steiner points) creates long, skinny
 * radial triangles spanning from the polygon center to perimeter vertices. When draped over
 * mountainous terrain, these needle-like triangles produce severe visual clipping and sagging
 * artifacts. Injecting a regular interior Steiner grid produces uniform, well-conditioned
 * triangles that smoothly drape across complex 3D topography.
 */
export function triangulateCapWithGrid2D(wallRings: FlatRings, extent: Bounds2D, targetGridM = 2000): Triangulated2D {
  const { coords: wallCoords, ends } = wallRings;
  const numRings = ends.length;
  if (numRings === 0) {
    return { xy: new Float64Array(0), faces: new Uint32Array(0) };
  }

  const polygonEnds =
    numRings === 1 ? [1] : classifyRingsFlat(wallCoords as unknown as number[], ends as unknown as number[]);
  const isInsidePolygons = (lon: number, lat: number): boolean => {
    if (polygonEnds.length === 1) {
      return pointInFlatPolygon(lon, lat, wallCoords, ends);
    }
    let ringStart = 0;
    for (let p = 0; p < polygonEnds.length; p++) {
      const polyEnd = polygonEnds[p];
      if (pointInFlatPolygon(lon, lat, wallCoords, ends, ringStart, polyEnd)) {
        return true;
      }
      ringStart = polyEnd;
    }
    return false;
  };

  const { widthM, heightM } = estimateExtentMeters(extent);
  if (widthM <= targetGridM && heightM <= targetGridM) {
    return triangulateFlatRings2D(wallRings, polygonEnds);
  }

  // Cap subdivisions to prevent runaway grid generation on large polygons (100 for AGL caps <= 1500m, 40 for standard)
  const maxGridDivs = targetGridM <= 1500 ? 100 : 40;
  const effectiveGridM = Math.max(targetGridM, Math.max(widthM, heightM) / maxGridDivs);

  const midLat = (extent.ymin + extent.ymax) / 2;
  const cosLat = Math.max(0.1, Math.cos((midLat * Math.PI) / 180));
  const stepLat = effectiveGridM / METERS_PER_DEG_LAT;
  const stepLon = effectiveGridM / (METERS_PER_DEG_LAT * cosLat);

  const allCoords: number[] = [];
  // Pre-flatten boundary segments in projected coordinates to avoid redundant multiplications inside candidate loops
  const projSegmentsBuf = new Float64Array(wallCoords.length * 2);
  // Use numeric keys (a * 10_000_000 + b) instead of strings to eliminate memory allocations and GC churn
  const edgeCache = new Map<number, boolean>();
  let baseIdx = 0;
  let segIdx = 0;
  let start = 0;
  for (let r = 0; r < numRings; r++) {
    const end = ends[r];
    let count = (end - start) >> 1;
    if (count > 1 && wallCoords[start] === wallCoords[end - 2] && wallCoords[start + 1] === wallCoords[end - 1]) {
      count--;
    }
    for (let i = 0; i < count; i++) {
      const lon = wallCoords[start + i * 2];
      const lat = wallCoords[start + i * 2 + 1];
      allCoords.push(lon, lat);
      const next = (i + 1) % count;
      const nLon = wallCoords[start + next * 2];
      const nLat = wallCoords[start + next * 2 + 1];
      projSegmentsBuf[segIdx] = lon * cosLat;
      projSegmentsBuf[segIdx + 1] = lat;
      projSegmentsBuf[segIdx + 2] = nLon * cosLat;
      projSegmentsBuf[segIdx + 3] = nLat;
      segIdx += 4;
      edgeCache.set(packEdgeKey(baseIdx + i, baseIdx + next), true);
    }
    baseIdx += count;
    start = end;
  }

  if (allCoords.length < 6) {
    return { xy: new Float64Array(0), faces: new Uint32Array(0) };
  }

  const projSegments = projSegmentsBuf.subarray(0, segIdx);

  const minDistDeg = (effectiveGridM * 0.25) / METERS_PER_DEG_LAT;
  const minDistDeg2 = minDistDeg * minDistDeg;

  // Generate interior Steiner points strictly inside the polygon boundary
  for (let lon = extent.xmin + stepLon * 0.5; lon < extent.xmax; lon += stepLon) {
    for (let lat = extent.ymin + stepLat * 0.5; lat < extent.ymax; lat += stepLat) {
      if (isInsidePolygons(lon, lat)) {
        let tooClose = false;
        const plon = lon * cosLat;
        const latMin = lat - minDistDeg;
        const latMax = lat + minDistDeg;
        for (let s = 0; s < projSegments.length; s += 4) {
          const y1 = projSegments[s + 1];
          const y2 = projSegments[s + 3];
          if ((y1 < latMin && y2 < latMin) || (y1 > latMax && y2 > latMax)) {
            continue;
          }
          if (pointToSegmentSquared2D(plon, lat, projSegments[s], y1, projSegments[s + 2], y2) < minDistDeg2) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          allCoords.push(lon, lat);
        }
      }
    }
  }

  const xy = new Float64Array(allCoords);
  const projected = new Float64Array(xy.length);
  for (let i = 0; i < xy.length; i += 2) {
    projected[i] = xy[i] * cosLat;
    projected[i + 1] = xy[i + 1];
  }

  const delaunay = new Delaunay(projected);
  const tris = delaunay.triangles;
  const facesBuf = new Uint32Array(tris.length);
  let faceLen = 0;

  const isEdgeValid = (i1: number, i2: number): boolean => {
    const key = packEdgeKey(i1, i2);
    const cached = edgeCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const idx1 = i1 * 2;
    const idx2 = i2 * 2;
    const valid = isInsidePolygons((xy[idx1] + xy[idx2]) * 0.5, (xy[idx1 + 1] + xy[idx2 + 1]) * 0.5);
    edgeCache.set(key, valid);
    return valid;
  };

  for (let i = 0; i < tris.length; i += 3) {
    const i0 = tris[i];
    const i1 = tris[i + 1];
    const i2 = tris[i + 2];
    const idx0 = i0 * 2;
    const idx1 = i1 * 2;
    const idx2 = i2 * 2;
    const cx = (xy[idx0] + xy[idx1] + xy[idx2]) / 3;
    const cy = (xy[idx0 + 1] + xy[idx1 + 1] + xy[idx2 + 1]) / 3;
    if (!isInsidePolygons(cx, cy)) {
      continue;
    }
    if (!isEdgeValid(i0, i1) || !isEdgeValid(i1, i2) || !isEdgeValid(i2, i0)) {
      continue;
    }
    facesBuf[faceLen++] = i0;
    facesBuf[faceLen++] = i1;
    facesBuf[faceLen++] = i2;
  }

  if (faceLen === 0) {
    return triangulateFlatRings2D(wallRings, polygonEnds);
  }

  return { xy, faces: faceLen === tris.length ? facesBuf : facesBuf.slice(0, faceLen) };
}

/**
 * Returns the minimum positive AGL clearance (in meters) across an airspace's ground-referenced
 * floor and/or ceiling, or `undefined` if neither is ground-referenced.
 */
export function computeMinimumAglClearanceM(
  airspace: Pick<AirspaceTyped, 'floorM' | 'floorRefGnd' | 'topRefGnd'> & { topM?: number },
): number | undefined {
  let clearanceM = Infinity;
  if (airspace.floorRefGnd && airspace.floorM > 0) {
    clearanceM = Math.min(clearanceM, airspace.floorM);
  }
  if (airspace.topRefGnd) {
    const topM = airspace.topM ?? 1000;
    clearanceM = Math.min(clearanceM, topM);
    if (airspace.floorRefGnd) {
      clearanceM = Math.min(clearanceM, topM - airspace.floorM);
    }
  }
  return Number.isFinite(clearanceM) ? Math.max(50, clearanceM) : undefined;
}

/**
 * Computes an adaptive Steiner grid spacing based on minimum AGL clearance above terrain.
 * Narrow AGL cushions or elevated AGL floors over steep mountain ranges require tighter
 * triangulation so caps faithfully follow mountain crests without ridge puncture.
 */
export function computeTargetGridM(
  airspace: Pick<AirspaceTyped, 'floorM' | 'floorRefGnd' | 'topRefGnd'> & { topM?: number },
  coarse?: boolean,
): number {
  const clearanceM = computeMinimumAglClearanceM(airspace);
  if (clearanceM == null) {
    return coarse ? 4800 : 2000;
  }
  if (coarse) {
    return clamp(clearanceM * 4, 2000, 4800);
  }
  return clamp(Math.round(clearanceM * 1.5), 400, 1500);
}

/**
 * Builds the 2D wall rings and cap triangulations for an airspace polygon so later
 * exaggeration and terrain updates can re-extrude synchronously without re-triangulating.
 */
export function buildAirspaceFootprint(
  polygon: AirspacePolygonLike,
  airspace: Pick<AirspaceTyped, 'floorM' | 'floorRefGnd' | 'topRefGnd'> & { topM?: number },
  options?: BuildFootprintOptions,
): AirspaceFootprint | null {
  if (polygon.ends.length === 0 || !polygon.extent) {
    return null;
  }

  const targetGridM = options?.maxEdgeM ?? computeTargetGridM(airspace, options?.coarse);

  const hasGroundRef = airspace.floorRefGnd || airspace.topRefGnd;
  const hasElevatedTerrainCap = airspace.topRefGnd || (airspace.floorRefGnd && airspace.floorM > 0);
  let stepM: number | undefined;
  if (hasGroundRef) {
    const { widthM, heightM } = estimateExtentMeters(polygon.extent);
    const minStep = hasElevatedTerrainCap ? clamp(targetGridM * 0.8, 250, MIN_DENSIFY_STEP_M) : MIN_DENSIFY_STEP_M;
    stepM = options?.coarse
      ? Math.max(MIN_DENSIFY_STEP_M, Math.hypot(widthM, heightM) / TARGET_DENSIFY_SEGMENTS)
      : Math.max(minStep, Math.hypot(widthM, heightM) / (hasElevatedTerrainCap ? 96 : TARGET_DENSIFY_SEGMENTS));
  }

  const wallRings = densifyFlatRings(polygon.coords, polygon.ends, stepM);
  if (wallRings.ends.length === 0) {
    return null;
  }

  const sinkZeroFloor = airspace.floorRefGnd && airspace.floorM === 0;
  const needFloorCap = !sinkZeroFloor;
  const needFlatCap = !airspace.topRefGnd || (needFloorCap && !airspace.floorRefGnd);
  const needTerrainCap = airspace.topRefGnd || (needFloorCap && airspace.floorRefGnd);

  let flatCap: Triangulated2D | undefined;
  if (needFlatCap) {
    flatCap = triangulateFlatRings2D(wallRings);
  }

  const terrainCap = needTerrainCap ? triangulateCapWithGrid2D(wallRings, polygon.extent, targetGridM) : undefined;
  const lod = needTerrainCap && options?.coarse ? 0 : 1;

  return { wallRings, flatCap, terrainCap, lod };
}
