import Mesh from '@arcgis/core/geometry/Mesh';
import MeshGeoreferencedVertexSpace from '@arcgis/core/geometry/support/MeshGeoreferencedVertexSpace';
import { type AirspaceTyped, clamp, type FlatRings, METERS_PER_DEG_LAT } from '@flyxc/common';

import {
  type AirspaceFootprint,
  type AirspacePolygonLike,
  buildAirspaceFootprint,
  type BuildFootprintOptions,
  computeMinimumAglClearanceM,
  computeTargetGridM,
  packEdgeKey,
  triangulateCapWithGrid2D,
  type Triangulated2D,
} from './airspace3d-footprint';

export type { AirspaceFootprint, AirspacePolygonLike, BuildFootprintOptions, FlatRings, Triangulated2D };
export { buildAirspaceFootprint, computeMinimumAglClearanceM, computeTargetGridM, triangulateCapWithGrid2D };

const GND_BASE_SINK_M = 250;

/**
 * Synchronous terrain elevation sampler returning exaggerated ground elevation in meters at `(lon, lat)`.
 */
export type GroundSampler = (lon: number, lat: number) => number;

/**
 * Raw 3D vertex coordinates, triangle indices, and optional perimeter contour lines before combining into an ArcGIS Mesh.
 */
export interface AirspaceMeshData {
  positions: Float64Array;
  faces: Uint32Array;
  contourPaths?: number[][][];
}

const sharedVertexSpace = new MeshGeoreferencedVertexSpace();
const sharedMeshMaterial = {
  color: [255, 255, 255, 1] as [number, number, number, number],
  alphaMode: 'blend' as const,
  doubleSided: true,
  unlit: true,
};

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

  if (polygon.ends.length > 0) {
    const end0 = polygon.ends[0];
    const numPoints = end0 >> 1;
    if (numPoints > 0) {
      const step = Math.max(1, Math.floor(numPoints / 4));
      for (let i = 0; i < end0; i += step * 2) {
        sum += Math.round(sampleGroundZ(polygon.coords[i], polygon.coords[i + 1]) / 2) * weight++;
      }
    }
  }
  return sum;
}

const RIDGE_REFINE_MAX_PASSES = 3;
const RIDGE_REFINE_MIN_EDGE_M2 = 180 * 180;

/**
 * Builds a fast lookup set of packed edge keys for perimeter wall edges in flat rings.
 * Constructed on-demand during terrain ridge refinement to prevent subdividing boundary edges
 * without having to store or serialize Set<number> in footprints or across postMessage.
 */
export function buildBoundarySegmentSet(wallRings: FlatRings): Set<number> {
  const { coords: wallCoords, ends } = wallRings;
  const numRings = ends.length;
  const boundarySegments = new Set<number>();
  let baseIdx = 0;
  let start = 0;
  for (let r = 0; r < numRings; r++) {
    const end = ends[r];
    let count = (end - start) >> 1;
    if (count > 1 && wallCoords[start] === wallCoords[end - 2] && wallCoords[start + 1] === wallCoords[end - 1]) {
      count--;
    }
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      boundarySegments.add(packEdgeKey(baseIdx + i, baseIdx + next));
    }
    baseIdx += count;
    start = end;
  }
  return boundarySegments;
}

/**
 * Refines a terrain-cap triangulation via conforming (Red-Green) active-set subdivision
 * wherever terrain ridges protrude upward through an edge midpoint or triangle centroid.
 *
 * Uses an interleaved `xy` `Float64Array`, exact Euler-bounded face buffers (`faceLen + addedVerts * 6`),
 * and primitive `Map<number, number>` edge entries to minimize CPU, memory, and GC pressure.
 * Perimeter edges are reconstructed on-demand from wall rings and are never split so caps stay flush with vertical walls.
 */
function refineTerrainCapForRidges(
  tri: Triangulated2D,
  wallRings: FlatRings,
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
  let vertCap = initVerts;
  let xy = tri.xy;
  let gnds = new Float64Array(initVerts);
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
  const mPerDegLon = METERS_PER_DEG_LAT * cosLat;
  const tau = clamp(clearanceM * 0.3, 35, 100) * multiplier;
  const boundarySegments = buildBoundarySegmentSet(wallRings);
  // Value >= 0: split vertex index; -1: tested and unsplit (cached across passes)
  const edgeMidpoint = new Map<number, number>();

  const addVertex = (lon: number, lat: number, gnd: number): number => {
    if (vertCount === vertCap) {
      vertCap = Math.max(vertCap * 2, vertCap + 64);
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
    const key = packEdgeKey(a, b);
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
    const dy = (latB - latA) * METERS_PER_DEG_LAT;
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

    const emitOneSplit = (a: number, b: number, c: number, mab: number) => {
      emitActive(a, mab, c);
      emitActive(mab, b, c);
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
      const m01 = edgeMidpoint.get(packEdgeKey(i0, i1)) ?? -1;
      const m12 = edgeMidpoint.get(packEdgeKey(i1, i2)) ?? -1;
      const m20 = edgeMidpoint.get(packEdgeKey(i2, i0)) ?? -1;
      const count = (m01 >= 0 ? 1 : 0) + (m12 >= 0 ? 1 : 0) + (m20 >= 0 ? 1 : 0);

      if (count === 0) {
        nextFaces[nextFaceLen++] = i0;
        nextFaces[nextFaceLen++] = i1;
        nextFaces[nextFaceLen++] = i2;
      } else if (count === 1) {
        if (m01 >= 0) emitOneSplit(i0, i1, i2, m01);
        else if (m12 >= 0) emitOneSplit(i1, i2, i0, m12);
        else emitOneSplit(i2, i0, i1, m20);
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
    return { tri, gnds };
  }

  return {
    tri: { xy: xy.subarray(0, vertCount * 2), faces: faces.subarray(0, faceLen) },
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

export interface ExtrudeAirspaceFootprintOptions {
  /** Maximum passes of adaptive ridge refinement. Defaults to RIDGE_REFINE_MAX_PASSES (3). Pass 0 to skip. */
  maxRidgePasses?: number;
  /** Whether to omit perimeter contour outline paths for distant airspaces to save line tessellation overhead. */
  skipContours?: boolean;
}

/**
 * Synchronously extrudes a cached 2D {@link AirspaceFootprint} into raw 3D vertex and index buffers.
 */
export function extrudeAirspaceFootprint(
  footprint: AirspaceFootprint,
  airspace: AirspaceTyped,
  multiplier: number,
  sampleGroundZ: GroundSampler,
  options?: ExtrudeAirspaceFootprintOptions,
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
    const configuredPasses = options?.maxRidgePasses ?? RIDGE_REFINE_MAX_PASSES;
    const maxPasses = footprint.lod === 0 ? 0 : configuredPasses;
    const refined = refineTerrainCapForRidges(
      terrainTri,
      footprint.wallRings,
      clearanceM ?? 300,
      multiplier,
      sampleGroundZ,
      maxPasses,
    );
    terrainTri = refined.tri;
    terrainGnds = refined.gnds;
  }

  const topTri = airspace.topRefGnd ? terrainTri : footprint.flatCap;
  const floorTri = needFloorCap ? (airspace.floorRefGnd ? terrainTri : footprint.flatCap) : undefined;

  const { coords, ends } = footprint.wallRings;
  const numRings = ends.length;

  let wallVertices = 0;
  let wallIndices = 0;
  let start = 0;
  for (let r = 0; r < numRings; r++) {
    const end = ends[r];
    const count = (end - start) >> 1;
    if (count >= 3) {
      wallVertices += count * 2;
      wallIndices += (count - 1) * 6;
    }
    start = end;
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

  start = 0;
  for (let r = 0; r < numRings; r++) {
    const end = ends[r];
    const count = (end - start) >> 1;
    if (count < 3) {
      start = end;
      continue;
    }
    const ringBase = vCursor;
    const topPath: number[][] = [];
    const floorPath: number[][] = [];
    for (let i = start; i < end; i += 2) {
      const lon = coords[i];
      const lat = coords[i + 1];
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

      if (!options?.skipContours) {
        topPath.push([lon, lat, topZ]);
        floorPath.push([lon, lat, nominalFloor + (sinkZeroFloor ? 2 : 0)]);
      }
    }
    if (!options?.skipContours) {
      if (topPath.length >= 2) {
        contourPaths.push(topPath);
      }
      if (floorPath.length >= 2 && Math.abs(topOffset - floorOffset) > 0.1) {
        contourPaths.push(floorPath);
      }
    }
    for (let i = 0; i < count - 1; i++) {
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
    start = end;
  }

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
