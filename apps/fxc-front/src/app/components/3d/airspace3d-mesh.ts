import Extent from '@arcgis/core/geometry/Extent';
import Mesh from '@arcgis/core/geometry/Mesh';
import { clipExecute } from '@arcgis/core/geometry/operators/clipOperator';
import Polygon from '@arcgis/core/geometry/Polygon';
import MeshGeoreferencedVertexSpace from '@arcgis/core/geometry/support/MeshGeoreferencedVertexSpace';
import * as meshUtils from '@arcgis/core/geometry/support/meshUtils';
import type { AirspaceTyped } from '@flyxc/common';

const METERS_PER_DEGREE_LAT = 111_320;
const MIN_DENSIFY_STEP_M = 1000;
const TARGET_DENSIFY_SEGMENTS = 48;
const TARGET_GRID_CELL_M = 1500;
const MAX_GRID_DIVS = 6;
const GND_BASE_SINK_M = 50;

/**
 * Synchronous terrain elevation sampler returning exaggerated ground elevation in meters at `(lon, lat)`.
 */
export type GroundSampler = (lon: number, lat: number) => number;

/**
 * Input parameters for building a 3D airspace mesh.
 */
export interface AirspaceMeshParams {
  polygon: Polygon;
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
  xy: number[];
  faces: number[];
}

/**
 * Cached 2D geometry and triangulated caps for an airspace polygon, independent of altitude exaggeration or terrain.
 */
export interface AirspaceFootprint {
  wallRings: number[][][];
  flatCap?: Triangulated2D;
  terrainCap?: Triangulated2D;
}

function estimateExtentMeters(extent: Extent): { widthM: number; heightM: number } {
  const midLat = (extent.ymin + extent.ymax) / 2;
  const cosLat = Math.max(0.1, Math.cos((midLat * Math.PI) / 180));
  return {
    widthM: extent.width * METERS_PER_DEGREE_LAT * cosLat,
    heightM: extent.height * METERS_PER_DEGREE_LAT,
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

function appendMesh2D(mesh: Mesh | null | undefined, xy: number[], faces: number[]): boolean {
  const srcPos = mesh?.vertexAttributes?.position;
  const srcFaces = mesh?.components?.[0]?.faces;
  if (!srcPos || !srcFaces || srcFaces.length === 0) {
    return false;
  }
  const base = xy.length / 2;
  for (let i = 0; i < srcPos.length; i += 3) {
    xy.push(srcPos[i], srcPos[i + 1]);
  }
  for (let i = 0; i < srcFaces.length; i++) {
    faces.push(base + srcFaces[i]);
  }
  return true;
}

async function polygonTo2D(polygon: Polygon): Promise<Triangulated2D> {
  const tri: Triangulated2D = { xy: [], faces: [] };
  appendMesh2D(await meshUtils.createFromPolygon(polygon), tri.xy, tri.faces);
  return tri;
}

function isFullCell(clipped: Polygon, dx: number, dy: number): boolean {
  const ext = clipped.extent;
  return (
    ext != null &&
    clipped.rings.length === 1 &&
    clipped.rings[0].length === 5 &&
    Math.abs(ext.width - dx) < 1e-8 &&
    Math.abs(ext.height - dy) < 1e-8
  );
}

/**
 * Triangulates a 2D polygon over an adaptive grid so ground-referenced caps follow terrain relief.
 */
async function triangulateTerrainCap2D(polygon: Polygon): Promise<Triangulated2D> {
  const extent = polygon.extent;
  if (!extent) {
    return { xy: [], faces: [] };
  }

  const { widthM, heightM } = estimateExtentMeters(extent);
  const nx = Math.min(MAX_GRID_DIVS, Math.max(1, Math.ceil(widthM / TARGET_GRID_CELL_M)));
  const ny = Math.min(MAX_GRID_DIVS, Math.max(1, Math.ceil(heightM / TARGET_GRID_CELL_M)));

  if (nx === 1 && ny === 1) {
    return polygonTo2D(polygon);
  }

  const xy: number[] = [];
  const faces: number[] = [];
  const dx = extent.width / nx;
  const dy = extent.height / ny;
  const boundaryCells: Polygon[] = [];

  for (let ix = 0; ix < nx; ix++) {
    const x0 = extent.xmin + ix * dx;
    const x1 = ix === nx - 1 ? extent.xmax : extent.xmin + (ix + 1) * dx;
    for (let iy = 0; iy < ny; iy++) {
      const y0 = extent.ymin + iy * dy;
      const y1 = iy === ny - 1 ? extent.ymax : extent.ymin + (iy + 1) * dy;
      const clipped = clipExecute(
        polygon,
        new Extent({ xmin: x0, ymin: y0, xmax: x1, ymax: y1, spatialReference: polygon.spatialReference }),
      );
      if (!clipped || clipped.type !== 'polygon' || clipped.rings.length === 0) {
        continue;
      }
      if (isFullCell(clipped, x1 - x0, y1 - y0)) {
        const base = xy.length / 2;
        xy.push(x0, y0, x1, y0, x1, y1, x0, y1);
        faces.push(base, base + 1, base + 2, base, base + 2, base + 3);
      } else {
        boundaryCells.push(clipped);
      }
    }
  }

  if (boundaryCells.length === 1) {
    appendMesh2D(await meshUtils.createFromPolygon(boundaryCells[0]), xy, faces);
  } else if (boundaryCells.length > 1) {
    // Batch all clipped boundary cells into one createFromPolygon call; fall back per-cell if ArcGIS rejects touching rings.
    const combined = new Polygon({
      rings: boundaryCells.flatMap((c) => c.rings),
      spatialReference: polygon.spatialReference,
    });
    let ok: boolean;
    try {
      ok = appendMesh2D(await meshUtils.createFromPolygon(combined), xy, faces);
    } catch {
      ok = false;
    }
    if (!ok) {
      const meshes = await Promise.all(boundaryCells.map((cell) => meshUtils.createFromPolygon(cell)));
      for (const cellMesh of meshes) {
        appendMesh2D(cellMesh, xy, faces);
      }
    }
  }

  return { xy, faces };
}

/**
 * Computes a fast ground-elevation checksum at representative points of a polygon so
 * terrain updates that do not meaningfully affect this airspace can be skipped.
 */
export function computeGroundSignature(polygon: Polygon, sampleGroundZ: GroundSampler): number {
  const extent = polygon.extent;
  if (!extent) {
    return 0;
  }
  const pts: Array<[number, number]> = [
    [
      extent.center.longitude ?? (extent.xmin + extent.xmax) / 2,
      extent.center.latitude ?? (extent.ymin + extent.ymax) / 2,
    ],
    [extent.xmin, extent.ymin],
    [extent.xmax, extent.ymin],
    [extent.xmax, extent.ymax],
    [extent.xmin, extent.ymax],
  ];
  const ring = polygon.rings[0];
  if (ring && ring.length > 0) {
    const step = Math.max(1, Math.floor(ring.length / 4));
    for (let i = 0; i < ring.length; i += step) {
      pts.push([ring[i][0], ring[i][1]]);
    }
  }
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    sum += Math.round(sampleGroundZ(pts[i][0], pts[i][1]) / 2) * (i + 1);
  }
  return sum;
}

/**
 * Builds the 2D wall rings and cap triangulations for an airspace polygon so later
 * exaggeration and terrain updates can re-extrude synchronously without re-triangulating.
 */
export async function buildAirspaceFootprint(
  polygon: Polygon,
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

  const terrainPolygon =
    needTerrainCap && hasGroundRef
      ? new Polygon({ rings: wallRings, spatialReference: polygon.spatialReference })
      : polygon;

  const [flatCap, terrainCap] = await Promise.all([
    needFlatCap ? polygonTo2D(polygon) : undefined,
    needTerrainCap ? triangulateTerrainCap2D(terrainPolygon) : undefined,
  ]);

  return { wallRings, flatCap, terrainCap };
}

function writeCap(
  positions: Float64Array,
  faces: Uint32Array,
  vCursor: number,
  fCursor: number,
  tri: Triangulated2D,
  computeZ: (lon: number, lat: number) => number,
): [number, number] {
  const baseVertex = vCursor;
  for (let i = 0; i < tri.xy.length; i += 2) {
    const lon = tri.xy[i];
    const lat = tri.xy[i + 1];
    const p = vCursor * 3;
    positions[p] = lon;
    positions[p + 1] = lat;
    positions[p + 2] = computeZ(lon, lat);
    vCursor++;
  }
  for (let i = 0; i < tri.faces.length; i++) {
    faces[fCursor++] = baseVertex + tri.faces[i];
  }
  return [vCursor, fCursor];
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
      [vCursor, fCursor] = writeCap(positions, faces, vCursor, fCursor, topTri, (lon, lat) => {
        if (!airspace.topRefGnd) {
          return topOffset;
        }
        const z = sampleGroundZ(lon, lat) + topOffset;
        return airspace.floorRefGnd ? z : Math.max(z, floorOffset);
      });
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

/**
 * Merges multiple raw {@link AirspaceMeshData} buffers into a single ArcGIS {@link Mesh}.
 */
export function mergeMeshData(parts: AirspaceMeshData[]): Mesh | null {
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

  return new Mesh({
    spatialReference: { wkid: 4326 },
    vertexSpace: new MeshGeoreferencedVertexSpace(),
    vertexAttributes: { position: positions },
    components: [
      {
        faces,
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
 * Builds a closed (or terrain-anchored) 3D {@link Mesh} for an airspace polygon in WGS84.
 */
export async function buildAirspaceMesh(params: AirspaceMeshParams): Promise<Mesh | null> {
  const data = await buildAirspaceMeshData(params);
  return data ? mergeMeshData([data]) : null;
}
