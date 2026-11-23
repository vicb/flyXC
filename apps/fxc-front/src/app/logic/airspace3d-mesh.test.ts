import type { AirspaceTyped } from '@flyxc/common';
import { Class, Type } from '@flyxc/common';
import { describe, expect, it, vi } from 'vitest';

import type { AirspacePolygonLike, FlatRings } from './airspace3d-mesh';
import {
  buildAirspaceFootprint,
  buildAirspaceMesh,
  buildBoundarySegmentSet,
  computeTargetGridM,
  extrudeAirspaceFootprint,
  mergeContourPaths,
  triangulateCapWithGrid2D,
} from './airspace3d-mesh';

function flattenRings(rings: number[][][]): FlatRings {
  let totalCoords = 0;
  for (const ring of rings) {
    totalCoords += ring.length * 2;
  }
  const coords = new Float64Array(totalCoords);
  const ends = new Uint32Array(rings.length);
  let offset = 0;
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    for (let i = 0; i < ring.length; i++) {
      coords[offset++] = ring[i][0];
      coords[offset++] = ring[i][1];
    }
    ends[r] = offset;
  }
  return { coords, ends };
}

function makeAirspace(overrides: Partial<AirspaceTyped> = {}): AirspaceTyped {
  return {
    id: 1,
    name: 'TEST CTR',
    country: 'FR',
    floorM: 0,
    floorLabel: 'GND',
    floorRefGnd: false,
    topM: 1000,
    topLabel: '1000m MSL',
    topRefGnd: false,
    type: Type.CTR,
    icaoClass: Class.D,
    activity: 0,
    ...overrides,
  };
}

function makeSquarePolygon(minLon: number, minLat: number, sizeDeg: number): AirspacePolygonLike {
  const flat = flattenRings([
    [
      [minLon, minLat],
      [minLon + sizeDeg, minLat],
      [minLon + sizeDeg, minLat + sizeDeg],
      [minLon, minLat + sizeDeg],
      [minLon, minLat],
    ],
  ]);
  return {
    coords: flat.coords,
    ends: flat.ends,
    extent: {
      xmin: minLon,
      ymin: minLat,
      xmax: minLon + sizeDeg,
      ymax: minLat + sizeDeg,
    },
  };
}

function getZs(positions: ArrayLike<number>): number[] {
  const zs: number[] = [];
  for (let i = 2; i < positions.length; i += 3) {
    zs.push(positions[i]);
  }
  return zs;
}

function assertValidMeshIndices(positions: ArrayLike<number>, faces: ArrayLike<number>): void {
  const vertexCount = positions.length / 3;
  expect(vertexCount).toBeGreaterThan(0);
  expect(faces.length).toBeGreaterThan(0);
  expect(faces.length % 3).toBe(0);
  for (let i = 0; i < faces.length; i++) {
    expect(faces[i]).toBeGreaterThanOrEqual(0);
    expect(faces[i]).toBeLessThan(vertexCount);
  }
}

describe('buildAirspaceMesh', () => {
  it('returns null for an empty polygon', async () => {
    const empty: AirspacePolygonLike = {
      coords: new Float64Array(0),
      ends: new Uint32Array(0),
    };
    const mesh = await buildAirspaceMesh({
      polygon: empty,
      airspace: makeAirspace(),
      multiplier: 1,
      sampleGroundZ: () => 0,
    });
    expect(mesh).toBeNull();
  });

  it('builds a flat closed volume for MSL-MSL airspaces and applies multiplier', async () => {
    const sampleGroundZ = vi.fn(() => 500);
    const polygon = makeSquarePolygon(5.0, 45.0, 0.02);
    const airspace = makeAirspace({
      floorM: 400,
      floorRefGnd: false,
      topM: 1200,
      topRefGnd: false,
    });

    const mesh = await buildAirspaceMesh({
      polygon,
      airspace,
      multiplier: 2,
      sampleGroundZ,
    });

    expect(mesh).not.toBeNull();
    expect(sampleGroundZ).not.toHaveBeenCalled();

    const pos = mesh!.vertexAttributes.position!;
    const comp = mesh!.components![0];
    const faces = comp.faces!;

    assertValidMeshIndices(pos, faces);
    expect(comp.material).toMatchObject({
      alphaMode: 'blend',
      doubleSided: true,
    });

    const zs = getZs(pos);
    // All vertices lie strictly on floorZ=800 or topZ=2400.
    expect(zs.every((z) => z === 800 || z === 2400)).toBe(true);
    expect(zs.filter((z) => z === 800).length).toBeGreaterThan(4);
    expect(zs.filter((z) => z === 2400).length).toBeGreaterThan(4);
  });

  it('sinks 0m GND wall base below terrain, omits bottom cap, and clamps when ground exceeds topM', async () => {
    const polygon = makeSquarePolygon(6.0, 45.5, 0.04); // ~4.4km square
    const airspace = makeAirspace({
      floorM: 0,
      floorRefGnd: true,
      topM: 1000,
      topRefGnd: false,
    });

    // West half terrain is 300m (< 1000m), east half mountain ridge is 1500m (> 1000m).
    const sampleGroundZ = vi.fn((lon: number) => (lon < 6.02 ? 300 : 1500));

    const mesh = await buildAirspaceMesh({
      polygon,
      airspace,
      multiplier: 1.5,
      sampleGroundZ,
    });

    expect(mesh).not.toBeNull();
    expect(sampleGroundZ).toHaveBeenCalled();

    const pos = mesh!.vertexAttributes.position!;
    const faces = mesh!.components![0].faces!;
    assertValidMeshIndices(pos, faces);

    // Inspect wall bottom/top pairs on west vs east side.
    const westZs: number[] = [];
    const eastZs: number[] = [];
    for (let i = 0; i < pos.length; i += 3) {
      if (pos[i] < 6.02) {
        westZs.push(pos[i + 2]);
      } else {
        eastZs.push(pos[i + 2]);
      }
    }

    // topM * 1.5 = 1500.
    // West: ground=300 < 1500 -> bottom sinks by 250*1.5=375 -> -75, top is 1500.
    expect(westZs).toContain(-75);
    expect(westZs).toContain(1500);
    // East: ground=1500 == topZConst -> topZ clamps to nominalFloor (1500) and does not sink below ground.
    expect(eastZs).toContain(1500);
    expect(eastZs.some((z) => z < 1400)).toBe(false);
  });

  it('subdivides interior caps to follow terrain for GND (>0m) -> GND airspaces', async () => {
    const polygon = makeSquarePolygon(6.0, 45.0, 0.03); // ~3.3km -> >800m grid cells
    const airspace = makeAirspace({
      floorM: 300,
      floorRefGnd: true,
      topM: 800,
      topRefGnd: true,
    });

    // Linear slope rising with lon and lat.
    const sampleGroundZ = (lon: number, lat: number) => 200 + (lon - 6.0) * 10_000 + (lat - 45.0) * 10_000;

    const mesh = await buildAirspaceMesh({
      polygon,
      airspace,
      multiplier: 1,
      sampleGroundZ,
    });

    expect(mesh).not.toBeNull();
    const pos = mesh!.vertexAttributes.position!;
    const faces = mesh!.components![0].faces!;
    assertValidMeshIndices(pos, faces);

    // Every vertex must sit within 1e-6m of either ground + 300 or ground + 800.
    let hasInteriorPoint = false;
    let bottomCount = 0;
    let topCount = 0;
    for (let i = 0; i < pos.length; i += 3) {
      const lon = pos[i];
      const lat = pos[i + 1];
      const z = pos[i + 2];
      const gnd = sampleGroundZ(lon, lat);
      const isBottom = Math.abs(z - (gnd + 300)) < 1e-4;
      const isTop = Math.abs(z - (gnd + 800)) < 1e-4;
      expect(isBottom || isTop).toBe(true);
      if (isBottom) {
        bottomCount++;
      }
      if (isTop) {
        topCount++;
      }
      if (lon > 6.001 && lon < 6.029 && lat > 45.001 && lat < 45.029) {
        hasInteriorPoint = true;
      }
    }

    expect(hasInteriorPoint).toBe(true);
    expect(bottomCount).toBeGreaterThan(10);
    expect(topCount).toBeGreaterThan(10);
  });

  it('re-extrudes a cached footprint synchronously across multipliers and terrain heights', async () => {
    const polygon = makeSquarePolygon(6.0, 45.0, 0.06); // ~6.6km -> batched boundary + full grid cells
    const airspace = makeAirspace({
      floorM: 200,
      floorRefGnd: true,
      topM: 700,
      topRefGnd: true,
    });

    const footprint = buildAirspaceFootprint(polygon, airspace);
    expect(footprint).not.toBeNull();

    const data1 = extrudeAirspaceFootprint(footprint!, airspace, 1, () => 400);
    expect(data1).not.toBeNull();
    assertValidMeshIndices(data1!.positions, data1!.faces);
    expect(getZs(data1!.positions).every((z) => z === 600 || z === 1100)).toBe(true);

    const data2 = extrudeAirspaceFootprint(footprint!, airspace, 2, () => 500);
    expect(data2).not.toBeNull();
    assertValidMeshIndices(data2!.positions, data2!.faces);
    expect(getZs(data2!.positions).every((z) => z === 900 || z === 1900)).toBe(true);
  });

  it('subdivides concave and holed GND polygons cleanly with typed arrays and preserves holes', async () => {
    // 6.6km C-shaped polygon with an interior hole.
    const concaveFlat = flattenRings([
      [
        [6.0, 45.0],
        [6.06, 45.0],
        [6.06, 45.06],
        [6.04, 45.06],
        [6.04, 45.045],
        [6.02, 45.045],
        [6.02, 45.06],
        [6.0, 45.06],
        [6.0, 45.0],
      ],
      [
        [6.02, 45.01],
        [6.02, 45.03],
        [6.04, 45.03],
        [6.04, 45.01],
        [6.02, 45.01],
      ],
    ]);
    const concaveWithHole: AirspacePolygonLike = {
      coords: concaveFlat.coords,
      ends: concaveFlat.ends,
      extent: { xmin: 6.0, ymin: 45.0, xmax: 6.06, ymax: 45.06 },
    };
    const airspace = makeAirspace({
      floorM: 200,
      floorRefGnd: true,
      topM: 700,
      topRefGnd: true,
    });

    const footprint = buildAirspaceFootprint(concaveWithHole, airspace);
    expect(footprint).not.toBeNull();
    expect(footprint!.terrainCap).toBeDefined();
    expect(footprint!.terrainCap!.xy).toBeInstanceOf(Float64Array);
    expect(footprint!.terrainCap!.faces).toBeInstanceOf(Uint32Array);

    const { xy, faces } = footprint!.terrainCap!;
    expect(xy.length / 2).toBeGreaterThan(20);
    // No terrain-cap triangle centroid may lie inside the inner hole or the concave cutout.
    for (let i = 0; i < faces.length; i += 3) {
      const cx = (xy[faces[i] * 2] + xy[faces[i + 1] * 2] + xy[faces[i + 2] * 2]) / 3;
      const cy = (xy[faces[i] * 2 + 1] + xy[faces[i + 1] * 2 + 1] + xy[faces[i + 2] * 2 + 1]) / 3;
      const inHole = cx > 6.0201 && cx < 6.0399 && cy > 45.0101 && cy < 45.0299;
      const inConcaveCutout = cx > 6.0201 && cx < 6.0399 && cy > 45.0451 && cy <= 45.06;
      expect(inHole).toBe(false);
      expect(inConcaveCutout).toBe(false);
    }

    const mesh = await buildAirspaceMesh({
      polygon: concaveWithHole,
      airspace,
      multiplier: 1,
      sampleGroundZ: (lon, lat) => 300 + (lon - 6.0) * 5000 + (lat - 45.0) * 5000,
    });
    expect(mesh).not.toBeNull();
    assertValidMeshIndices(mesh!.vertexAttributes.position!, mesh!.components![0].faces!);
  });

  it('triangulates large polygons with an interior Steiner grid to avoid single-vertex needle fans', () => {
    // Large circle with 100 perimeter points (~10km radius)
    const centerLon = 5.9,
      centerLat = 44.3;
    const radiusDeg = 0.1;
    const ring: number[][] = [];
    const N = 100;
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * 2 * Math.PI;
      ring.push([centerLon + Math.cos(angle) * radiusDeg, centerLat + Math.sin(angle) * radiusDeg]);
    }
    ring.push(ring[0]);

    const extent = {
      xmin: centerLon - radiusDeg,
      xmax: centerLon + radiusDeg,
      ymin: centerLat - radiusDeg,
      ymax: centerLat + radiusDeg,
    };

    const tri = triangulateCapWithGrid2D(flattenRings([ring]), extent, 2000);
    expect(tri.xy.length / 2).toBeGreaterThan(N); // Must contain interior Steiner points
    expect(tri.faces.length).toBeGreaterThan(0);

    // Count triangles meeting at each vertex
    const degrees: Record<number, number> = {};
    for (let i = 0; i < tri.faces.length; i++) {
      const v = tri.faces[i];
      degrees[v] = (degrees[v] || 0) + 1;
    }
    const maxDegree = Math.max(...Object.values(degrees));
    // Without interior grid, earcut produces maxDegree = 100 (all connected to vertex 0).
    // With interior Steiner grid, no single vertex has more than 15 triangles!
    expect(maxDegree).toBeLessThan(20);
  });

  it('preserves all perimeter boundary edges without missing gaps or jagged teeth', () => {
    const ring = [
      [5.889, 45.015],
      [5.733, 44.442],
      [5.344, 44.525],
      [5.296, 44.963],
      [5.345, 45.015],
      [5.889, 45.015],
    ];
    const extent = {
      xmin: 5.296,
      ymin: 44.442,
      xmax: 5.889,
      ymax: 45.015,
    };
    const tri = triangulateCapWithGrid2D(flattenRings([ring]), extent, 2000);
    expect(tri.faces.length).toBeGreaterThan(0);

    const edgeSet = new Set<string>();
    for (let i = 0; i < tri.faces.length; i += 3) {
      const a = tri.faces[i];
      const b = tri.faces[i + 1];
      const c = tri.faces[i + 2];
      edgeSet.add(a < b ? `${a}_${b}` : `${b}_${a}`);
      edgeSet.add(b < c ? `${b}_${c}` : `${c}_${b}`);
      edgeSet.add(c < a ? `${c}_${a}` : `${a}_${c}`);
    }

    for (let i = 0; i < ring.length - 1; i++) {
      const next = (i + 1) % (ring.length - 1);
      const key = i < next ? `${i}_${next}` : `${next}_${i}`;
      expect(edgeSet.has(key)).toBe(true);
    }
  });

  it('clamps elevated floor at or below flat ceiling topZ without exceeding it', () => {
    const airspace = makeAirspace({
      floorM: 1000,
      floorRefGnd: true,
      topM: 3810,
      topRefGnd: false,
    });
    // High mountain at 3500m -> ground + floorM = 4500m > 3810m ceiling!
    const sampleGroundZ = () => 3500;
    const footprint = {
      wallRings: flattenRings([
        [
          [5.0, 45.0],
          [5.1, 45.0],
          [5.1, 45.1],
          [5.0, 45.1],
          [5.0, 45.0],
        ],
      ]),
      lod: 1,
    };
    const mesh = extrudeAirspaceFootprint(footprint, airspace, 1, sampleGroundZ);
    expect(mesh).not.toBeNull();
    const zs = getZs(mesh!.positions);
    // No Z coordinate should exceed topM (3810)
    for (const z of zs) {
      expect(z).toBeLessThanOrEqual(3810);
    }
  });

  it('ensures ground-referenced airspaces with floor 0 GND have terrain-following ceiling caps', async () => {
    const airspace = makeAirspace({
      name: 'PARC/RESERVE AIGUILLES ROUGES',
      floorM: 0,
      floorRefGnd: true,
      topM: 300,
      topRefGnd: true,
    });
    const polygon = makeSquarePolygon(6.8, 45.9, 0.1);
    const footprint = buildAirspaceFootprint(polygon, airspace);
    expect(footprint?.terrainCap).toBeDefined();

    // Sample with varying ground elevation (1000m at min, 3000m at max)
    const sampleGroundZ = (_lon: number, lat: number) => 1000 + (lat - 45.9) * 20000;
    const mesh = extrudeAirspaceFootprint(footprint!, airspace, 1, sampleGroundZ);
    expect(mesh).not.toBeNull();
    const zs = getZs(mesh!.positions);
    const maxZ = Math.max(...zs);
    const minZ = Math.min(...zs);
    expect(maxZ - minZ).toBeGreaterThan(1500);
  });

  it('generates perimeter contour paths for floor and ceiling without interior edges', async () => {
    const airspace = makeAirspace({
      name: 'CONTOUR TEST',
      floorM: 500,
      floorRefGnd: false,
      topM: 1500,
      topRefGnd: false,
    });
    const polygon = makeSquarePolygon(6.0, 45.0, 0.05);
    const footprint = buildAirspaceFootprint(polygon, airspace);
    expect(footprint).not.toBeNull();

    const meshData = extrudeAirspaceFootprint(footprint!, airspace, 1, () => 0);
    expect(meshData?.contourPaths).toBeDefined();
    // A single square ring produces exactly 2 closed contour paths: top perimeter and floor perimeter
    expect(meshData!.contourPaths).toHaveLength(2);

    const [topPath, floorPath] = meshData!.contourPaths!;
    // Both paths must trace the perimeter vertices and be closed loops
    const wallVerts = footprint!.wallRings.ends[0] / 2;
    expect(topPath.length).toBe(wallVerts);
    expect(floorPath.length).toBe(wallVerts);
    // Closed loop
    expect(topPath[0][0]).toBe(topPath[topPath.length - 1][0]);
    expect(topPath[0][1]).toBe(topPath[topPath.length - 1][1]);
    expect(floorPath[0][0]).toBe(floorPath[floorPath.length - 1][0]);
    expect(floorPath[0][1]).toBe(floorPath[floorPath.length - 1][1]);

    // Check Z values
    expect(topPath.every((pt) => pt[2] === 1500)).toBe(true);
    expect(floorPath.every((pt) => pt[2] === 500)).toBe(true);

    // mergeContourPaths aggregates paths
    const merged = mergeContourPaths([meshData!, meshData!]);
    expect(merged).toHaveLength(4);

    // Ground-level airspaces have floor contour biased +2m above ground surface
    const gndAirspace = makeAirspace({
      name: 'GND CONTOUR TEST',
      floorM: 0,
      floorRefGnd: true,
      topM: 1000,
      topRefGnd: false,
    });
    const gndMeshData = extrudeAirspaceFootprint(footprint!, gndAirspace, 1, () => 200);
    expect(gndMeshData?.contourPaths).toHaveLength(2);
    const [gndTop, gndFloor] = gndMeshData!.contourPaths!;
    expect(gndTop.every((pt) => pt[2] === 1000)).toBe(true);
    expect(gndFloor.every((pt) => pt[2] === 202)).toBe(true);
  });

  describe('computeTargetGridM & adaptive AGL triangulation', () => {
    it('computes correct grid spacing for MSL and variable-thickness AGL ceilings', () => {
      // MSL airspaces use standard 2000m / 4800m grid
      const msl = makeAirspace({ floorM: 0, floorRefGnd: false, topM: 1000, topRefGnd: false });
      expect(computeTargetGridM(msl, false)).toBe(2000);
      expect(computeTargetGridM(msl, true)).toBe(4800);

      // Very thin AGL airspace (e.g. Vinon 152m GND): clamped to minimum 400m fine
      const thinAgl = makeAirspace({ floorM: 0, floorRefGnd: true, topM: 152, topRefGnd: true });
      expect(computeTargetGridM(thinAgl, false)).toBe(400);
      expect(computeTargetGridM(thinAgl, true)).toBe(2000);

      // 300m AGL airspace (e.g. Vercors / Bauges 300m GND): 300 * 1.5 = 450m fine
      const vercors = makeAirspace({ floorM: 0, floorRefGnd: true, topM: 300, topRefGnd: true });
      expect(computeTargetGridM(vercors, false)).toBe(450);
      expect(computeTargetGridM(vercors, true)).toBe(2000);

      // 1000m AGL airspace (e.g. Ecrins 1000m GND): 1000 * 1.5 = 1500m fine
      const ecrins = makeAirspace({ floorM: 0, floorRefGnd: true, topM: 1000, topRefGnd: true });
      expect(computeTargetGridM(ecrins, false)).toBe(1500);
      expect(computeTargetGridM(ecrins, true)).toBe(4000);

      // Elevated AGL floor with AGL ceiling (e.g. LF-R196C 305m GND -> 1006m GND): uses min clearance 305m -> 458m fine
      const valensole = makeAirspace({ floorM: 305, floorRefGnd: true, topM: 1006, topRefGnd: true });
      expect(computeTargetGridM(valensole, false)).toBe(458);
      expect(computeTargetGridM(valensole, true)).toBe(2000);

      // Elevated AGL floor with MSL ceiling (e.g. ZRT APT 152m GND -> FL 75): uses floorM 152m -> 400m fine
      const elevatedFloorOnly = makeAirspace({ floorM: 152, floorRefGnd: true, topM: 2286, topRefGnd: false });
      expect(computeTargetGridM(elevatedFloorOnly, false)).toBe(400);
      expect(computeTargetGridM(elevatedFloorOnly, true)).toBe(2000);
    });

    it('subdivides terrain-cap triangles over narrow ridges without inflating surrounding valleys', async () => {
      const polygon = makeSquarePolygon(6.0, 45.0, 0.04); // ~4.4km square
      const airspace = makeAirspace({
        floorM: 300,
        floorRefGnd: true,
        topM: 1000,
        topRefGnd: true,
      });

      const footprint = buildAirspaceFootprint(polygon, airspace, { maxEdgeM: 1500 });
      expect(footprint?.terrainCap).toBeDefined();
      const baseFaceCount = footprint!.terrainCap!.faces.length / 3;

      // Sharp narrow east-west ridge peaking at 1700m along lat=45.02, dropping to 1000m in valleys
      const sampleRidge = (_lon: number, lat: number) => {
        const d = Math.abs(lat - 45.02);
        return d < 0.004 ? 1700 - (d / 0.004) * 700 : 1000;
      };

      const meshData = extrudeAirspaceFootprint(footprint!, airspace, 1, sampleRidge)!;
      expect(meshData).not.toBeNull();
      assertValidMeshIndices(meshData.positions, meshData.faces);

      // Ridge refinement must have subdivided triangles beyond the initial coarse grid
      const wallRingVerts = footprint!.wallRings.ends[0] / 2;
      const wallFaceCount = (wallRingVerts - 1) * 2;
      const capFaceCount = (meshData.faces.length - wallFaceCount * 3) / 6;
      expect(capFaceCount).toBeGreaterThan(baseFaceCount);

      // Every cap vertex (including valley vertices and newly split ridge vertices) must sit
      // strictly at exact ground + 300 (floor) or exact ground + 1000 (top) with zero valley inflation
      const wallVertCount = wallRingVerts * 2;
      let ridgeVertCount = 0;
      for (let i = wallVertCount; i < meshData.positions.length / 3; i++) {
        const lon = meshData.positions[i * 3];
        const lat = meshData.positions[i * 3 + 1];
        const z = meshData.positions[i * 3 + 2];
        const gnd = sampleRidge(lon, lat);
        const isFloor = Math.abs(z - (gnd + 300)) < 1e-4;
        const isTop = Math.abs(z - (gnd + 1000)) < 1e-4;
        expect(isFloor || isTop).toBe(true);
        if (gnd > 1400) {
          ridgeVertCount++;
        }
      }
      expect(ridgeVertCount).toBeGreaterThan(0);
    });

    it('densifies fine terrainCap mesh much more thoroughly for thin AGL ceilings', async () => {
      const thinAgl = makeAirspace({ floorM: 0, floorRefGnd: true, topM: 300, topRefGnd: true });
      // 0.2 x 0.2 deg polygon (~15km x 22km)
      const polygon = makeSquarePolygon(5.5, 45.0, 0.2);

      const coarseFp = buildAirspaceFootprint(polygon, thinAgl, { coarse: true });
      const fineFp = buildAirspaceFootprint(polygon, thinAgl, { coarse: false });

      expect(coarseFp?.terrainCap).toBeDefined();
      expect(fineFp?.terrainCap).toBeDefined();

      // Fine mesh has much denser triangulation than coarse preview
      const coarseVertCount = coarseFp!.terrainCap!.xy.length / 2;
      const fineVertCount = fineFp!.terrainCap!.xy.length / 2;
      expect(fineVertCount).toBeGreaterThan(coarseVertCount * 5);
      expect(fineFp!.terrainCap!.faces.length).toBeGreaterThan(coarseFp!.terrainCap!.faces.length * 5);
    });

    it('buildBoundarySegmentSet generates boundary segment keys on-demand without storing in footprint', () => {
      const ring = [
        [5.0, 45.0],
        [6.0, 45.0],
        [6.0, 46.0],
        [5.0, 46.0],
        [5.0, 45.0],
      ];
      const flat = flattenRings([ring]);
      const boundarySet = buildBoundarySegmentSet(flat);
      expect(boundarySet.size).toBe(4);

      const airspace = makeAirspace({ floorM: 0, floorRefGnd: true, topM: 500, topRefGnd: true });
      const polygon = makeSquarePolygon(5.5, 45.5, 0.1);
      const footprint = buildAirspaceFootprint(polygon, airspace);

      // Verify terrainCap does not retain a boundarySegments Set (saving memory and structured cloning)
      expect((footprint?.terrainCap as any)?.boundarySegments).toBeUndefined();
    });
  });
});
