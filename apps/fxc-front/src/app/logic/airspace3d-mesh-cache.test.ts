import { Activity, type AirspaceTyped, Class, Type } from '@flyxc/common';
import { describe, expect, it } from 'vitest';

import { AirspaceMeshCache, getAirspaceMeshCacheKey } from './airspace3d-mesh-cache';

function makeAirspace(overrides: Partial<AirspaceTyped> = {}): AirspaceTyped {
  return {
    id: 500,
    name: 'Test Airspace',
    type: Type.TMA,
    icaoClass: Class.E,
    activity: Activity.None,
    country: 'FR',
    floorM: 1000,
    topM: 2500,
    floorRefGnd: false,
    topRefGnd: false,
    floorLabel: '1000m',
    topLabel: '2500m',
    ...overrides,
  };
}

describe('AirspaceMeshCache', () => {
  describe('getAirspaceMeshCacheKey', () => {
    it('uses numeric id directly for normal airspaces', () => {
      const asp = makeAirspace({ id: 500 });
      expect(getAirspaceMeshCacheKey(asp)).toBe(500);
    });

    it('uses composite string key for overridable airspaces (id <= RESERVED_AIRSPACE_ID_MAX)', () => {
      const asp = makeAirspace({ id: 10, floorM: 0, topM: 1980, icaoClass: Class.D, type: Type.TMA });
      expect(getAirspaceMeshCacheKey(asp)).toBe(`10:0:1980:${Class.D}:${Type.TMA}`);
    });
  });

  describe('cache operations', () => {
    const dummyMesh = { positions: new Float64Array([0, 0, 0]), faces: new Uint32Array([0, 0, 0]) };

    it('stores and retrieves mesh entries by airspace and lod', () => {
      const cache = new AirspaceMeshCache(10);
      const asp = makeAirspace({ id: 500 });

      cache.set(asp, { meshData: dummyMesh, meshLod: 1 });
      expect(cache.size).toBe(1);

      expect(cache.get(asp, 1)).toBeDefined();
      expect(cache.get(asp, 0)).toBeUndefined();
      expect(cache.get(asp)).toBeDefined();

      cache.set(asp, { meshData: dummyMesh, meshLod: 1, cullKey: 12345 });
      expect(cache.get(asp, 1, 12345)).toBeDefined();
      expect(cache.get(asp, 1, 99999)).toBeUndefined();
    });

    it('self-invalidates when overridable airspace attributes change', () => {
      const cache = new AirspaceMeshCache(10);
      const winterWeekendAsp = makeAirspace({ id: 10, topM: 1980, icaoClass: Class.D });
      const weekdayAsp = makeAirspace({ id: 10, topM: 1980, icaoClass: Class.E });

      cache.set(winterWeekendAsp, { meshData: dummyMesh, meshLod: 1 });
      expect(cache.get(winterWeekendAsp)).toBeDefined();
      expect(cache.get(weekdayAsp)).toBeUndefined();

      cache.set(weekdayAsp, { meshData: dummyMesh, meshLod: 1 });
      expect(cache.size).toBe(2);
      expect(cache.get(winterWeekendAsp)).toBeDefined();
      expect(cache.get(weekdayAsp)).toBeDefined();
    });

    it('evicts oldest entries when capacity is exceeded', () => {
      const cache = new AirspaceMeshCache(2);
      const a1 = makeAirspace({ id: 101 });
      const a2 = makeAirspace({ id: 102 });
      const a3 = makeAirspace({ id: 103 });

      cache.set(a1, { meshData: dummyMesh, meshLod: 1 });
      cache.set(a2, { meshData: dummyMesh, meshLod: 1 });
      expect(cache.size).toBe(2);

      cache.set(a3, { meshData: dummyMesh, meshLod: 1 });
      expect(cache.size).toBe(2);
      expect(cache.get(a1)).toBeUndefined();
      expect(cache.get(a2)).toBeDefined();
      expect(cache.get(a3)).toBeDefined();
    });
  });
});
