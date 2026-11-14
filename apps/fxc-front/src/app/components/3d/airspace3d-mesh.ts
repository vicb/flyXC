import Mesh from '@arcgis/core/geometry/Mesh';
import MeshGeoreferencedVertexSpace from '@arcgis/core/geometry/support/MeshGeoreferencedVertexSpace';
// @ts-expect-error Internal ArcGIS 2D earcut tessellation utilities without type declarations
import * as tess from '@arcgis/core/views/3d/layers/graphics/tessellationUtils.js';
import type { AirspaceTyped } from '@flyxc/common';

const METERS_PER_DEGREE_LAT = 111_320;
const MIN_DENSIFY_STEP_M = 1000;
const TARGET_DENSIFY_SEGMENTS = 48;
const TARGET_GRID_CELL_M = 1500;
const MAX_SUBDIVIDE_PASSES = 4;
const GND_BASE_SINK_M = 50;

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
 * Raw 3D vertex coordinates and triangle indices before combining into an ArcGIS Mesh.
 */
export interface AirspaceMeshData {
  positions: Float64Array;
  faces: Uint32Array;
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
  wallRings: number[][][];
  flatCap?: Triangulated2D;
  terrainCap?: Triangulated2D;
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
    const out: number[][] = [[ring[0][0], ring[0][1]]];
    for (let i = 1; i < ring.length; i++) {
      const [lon0, lat0] = out[out.length - 1];
      const [lon1, lat1] = ring[i];
      if (lon0 === lon1 && lat0 === lat1) {
        continue;
      }
      if (stepM != null) {
        const cosLat = Math.max(0.1, Math.cos(((lat0 + lat1) * 0.5 * Math.PI) / 180));
        const segLenM = Math.hypot(
          (lon1 - lon0) * METERS_PER_DEGREE_LAT * cosLat,
          (lat1 - lat0) * METERS_PER_DEGREE_LAT,
        );
        const steps = Math.max(1, Math.ceil(segLenM / stepM));
        for (let k = 1; k < steps; k++) {
          const t = k / steps;
          out.push([lon0 + (lon1 - lon0) * t, lat0 + (lat1 - lat0) * t]);
        }
      }
      out.push([lon1, lat1]);
    }
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

function subdivideTriangulation2D(tri: Triangulated2D, midLat: number, maxEdgeM: number): Triangulated2D {
  if (tri.faces.length === 0) {
    return tri;
  }

  const cosLat = Math.max(0.1, Math.cos((midLat * Math.PI) / 180));
  const scaleLon = METERS_PER_DEGREE_LAT * cosLat;
  const scaleLat = METERS_PER_DEGREE_LAT;
  const maxLen2 = maxEdgeM * maxEdgeM;

  const xy = Array.from(tri.xy);
  let faces = Array.from(tri.faces);

  for (let pass = 0; pass < MAX_SUBDIVIDE_PASSES; pass++) {
    const midCache = new Map<number, number>();
    const nextFaces: number[] = [];
    let splitAny = false;

    const getMid = (a: number, b: number): number => {
      const lo = a < b ? a : b;
      const hi = a < b ? b : a;
      const key = lo * 16_777_216 + hi;
      let idx = midCache.get(key);
      if (idx === undefined) {
        idx = xy.length / 2;
        xy.push((xy[a * 2] + xy[b * 2]) * 0.5, (xy[a * 2 + 1] + xy[b * 2 + 1]) * 0.5);
        midCache.set(key, idx);
      }
      return idx;
    };

    const edgeLen2 = (a: number, b: number): number => {
      const dx = (xy[a * 2] - xy[b * 2]) * scaleLon;
      const dy = (xy[a * 2 + 1] - xy[b * 2 + 1]) * scaleLat;
      return dx * dx + dy * dy;
    };

    for (let i = 0; i < faces.length; i += 3) {
      const a = faces[i];
      const b = faces[i + 1];
      const c = faces[i + 2];
      const s0 = edgeLen2(a, b) > maxLen2;
      const s1 = edgeLen2(b, c) > maxLen2;
      const s2 = edgeLen2(c, a) > maxLen2;
      const count = (s0 ? 1 : 0) + (s1 ? 1 : 0) + (s2 ? 1 : 0);

      if (count === 0) {
        nextFaces.push(a, b, c);
        continue;
      }
      splitAny = true;

      if (count === 3) {
        const mab = getMid(a, b);
        const mbc = getMid(b, c);
        const mca = getMid(c, a);
        nextFaces.push(a, mab, mca, mab, b, mbc, mca, mbc, c, mab, mbc, mca);
      } else if (count === 1) {
        const [u, v, w] = s0 ? [a, b, c] : s1 ? [b, c, a] : [c, a, b];
        const m = getMid(u, v);
        nextFaces.push(u, m, w, m, v, w);
      } else {
        // Rotate so the unsplit edge is (w, u) and preserve triangle winding order.
        const [u, v, w] = !s2 ? [a, b, c] : !s0 ? [b, c, a] : [c, a, b];
        const m1 = getMid(u, v);
        const m2 = getMid(v, w);
        nextFaces.push(u, m1, w, m1, v, m2, m1, m2, w);
      }
    }

    faces = nextFaces;
    if (!splitAny) {
      break;
    }
  }

  return { xy: new Float64Array(xy), faces: new Uint32Array(faces) };
}

/**
 * Triangulates a 2D polygon and subdivides long interior edges so ground-referenced caps follow terrain relief.
 */
function triangulateTerrainCap2D(rings: number[][][], extent: AirspaceExtentLike, stepM?: number): Triangulated2D {
  const base = triangulateRings2D(rings);
  const { widthM, heightM } = estimateExtentMeters(extent);
  const maxEdgeM = Math.max(TARGET_GRID_CELL_M, stepM ?? TARGET_GRID_CELL_M) * 1.05;
  if (widthM <= maxEdgeM && heightM <= maxEdgeM) {
    return base;
  }
  const midLat = (extent.ymin + extent.ymax) / 2;
  return subdivideTriangulation2D(base, midLat, maxEdgeM);
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
 * Builds the 2D wall rings and cap triangulations for an airspace polygon so later
 * exaggeration and terrain updates can re-extrude synchronously without re-triangulating.
 */
export async function buildAirspaceFootprint(
  polygon: AirspacePolygonLike,
  airspace: Pick<AirspaceTyped, 'floorM' | 'floorRefGnd' | 'topRefGnd'>,
): Promise<AirspaceFootprint | null> {
  if (polygon.rings.length === 0 || !polygon.extent) {
    return null;
  }

  const hasGroundRef = airspace.floorRefGnd || airspace.topRefGnd;
  let stepM: number | undefined;
  if (hasGroundRef) {
    const { widthM, heightM } = estimateExtentMeters(polygon.extent);
    stepM = Math.max(MIN_DENSIFY_STEP_M, Math.hypot(widthM, heightM) / TARGET_DENSIFY_SEGMENTS);
  }

  const wallRings = prepareWallRings(polygon.rings, stepM);
  if (wallRings.length === 0) {
    return null;
  }

  const needFloorCap = !(airspace.floorRefGnd && airspace.floorM === 0);
  const needFlatCap = !airspace.topRefGnd || (needFloorCap && !airspace.floorRefGnd);
  const needTerrainCap = airspace.topRefGnd || (needFloorCap && airspace.floorRefGnd);

  const flatCap = needFlatCap ? triangulateRings2D(polygon.rings) : undefined;
  const terrainCap = needTerrainCap ? triangulateTerrainCap2D(wallRings, polygon.extent, stepM) : undefined;

  return { wallRings, flatCap, terrainCap };
}

function writeCap(
  positions: Float64Array,
  faces: Uint32Array,
  vCursor: number,
  fCursor: number,
  tri: Triangulated2D,
  computeZ: (lon: number, lat: number) => number,
): void {
  const baseVertex = vCursor;
  const numVertices = tri.xy.length / 2;
  for (let i = 0; i < numVertices; i++) {
    const lon = tri.xy[i * 2];
    const lat = tri.xy[i * 2 + 1];
    const p = (vCursor + i) * 3;
    positions[p] = lon;
    positions[p + 1] = lat;
    positions[p + 2] = computeZ(lon, lat);
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

  const topTri = airspace.topRefGnd ? footprint.terrainCap : footprint.flatCap;
  const floorTri = needFloorCap ? (airspace.floorRefGnd ? footprint.terrainCap : footprint.flatCap) : undefined;

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
  let vCursor = 0;
  let fCursor = 0;

  for (const ring of footprint.wallRings) {
    if (ring.length < 3) {
      continue;
    }
    const ringBase = vCursor;
    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i];
      const gnd = hasGroundRef ? sampleGroundZ(lon, lat) : 0;
      const nominalFloor = (airspace.floorRefGnd ? gnd : 0) + floorOffset;
      const topZ = Math.max((airspace.topRefGnd ? gnd : 0) + topOffset, nominalFloor);
      const bottomZ = sinkZeroFloor && topZ > nominalFloor ? nominalFloor - GND_BASE_SINK_M * multiplier : nominalFloor;

      const p = vCursor * 3;
      positions[p] = lon;
      positions[p + 1] = lat;
      positions[p + 2] = bottomZ;
      positions[p + 3] = lon;
      positions[p + 4] = lat;
      positions[p + 5] = topZ;
      vCursor += 2;
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
    const sampleCapGround = airspace.topRefGnd;
    for (let i = 0; i < capVertices; i++) {
      const lon = topTri.xy[i * 2];
      const lat = topTri.xy[i * 2 + 1];
      const gnd = sampleCapGround ? sampleGroundZ(lon, lat) : 0;
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
      writeCap(positions, faces, vCursor, fCursor, topTri, (lon, lat) => {
        if (!airspace.topRefGnd) {
          return topOffset;
        }
        const z = sampleGroundZ(lon, lat) + topOffset;
        return airspace.floorRefGnd ? z : Math.max(z, floorOffset);
      });
      vCursor += topTri.xy.length / 2;
      fCursor += topTri.faces.length;
    }
    if (floorTri) {
      writeCap(positions, faces, vCursor, fCursor, floorTri, (lon, lat) => {
        if (!airspace.floorRefGnd) {
          return floorOffset;
        }
        const z = sampleGroundZ(lon, lat) + floorOffset;
        return airspace.topRefGnd ? z : Math.min(z, topOffset);
      });
    }
  }

  return { positions, faces };
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

function createMesh(positions: Float64Array, faces: Uint32Array): Mesh {
  return new Mesh({
    spatialReference: { wkid: 4326 },
    vertexSpace: new MeshGeoreferencedVertexSpace(),
    vertexAttributes: { position: positions as Float64Array<ArrayBuffer> },
    components: [
      {
        faces: faces as Uint32Array<ArrayBuffer>,
        shading: 'flat',
        material: {
          color: [255, 255, 255, 1],
          alphaMode: 'blend',
          doubleSided: true,
        },
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
