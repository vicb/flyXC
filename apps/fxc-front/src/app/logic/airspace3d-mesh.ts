import Mesh from '@arcgis/core/geometry/Mesh';
import MeshGeoreferencedVertexSpace from '@arcgis/core/geometry/support/MeshGeoreferencedVertexSpace';
// @ts-expect-error Internal ArcGIS 2D earcut tessellation utilities without type declarations
import * as tess from '@arcgis/core/views/3d/layers/graphics/tessellationUtils.js';
import { type AirspaceTyped, densifyPolyline, pointInPolygonRings, pointToSegmentSquared2D } from '@flyxc/common';
import { Delaunay } from 'd3-delaunay';

const METERS_PER_DEGREE_LAT = 111_320;
const MIN_DENSIFY_STEP_M = 1000;
const TARGET_DENSIFY_SEGMENTS = 48;
const GND_BASE_SINK_M = 250;

/**
 * Synchronous terrain elevation sampler returning exaggerated ground elevation in meters at `(lon, lat)`.
 */
export type GroundSampler = (lon: number, lat: number) => number;

/**
 * Lightweight 2D geographic bounding box compatible with ArcGIS Extent and plain objects.
 */
export interface AirspaceExtentLike {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

/**
 * Lightweight 2D polygon shape compatible with ArcGIS Polygon and raw decoded GeoJSON rings.
 */
export interface AirspacePolygonLike {
  rings: number[][][];
  extent?: AirspaceExtentLike | null;
}

/**
 * Input parameters for building a 3D airspace mesh.
 */
export interface AirspaceMeshParams {
  polygon: AirspacePolygonLike;
  airspace: AirspaceTyped;
  multiplier: number;
  sampleGroundZ: GroundSampler;
}

/**
 * Raw 3D vertex coordinates, triangle indices, and optional perimeter contour lines before combining into an ArcGIS Mesh.
 */
export interface AirspaceMeshData {
  positions: Float64Array;
  faces: Uint32Array;
  contourPaths?: number[][][];
}

/**
 * Intermediate 2D triangulation in geographic `(lon, lat)` coordinates.
 * `boundarySegments` holds packed numeric keys (`min * 10_000_000 + max`) of perimeter wall edges
 * so terrain-adaptive cap subdivision never splits wall-adjacent edges.
 */
export interface Triangulated2D {
  xy: Float64Array;
  faces: Uint32Array;
  boundarySegments?: Set<number>;
}

/**
 * Cached 2D geometry and triangulated caps for an airspace polygon, independent of altitude exaggeration or terrain.
 */
export interface AirspaceFootprint {
  wallRings: number[][][];
  flatCap?: Triangulated2D;
  terrainCap?: Triangulated2D;
  lod?: number;
}

/**
 * Options for footprint generation, supporting progressive refinement.
 */
export interface BuildFootprintOptions {
  coarse?: boolean;
  maxEdgeM?: number;
}

function estimateExtentMeters(extent: AirspaceExtentLike): { widthM: number; heightM: number } {
  const midLat = (extent.ymin + extent.ymax) / 2;
  const cosLat = Math.max(0.1, Math.cos((midLat * Math.PI) / 180));
  return {
    widthM: (extent.xmax - extent.xmin) * METERS_PER_DEGREE_LAT * cosLat,
    heightM: (extent.ymax - extent.ymin) * METERS_PER_DEGREE_LAT,
  };
}

/**
 * Strips consecutive duplicate vertices and optionally subdivides segments longer than `stepM`.
 */
function prepareWallRings(rings: number[][][], stepM?: number): number[][][] {
  const result: number[][][] = [];
  for (const ring of rings) {
    if (ring.length < 3) {
      continue;
    }
    const out = densifyPolyline(ring as [number, number][], stepM);
    if (out.length >= 3) {
      result.push(out);
    }
  }
  return result;
}

function triangulateRings2D(rings: number[][][]): Triangulated2D {
  if (rings.length === 0) {
    return { xy: new Float64Array(0), faces: new Uint32Array(0) };
  }
  const info = tess.ringsToOutlinedTessellationInfo(rings, { hasZ: false, ccwRingsAsHoles: true });
  const res = tess.tessellate(info, { method: 'earcut' });
  if (!res?.succeeded || !res.positions || !res.indices) {
    return { xy: new Float64Array(0), faces: new Uint32Array(0) };
  }
  const srcPos = res.positions;
  const vertexCount = srcPos.length / 3;
  const xy = new Float64Array(vertexCount * 2);
  for (let i = 0, j = 0; i < srcPos.length; i += 3, j += 2) {
    xy[j] = srcPos[i];
    xy[j + 1] = srcPos[i + 1];
  }
  return { xy, faces: new Uint32Array(res.indices) };
}

const sharedVertexSpace = new MeshGeoreferencedVertexSpace();
const sharedMeshMaterial = {
  color: [255, 255, 255, 1] as [number, number, number, number],
  alphaMode: 'blend' as const,
  doubleSided: true,
  unlit: true,
};

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
export function triangulateCapWithGrid2D(
  rings: number[][][],
  extent: AirspaceExtentLike,
  targetGridM = 2000,
): Triangulated2D {
  if (rings.length === 0) {
    return { xy: new Float64Array(0), faces: new Uint32Array(0) };
  }

  const { widthM, heightM } = estimateExtentMeters(extent);
  if (widthM <= targetGridM && heightM <= targetGridM) {
    return triangulateRings2D(rings);
  }

  // Cap subdivisions to prevent runaway grid generation on large polygons (100 for AGL caps <= 1500m, 40 for standard)
  const maxGridDivs = targetGridM <= 1500 ? 100 : 40;
  const effectiveGridM = Math.max(targetGridM, Math.max(widthM, heightM) / maxGridDivs);

  const midLat = (extent.ymin + extent.ymax) / 2;
  const cosLat = Math.max(0.1, Math.cos((midLat * Math.PI) / 180));
  const stepLat = effectiveGridM / METERS_PER_DEGREE_LAT;
  const stepLon = effectiveGridM / (METERS_PER_DEGREE_LAT * cosLat);

  const allPts: number[][] = [];
  // Use numeric keys (a * 10_000_000 + b) instead of strings to eliminate memory allocations and GC churn
  const boundarySegments = new Set<number>();
  let baseIdx = 0;
  let totalSegments = 0;
  for (const ring of rings) {
    const len =
      ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
        ? ring.length - 1
        : ring.length;
    totalSegments += len;
    for (let i = 0; i < len; i++) {
      allPts.push([ring[i][0], ring[i][1]]);
      const next = (i + 1) % len;
      const a = baseIdx + i;
      const b = baseIdx + next;
      boundarySegments.add(a < b ? a * 10_000_000 + b : b * 10_000_000 + a);
    }
    baseIdx += len;
  }

  if (allPts.length < 3) {
    return { xy: new Float64Array(0), faces: new Uint32Array(0) };
  }

  // Pre-flatten boundary segments in projected coordinates to avoid redundant multiplications inside candidate loops
  const projSegments = new Float64Array(totalSegments * 4);
  let segIdx = 0;
  for (const ring of rings) {
    const len =
      ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
        ? ring.length - 1
        : ring.length;
    for (let i = 0; i < len; i++) {
      const next = (i + 1) % len;
      projSegments[segIdx] = ring[i][0] * cosLat;
      projSegments[segIdx + 1] = ring[i][1];
      projSegments[segIdx + 2] = ring[next][0] * cosLat;
      projSegments[segIdx + 3] = ring[next][1];
      segIdx += 4;
    }
  }

  const minDistDeg = (effectiveGridM * 0.25) / METERS_PER_DEGREE_LAT;
  const minDistDeg2 = minDistDeg * minDistDeg;

  // Generate interior Steiner points strictly inside the polygon boundary
  for (let lon = extent.xmin + stepLon * 0.5; lon < extent.xmax; lon += stepLon) {
    for (let lat = extent.ymin + stepLat * 0.5; lat < extent.ymax; lat += stepLat) {
      if (pointInPolygonRings(lon, lat, rings)) {
        let tooClose = false;
        const plon = lon * cosLat;
        for (let s = 0; s < projSegments.length; s += 4) {
          if (
            pointToSegmentSquared2D(
              plon,
              lat,
              projSegments[s],
              projSegments[s + 1],
              projSegments[s + 2],
              projSegments[s + 3],
            ) < minDistDeg2
          ) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          allPts.push([lon, lat]);
        }
      }
    }
  }

  const numPts = allPts.length;
  const projected = new Float64Array(numPts * 2);
  for (let i = 0; i < numPts; i++) {
    projected[i * 2] = allPts[i][0] * cosLat;
    projected[i * 2 + 1] = allPts[i][1];
  }

  const delaunay = new Delaunay(projected);
  const tris = delaunay.triangles;
  const insideFaces: number[] = [];

  const isEdgeValid = (i1: number, i2: number): boolean => {
    const key = i1 < i2 ? i1 * 10_000_000 + i2 : i2 * 10_000_000 + i1;
    if (boundarySegments.has(key)) {
      return true;
    }
    const p1 = allPts[i1];
    const p2 = allPts[i2];
    return pointInPolygonRings((p1[0] + p2[0]) * 0.5, (p1[1] + p2[1]) * 0.5, rings);
  };

  for (let i = 0; i < tris.length; i += 3) {
    const i0 = tris[i];
    const i1 = tris[i + 1];
    const i2 = tris[i + 2];
    const p0 = allPts[i0];
    const p1 = allPts[i1];
    const p2 = allPts[i2];
    const cx = (p0[0] + p1[0] + p2[0]) / 3;
    const cy = (p0[1] + p1[1] + p2[1]) / 3;
    if (!pointInPolygonRings(cx, cy, rings)) {
      continue;
    }
    if (!isEdgeValid(i0, i1) || !isEdgeValid(i1, i2) || !isEdgeValid(i2, i0)) {
      continue;
    }
    insideFaces.push(i0, i1, i2);
  }

  if (insideFaces.length === 0) {
    return triangulateRings2D(rings);
  }

  const xy = new Float64Array(numPts * 2);
  for (let i = 0; i < numPts; i++) {
    xy[i * 2] = allPts[i][0];
    xy[i * 2 + 1] = allPts[i][1];
  }

  return { xy, faces: new Uint32Array(insideFaces), boundarySegments };
}

/**
 * Computes a fast ground-elevation checksum at representative points of a polygon so
 * terrain updates that do not meaningfully affect this airspace can be skipped.
 */
export function computeGroundSignature(polygon: AirspacePolygonLike, sampleGroundZ: GroundSampler): number {
  const extent = polygon.extent;
  if (!extent) {
    return 0;
  }
  let weight = 1;
  let sum = Math.round(sampleGroundZ((extent.xmin + extent.xmax) / 2, (extent.ymin + extent.ymax) / 2) / 2) * weight++;
  sum += Math.round(sampleGroundZ(extent.xmin, extent.ymin) / 2) * weight++;
  sum += Math.round(sampleGroundZ(extent.xmax, extent.ymin) / 2) * weight++;
  sum += Math.round(sampleGroundZ(extent.xmax, extent.ymax) / 2) * weight++;
  sum += Math.round(sampleGroundZ(extent.xmin, extent.ymax) / 2) * weight++;

  const ring = polygon.rings[0];
  if (ring && ring.length > 0) {
    const step = Math.max(1, Math.floor(ring.length / 4));
    for (let i = 0; i < ring.length; i += step) {
      sum += Math.round(sampleGroundZ(ring[i][0], ring[i][1]) / 2) * weight++;
    }
  }
  return sum;
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
      clearanceM = Math.min(clearanceM, Math.max(50, topM - airspace.floorM));
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
    return Math.max(2000, Math.min(4800, clearanceM * 4));
  }
  return Math.max(400, Math.min(1500, Math.round(clearanceM * 1.5)));
}

/**
 * Builds the 2D wall rings and cap triangulations for an airspace polygon so later
 * exaggeration and terrain updates can re-extrude synchronously without re-triangulating.
 */
export async function buildAirspaceFootprint(
  polygon: AirspacePolygonLike,
  airspace: Pick<AirspaceTyped, 'floorM' | 'floorRefGnd' | 'topRefGnd'> & { topM?: number },
  options?: BuildFootprintOptions,
): Promise<AirspaceFootprint | null> {
  if (polygon.rings.length === 0 || !polygon.extent) {
    return null;
  }

  const targetGridM = options?.maxEdgeM ?? computeTargetGridM(airspace, options?.coarse);

  const hasGroundRef = airspace.floorRefGnd || airspace.topRefGnd;
  const hasElevatedTerrainCap = airspace.topRefGnd || (airspace.floorRefGnd && airspace.floorM > 0);
  let stepM: number | undefined;
  if (hasGroundRef) {
    const { widthM, heightM } = estimateExtentMeters(polygon.extent);
    const minStep = hasElevatedTerrainCap
      ? Math.max(250, Math.min(MIN_DENSIFY_STEP_M, targetGridM * 0.8))
      : MIN_DENSIFY_STEP_M;
    stepM = options?.coarse
      ? Math.max(MIN_DENSIFY_STEP_M, Math.hypot(widthM, heightM) / TARGET_DENSIFY_SEGMENTS)
      : Math.max(minStep, Math.hypot(widthM, heightM) / (hasElevatedTerrainCap ? 96 : TARGET_DENSIFY_SEGMENTS));
  }

  const wallRings = prepareWallRings(polygon.rings, stepM);
  if (wallRings.length === 0) {
    return null;
  }

  const sinkZeroFloor = airspace.floorRefGnd && airspace.floorM === 0;
  const needFloorCap = !sinkZeroFloor;
  const needFlatCap = !airspace.topRefGnd || (needFloorCap && !airspace.floorRefGnd);
  const needTerrainCap = airspace.topRefGnd || (needFloorCap && airspace.floorRefGnd);

  let flatCap: Triangulated2D | undefined;
  if (needFlatCap) {
    flatCap = triangulateRings2D(wallRings);
  }

  const terrainCap = needTerrainCap ? triangulateCapWithGrid2D(wallRings, polygon.extent, targetGridM) : undefined;
  const lod = needTerrainCap && options?.coarse ? 0 : 1;

  return { wallRings, flatCap, terrainCap, lod };
}

const RIDGE_REFINE_MAX_PASSES = 3;
const RIDGE_REFINE_MIN_EDGE_M2 = 180 * 180;

/**
 * Refines a terrain-cap triangulation via conforming (Red-Green) active-set subdivision
 * wherever terrain ridges protrude upward through an edge midpoint or triangle centroid.
 *
 * Uses an interleaved `xy` `Float64Array`, exact Euler-bounded face buffers (`faceLen + addedVerts * 6`),
 * and primitive `Map<number, number>` edge entries to minimize CPU, memory, and GC pressure.
 * Perimeter edges (`boundarySegments`) are never split so caps stay flush with vertical walls.
 */
function refineTerrainCapForRidges(
  tri: Triangulated2D,
  clearanceM: number,
  multiplier: number,
  sampleGroundZ: GroundSampler,
  maxPasses = RIDGE_REFINE_MAX_PASSES,
): { tri: Triangulated2D; gnds: Float64Array } {
  const initVerts = tri.xy.length / 2;
  if (initVerts === 0 || tri.faces.length === 0) {
    return { tri, gnds: new Float64Array(0) };
  }

  let vertCount = initVerts;
  let vertCap = maxPasses > 0 ? Math.max(initVerts * 2, initVerts + 64) : initVerts;
  let xy = maxPasses > 0 ? new Float64Array(vertCap * 2) : tri.xy;
  if (maxPasses > 0) {
    xy.set(tri.xy);
  }
  let gnds = new Float64Array(vertCap);
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (let i = 0; i < initVerts; i++) {
    const lon = xy[i * 2];
    const lat = xy[i * 2 + 1];
    gnds[i] = sampleGroundZ(lon, lat);
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  if (maxPasses <= 0) {
    return { tri, gnds };
  }

  const cosLat = Math.max(0.1, Math.cos(((minLat + maxLat) * 0.5 * Math.PI) / 180));
  const mPerDegLon = METERS_PER_DEGREE_LAT * cosLat;
  const tau = Math.max(35, Math.min(100, clearanceM * 0.3)) * multiplier;
  const boundarySegments = tri.boundarySegments;
  // Value >= 0: split vertex index; -1: tested and unsplit (cached across passes)
  const edgeMidpoint = new Map<number, number>();
  const edgeKey = (a: number, b: number) => (a < b ? a * 10_000_000 + b : b * 10_000_000 + a);

  const addVertex = (lon: number, lat: number, gnd: number): number => {
    if (vertCount === vertCap) {
      vertCap *= 2;
      const nextXy = new Float64Array(vertCap * 2);
      const nextGnds = new Float64Array(vertCap);
      nextXy.set(xy);
      nextGnds.set(gnds);
      xy = nextXy;
      gnds = nextGnds;
    }
    const idx = vertCount++;
    xy[idx * 2] = lon;
    xy[idx * 2 + 1] = lat;
    gnds[idx] = gnd;
    return idx;
  };

  const testEdge = (a: number, b: number, forceSplit: boolean): number => {
    const key = edgeKey(a, b);
    const cached = edgeMidpoint.get(key);
    if (cached !== undefined && (cached >= 0 || !forceSplit)) {
      return cached;
    }
    if (boundarySegments?.has(key)) {
      edgeMidpoint.set(key, -1);
      return -1;
    }
    const lonA = xy[a * 2];
    const latA = xy[a * 2 + 1];
    const lonB = xy[b * 2];
    const latB = xy[b * 2 + 1];
    const dx = (lonB - lonA) * mPerDegLon;
    const dy = (latB - latA) * METERS_PER_DEGREE_LAT;
    if (dx * dx + dy * dy <= RIDGE_REFINE_MIN_EDGE_M2) {
      edgeMidpoint.set(key, -1);
      return -1;
    }
    const midLon = (lonA + lonB) * 0.5;
    const midLat = (latA + latB) * 0.5;
    const gMid = sampleGroundZ(midLon, midLat);
    if (forceSplit || gMid - (gnds[a] + gnds[b]) * 0.5 > tau) {
      const midIdx = addVertex(midLon, midLat, gMid);
      edgeMidpoint.set(key, midIdx);
      return midIdx;
    }
    edgeMidpoint.set(key, -1);
    return -1;
  };

  let faces = tri.faces;
  let faceLen = faces.length;
  let activeTris = new Uint32Array(faceLen / 3);
  for (let i = 0; i < activeTris.length; i++) {
    activeTris[i] = i;
  }
  let activeCount = activeTris.length;

  for (let pass = 0; pass < maxPasses && activeCount > 0; pass++) {
    const prevVertCount = vertCount;
    for (let aIdx = 0; aIdx < activeCount; aIdx++) {
      const f = activeTris[aIdx] * 3;
      const i0 = faces[f];
      const i1 = faces[f + 1];
      const i2 = faces[f + 2];
      const m01 = testEdge(i0, i1, false);
      const m12 = testEdge(i1, i2, false);
      const m20 = testEdge(i2, i0, false);
      if (m01 >= 0 || m12 >= 0 || m20 >= 0) {
        continue;
      }
      // Only sample centroid if no edge split (catches isolated peaks strictly inside a triangle)
      const cLon = (xy[i0 * 2] + xy[i1 * 2] + xy[i2 * 2]) / 3;
      const cLat = (xy[i0 * 2 + 1] + xy[i1 * 2 + 1] + xy[i2 * 2 + 1]) / 3;
      if (sampleGroundZ(cLon, cLat) - (gnds[i0] + gnds[i1] + gnds[i2]) / 3 > tau) {
        testEdge(i0, i1, true);
        testEdge(i1, i2, true);
        testEdge(i2, i0, true);
      }
    }
    const addedVerts = vertCount - prevVertCount;
    if (addedVerts === 0) {
      break;
    }

    // By Euler's formula in a 2D triangulation, each split interior edge adds at most 2 triangles (6 indices)
    const isLastPass = pass === maxPasses - 1;
    const nextFaces = new Uint32Array(faceLen + addedVerts * 6);
    const nextActive = isLastPass ? activeTris : new Uint32Array(addedVerts * 4);
    let nextFaceLen = 0;
    let nextActiveCount = 0;

    const emitActive = (a: number, b: number, c: number) => {
      if (!isLastPass) {
        nextActive[nextActiveCount++] = nextFaceLen / 3;
      }
      nextFaces[nextFaceLen++] = a;
      nextFaces[nextFaceLen++] = b;
      nextFaces[nextFaceLen++] = c;
    };

    const emitTwoSplit = (a: number, b: number, c: number, mab: number, mbc: number) => {
      emitActive(mab, b, mbc);
      emitActive(a, mab, mbc);
      emitActive(a, mbc, c);
    };

    for (let f = 0; f < faceLen; f += 3) {
      const i0 = faces[f];
      const i1 = faces[f + 1];
      const i2 = faces[f + 2];
      const m01 = edgeMidpoint.get(edgeKey(i0, i1)) ?? -1;
      const m12 = edgeMidpoint.get(edgeKey(i1, i2)) ?? -1;
      const m20 = edgeMidpoint.get(edgeKey(i2, i0)) ?? -1;
      const count = (m01 >= 0 ? 1 : 0) + (m12 >= 0 ? 1 : 0) + (m20 >= 0 ? 1 : 0);

      if (count === 0) {
        nextFaces[nextFaceLen++] = i0;
        nextFaces[nextFaceLen++] = i1;
        nextFaces[nextFaceLen++] = i2;
      } else if (count === 1) {
        if (m01 >= 0) {
          emitActive(i0, m01, i2);
          emitActive(m01, i1, i2);
        } else if (m12 >= 0) {
          emitActive(i1, m12, i0);
          emitActive(m12, i2, i0);
        } else {
          emitActive(i2, m20, i1);
          emitActive(m20, i0, i1);
        }
      } else if (count === 2) {
        if (m20 < 0) emitTwoSplit(i0, i1, i2, m01, m12);
        else if (m01 < 0) emitTwoSplit(i1, i2, i0, m12, m20);
        else emitTwoSplit(i2, i0, i1, m20, m01);
      } else {
        emitActive(i0, m01, m20);
        emitActive(m01, i1, m12);
        emitActive(m20, m12, i2);
        emitActive(m01, m12, m20);
      }
    }

    faces = nextFaces;
    faceLen = nextFaceLen;
    activeTris = nextActive;
    activeCount = nextActiveCount;
  }

  if (vertCount === initVerts) {
    return { tri, gnds: gnds.subarray(0, vertCount) };
  }

  return {
    tri: { xy: xy.subarray(0, vertCount * 2), faces: faces.subarray(0, faceLen), boundarySegments },
    gnds: gnds.subarray(0, vertCount),
  };
}

function writeCap(
  positions: Float64Array,
  faces: Uint32Array,
  vCursor: number,
  fCursor: number,
  tri: Triangulated2D,
  computeZ: (index: number) => number,
): void {
  const baseVertex = vCursor;
  const numVertices = tri.xy.length / 2;
  for (let i = 0; i < numVertices; i++) {
    const p = (vCursor + i) * 3;
    positions[p] = tri.xy[i * 2];
    positions[p + 1] = tri.xy[i * 2 + 1];
    positions[p + 2] = computeZ(i);
  }
  for (let i = 0; i < tri.faces.length; i++) {
    faces[fCursor + i] = baseVertex + tri.faces[i];
  }
}

/**
 * Synchronously extrudes a cached 2D {@link AirspaceFootprint} into raw 3D vertex and index buffers.
 */
export function extrudeAirspaceFootprint(
  footprint: AirspaceFootprint,
  airspace: AirspaceTyped,
  multiplier: number,
  sampleGroundZ: GroundSampler,
): AirspaceMeshData | null {
  const floorOffset = airspace.floorM * multiplier;
  const topOffset = airspace.topM * multiplier;
  const sinkZeroFloor = airspace.floorRefGnd && airspace.floorM === 0;
  const hasGroundRef = airspace.floorRefGnd || airspace.topRefGnd;
  const needFloorCap = !sinkZeroFloor;

  const clearanceM = computeMinimumAglClearanceM(airspace);
  let terrainGnds: Float64Array | undefined;
  let terrainTri = footprint.terrainCap;
  if (terrainTri && (airspace.topRefGnd || (needFloorCap && airspace.floorRefGnd))) {
    const maxPasses = footprint.lod === 0 ? 0 : RIDGE_REFINE_MAX_PASSES;
    const refined = refineTerrainCapForRidges(terrainTri, clearanceM ?? 300, multiplier, sampleGroundZ, maxPasses);
    terrainTri = refined.tri;
    terrainGnds = refined.gnds;
  }

  const topTri = airspace.topRefGnd ? terrainTri : footprint.flatCap;
  const floorTri = needFloorCap ? (airspace.floorRefGnd ? terrainTri : footprint.flatCap) : undefined;

  let wallVertices = 0;
  let wallIndices = 0;
  for (const ring of footprint.wallRings) {
    if (ring.length >= 3) {
      wallVertices += ring.length * 2;
      wallIndices += (ring.length - 1) * 6;
    }
  }

  const totalVertices = wallVertices + (topTri ? topTri.xy.length / 2 : 0) + (floorTri ? floorTri.xy.length / 2 : 0);
  const totalIndices = wallIndices + (topTri ? topTri.faces.length : 0) + (floorTri ? floorTri.faces.length : 0);
  if (totalVertices === 0 || totalIndices === 0) {
    return null;
  }

  const positions = new Float64Array(totalVertices * 3);
  const faces = new Uint32Array(totalIndices);
  const contourPaths: number[][][] = [];
  let vCursor = 0;
  let fCursor = 0;

  for (const ring of footprint.wallRings) {
    if (ring.length < 3) {
      continue;
    }
    const ringBase = vCursor;
    const topPath: number[][] = [];
    const floorPath: number[][] = [];
    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i];
      // Sample exaggerated terrain elevation once per vertex when any boundary is ground-referenced.
      const gnd = hasGroundRef ? sampleGroundZ(lon, lat) : 0;
      const rawTop = (airspace.topRefGnd ? gnd : 0) + topOffset;
      const rawFloor = (airspace.floorRefGnd ? gnd : 0) + floorOffset;

      // 1. Ceiling clamping: AGL ceilings follow terrain; MSL ceilings are flat horizontal planes.
      const topZ = airspace.topRefGnd ? Math.max(rawTop, rawFloor) : rawTop;

      // 2. Mountain pinch clamping: For flat ceilings (MSL) with elevated AGL floors, terrain peaks
      // can rise higher than the ceiling. Clamping nominalFloor to topZ pinches the volume closed
      // against the terrain rather than letting an inverted floor float above the ceiling.
      const nominalFloor = airspace.topRefGnd ? rawFloor : Math.min(rawFloor, topZ);

      // 3. Subsurface skirt sinking: Airspaces starting at GND sink their wall base 250m into the
      // terrain, preventing z-fighting against terrain DEM meshes and eliminating redundant bottom caps.
      const bottomZ = sinkZeroFloor && topZ > nominalFloor ? nominalFloor - GND_BASE_SINK_M * multiplier : nominalFloor;

      const p = vCursor * 3;
      positions[p] = lon;
      positions[p + 1] = lat;
      positions[p + 2] = bottomZ;
      positions[p + 3] = lon;
      positions[p + 4] = lat;
      positions[p + 5] = topZ;
      vCursor += 2;

      topPath.push([lon, lat, topZ]);
      floorPath.push([lon, lat, nominalFloor + (sinkZeroFloor ? 2 : 0)]);
    }
    if (topPath.length >= 2) {
      contourPaths.push(topPath);
    }
    if (floorPath.length >= 2 && Math.abs(topOffset - floorOffset) > 0.1) {
      contourPaths.push(floorPath);
    }
    for (let i = 0; i < ring.length - 1; i++) {
      const b0 = ringBase + i * 2;
      const t0 = b0 + 1;
      const b1 = b0 + 2;
      const t1 = b0 + 3;
      faces[fCursor++] = b0;
      faces[fCursor++] = b1;
      faces[fCursor++] = t1;
      faces[fCursor++] = b0;
      faces[fCursor++] = t1;
      faces[fCursor++] = t0;
    }
  }

  if (topTri && floorTri && topTri === floorTri) {
    // Both caps share identical 2D topology (MSL-MSL or GND-GND): emit both layers in one pass so ground is sampled once.
    const capVertices = topTri.xy.length / 2;
    const topBase = vCursor;
    const floorBase = vCursor + capVertices;
    for (let i = 0; i < capVertices; i++) {
      const lon = topTri.xy[i * 2];
      const lat = topTri.xy[i * 2 + 1];
      const gnd = terrainGnds ? terrainGnds[i] : 0;
      const tp = (topBase + i) * 3;
      positions[tp] = lon;
      positions[tp + 1] = lat;
      positions[tp + 2] = gnd + topOffset;
      const fp = (floorBase + i) * 3;
      positions[fp] = lon;
      positions[fp + 1] = lat;
      positions[fp + 2] = gnd + floorOffset;
    }
    const faceCount = topTri.faces.length;
    for (let i = 0; i < faceCount; i++) {
      const idx = topTri.faces[i];
      faces[fCursor + i] = topBase + idx;
      faces[fCursor + faceCount + i] = floorBase + idx;
    }
  } else {
    if (topTri) {
      writeCap(positions, faces, vCursor, fCursor, topTri, (idx) => {
        if (!airspace.topRefGnd) {
          return topOffset;
        }
        const z = terrainGnds![idx] + topOffset;
        return airspace.floorRefGnd ? z : Math.max(z, floorOffset);
      });
      vCursor += topTri.xy.length / 2;
      fCursor += topTri.faces.length;
    }
    if (floorTri) {
      writeCap(positions, faces, vCursor, fCursor, floorTri, (idx) => {
        if (!airspace.floorRefGnd) {
          return floorOffset;
        }
        const z = terrainGnds![idx] + floorOffset;
        return airspace.topRefGnd ? z : Math.min(z, topOffset);
      });
    }
  }

  return { positions, faces, contourPaths };
}

/**
 * Merges multiple raw {@link AirspaceMeshData} contour line paths into a single path array for a 3D Polyline.
 */
export function mergeContourPaths(parts: AirspaceMeshData[]): number[][][] {
  const merged: number[][][] = [];
  for (const part of parts) {
    if (part.contourPaths) {
      for (const path of part.contourPaths) {
        if (path.length >= 2) {
          merged.push(path);
        }
      }
    }
  }
  return merged;
}

/**
 * Builds raw 3D vertex positions and triangle indices for an airspace polygon in WGS84.
 */
export async function buildAirspaceMeshData({
  polygon,
  airspace,
  multiplier,
  sampleGroundZ,
}: AirspaceMeshParams): Promise<AirspaceMeshData | null> {
  const footprint = await buildAirspaceFootprint(polygon, airspace);
  return footprint ? extrudeAirspaceFootprint(footprint, airspace, multiplier, sampleGroundZ) : null;
}

/**
 * Creates an ArcGIS {@link Mesh} geometry from 3D vertex positions and face indices.
 */
export function createMesh(positions: Float64Array, faces: Uint32Array): Mesh {
  return new Mesh({
    spatialReference: { wkid: 4326 },
    vertexSpace: sharedVertexSpace,
    vertexAttributes: { position: positions as Float64Array<ArrayBuffer> },
    components: [
      {
        faces: faces as Uint32Array<ArrayBuffer>,
        shading: 'flat',
        material: sharedMeshMaterial,
      },
    ],
  });
}

/**
 * Merges multiple raw {@link AirspaceMeshData} buffers into a single ArcGIS {@link Mesh}.
 */
export function mergeMeshData(parts: AirspaceMeshData[]): Mesh | null {
  if (parts.length === 0) {
    return null;
  }
  if (parts.length === 1) {
    const part = parts[0];
    return part.positions.length > 0 && part.faces.length > 0 ? createMesh(part.positions, part.faces) : null;
  }

  let totalPos = 0;
  let totalFaces = 0;
  for (const part of parts) {
    totalPos += part.positions.length;
    totalFaces += part.faces.length;
  }
  if (totalPos === 0 || totalFaces === 0) {
    return null;
  }

  const positions = new Float64Array(totalPos);
  const faces = new Uint32Array(totalFaces);
  let posOffset = 0;
  let faceOffset = 0;

  for (const part of parts) {
    const baseVertex = posOffset / 3;
    positions.set(part.positions, posOffset);
    const srcFaces = part.faces;
    for (let i = 0; i < srcFaces.length; i++) {
      faces[faceOffset + i] = baseVertex + srcFaces[i];
    }
    posOffset += part.positions.length;
    faceOffset += srcFaces.length;
  }

  return createMesh(positions, faces);
}

/**
 * Builds a closed (or terrain-anchored) 3D {@link Mesh} for an airspace polygon in WGS84.
 */
export async function buildAirspaceMesh(params: AirspaceMeshParams): Promise<Mesh | null> {
  const data = await buildAirspaceMeshData(params);
  return data ? mergeMeshData([data]) : null;
}
