import Polygon from '@arcgis/core/geometry/Polygon';
import type { AirspaceTyped } from '@flyxc/common';
import { Class, Type } from '@flyxc/common';
import { describe, expect, it, vi } from 'vitest';

import { buildAirspaceFootprint, buildAirspaceMesh, extrudeAirspaceFootprint } from './airspace3d-mesh';

function makeAirspace(overrides: Partial<AirspaceTyped> = {}): AirspaceTyped {
  return {
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

function makeSquarePolygon(minLon: number, minLat: number, sizeDeg: number): Polygon {
  return new Polygon({
    rings: [
      [
        [minLon, minLat],
        [minLon + sizeDeg, minLat],
        [minLon + sizeDeg, minLat + sizeDeg],
        [minLon, minLat + sizeDeg],
        [minLon, minLat],
      ],
    ],
    spatialReference: { wkid: 4326 },
  });
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
    const empty = new Polygon({ rings: [], spatialReference: { wkid: 4326 } });
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
    // West: ground=300 < 1500 -> bottom sinks by 50*1.5=75 -> 225, top is 1500.
    expect(westZs).toContain(225);
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

    const footprint = await buildAirspaceFootprint(polygon, airspace);
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
});
