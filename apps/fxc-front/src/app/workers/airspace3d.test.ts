import { Class, Type } from '@flyxc/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AirspacePolygonLike } from '../logic/airspace3d-mesh';
import { Airspace3dProcessor } from './airspace3d-processor';

function makeTestPolygon(ring: [number, number][], extent?: any): AirspacePolygonLike {
  const coords = new Float64Array(ring.length * 2);
  for (let i = 0; i < ring.length; i++) {
    coords[i * 2] = ring[i][0];
    coords[i * 2 + 1] = ring[i][1];
  }
  return {
    coords,
    ends: new Uint32Array([coords.length]),
    extent,
  };
}

describe('airspace3d-processor', () => {
  describe('Airspace3dProcessor execution', () => {
    let processor: Airspace3dProcessor;

    beforeEach(() => {
      processor = new Airspace3dProcessor();
    });

    it('drops obsolete requests when a newer request ID arrives', async () => {
      const req1 = {
        id: 1,
        tiles: [],
        bounds: { xmin: 5, ymin: 45, xmax: 6, ymax: 46 },
        maxAltitude: 3000,
        showClasses: [],
        showTypes: [],
        dateMs: Date.now(),
        tileServer: 'cloud' as const,
      };
      const req2 = { ...req1, id: 2 };

      // Dispatch req2 first so lastRequestId advances to 2
      const res2Promise = processor.process(req2);
      const res1 = await processor.process(req1);

      expect(res1.items).toEqual([]);
      const res2 = await res2Promise;
      expect(res2.id).toBe(2);
    });

    it('emits progressive refinement stages via onProgress callback', async () => {
      const gndFeature = {
        id: 101,
        baseAirspace: {
          name: 'TEST PROGRESSIVE CTR',
          country: 'FR',
          floorM: 300,
          floorLabel: '300m AGL',
          floorRefGnd: true,
          topM: 1500,
          topLabel: '1500m AGL',
          topRefGnd: true,
          type: Type.CTR,
          icaoClass: Class.D,
          activity: 0,
        },
        polygon: makeTestPolygon(
          [
            [5.8, 45.1],
            [6.2, 45.1],
            [6.2, 45.5],
            [5.8, 45.5],
            [5.8, 45.1],
          ],
          { xmin: 5.8, ymin: 45.1, xmax: 6.2, ymax: 45.5 },
        ),
        extent: { xmin: 5.8, ymin: 45.1, xmax: 6.2, ymax: 45.5 },
      };

      (processor as any).fetchDecodedTile = vi.fn().mockResolvedValue([gndFeature]);

      const progressStages: any[] = [];
      const req = {
        id: 10,
        tiles: [{ x: 33, y: 22, z: 6 }],
        bounds: { xmin: 5, ymin: 45, xmax: 7, ymax: 46 },
        maxAltitude: 3000,
        showClasses: [Class.D],
        showTypes: [Type.CTR],
        dateMs: Date.now(),
        tileServer: 'cloud' as const,
      };

      const finalRes = await processor.process(req, (p) => {
        progressStages.push({
          id: p.id,
          isFinal: p.isFinal,
          isDelta: p.isDelta,
          itemCount: p.items.length,
          triangleCount: p.items[0]?.footprint?.terrainCap?.faces.length
            ? p.items[0].footprint.terrainCap.faces.length / 3
            : 0,
        });
      });

      expect(progressStages).toHaveLength(2);
      expect(progressStages[0]).toMatchObject({
        id: 10,
        isFinal: false,
        itemCount: 1,
      });
      expect(progressStages[1]).toMatchObject({
        id: 10,
        isDelta: true,
        itemCount: 1,
      });

      expect(progressStages[1].triangleCount).toBeGreaterThan(progressStages[0].triangleCount);
      expect(finalRes.isDelta).toBe(true);
    });

    it('emits all items on LOD 0, but sends only refined deltas on LOD 1 when mixed MSL and GND airspaces exist', async () => {
      const gndFeature = {
        id: 101,
        baseAirspace: {
          name: 'TEST PROGRESSIVE CTR',
          country: 'FR',
          floorM: 300,
          floorLabel: '300m AGL',
          floorRefGnd: true,
          topM: 1500,
          topLabel: '1500m AGL',
          topRefGnd: true,
          type: Type.CTR,
          icaoClass: Class.D,
          activity: 0,
        },
        polygon: makeTestPolygon(
          [
            [5.8, 45.1],
            [6.2, 45.1],
            [6.2, 45.5],
            [5.8, 45.5],
            [5.8, 45.1],
          ],
          { xmin: 5.8, ymin: 45.1, xmax: 6.2, ymax: 45.5 },
        ),
        extent: { xmin: 5.8, ymin: 45.1, xmax: 6.2, ymax: 45.5 },
      };

      const mslFeature = {
        id: 102,
        baseAirspace: {
          name: 'TEST MSL CTR',
          country: 'FR',
          floorM: 500,
          floorLabel: '500m MSL',
          floorRefGnd: false,
          topM: 2000,
          topLabel: '2000m MSL',
          topRefGnd: false,
          type: Type.CTR,
          icaoClass: Class.D,
          activity: 0,
        },
        polygon: makeTestPolygon(
          [
            [5.8, 45.1],
            [6.0, 45.1],
            [6.0, 45.3],
            [5.8, 45.3],
            [5.8, 45.1],
          ],
          { xmin: 5.8, ymin: 45.1, xmax: 6.0, ymax: 45.3 },
        ),
        extent: { xmin: 5.8, ymin: 45.1, xmax: 6.0, ymax: 45.3 },
      };

      (processor as any).fetchDecodedTile = vi.fn().mockResolvedValue([gndFeature, mslFeature]);

      const progressStages: any[] = [];
      const req = {
        id: 12,
        tiles: [{ x: 33, y: 22, z: 6 }],
        bounds: { xmin: 5, ymin: 45, xmax: 7, ymax: 46 },
        maxAltitude: 3000,
        showClasses: [Class.D],
        showTypes: [Type.CTR],
        dateMs: Date.now(),
        tileServer: 'cloud' as const,
      };

      const finalRes = await processor.process(req, (p) => {
        progressStages.push({
          id: p.id,
          isFinal: p.isFinal,
          isDelta: p.isDelta,
          itemCount: p.items.length,
          itemIds: p.items.map((i) => i.airspace.id),
        });
      });

      expect(progressStages).toHaveLength(2);
      // LOD 0: initial render has BOTH airspaces (coarse GND + MSL)
      expect(progressStages[0]).toMatchObject({
        id: 12,
        isFinal: false,
        itemCount: 2,
        itemIds: [101, 102],
      });
      // LOD 1: delta refinement contains ONLY the ground-referenced airspace (item 101)
      expect(progressStages[1]).toMatchObject({
        id: 12,
        isDelta: true,
        itemCount: 1,
        itemIds: [101],
      });
      expect(finalRes.isDelta).toBe(true);
      expect(finalRes.items).toHaveLength(1);
      expect(finalRes.items[0].airspace.id).toBe(101);
    });

    it('emits single final response when all airspaces are flat MSL', async () => {
      const mslFeature = {
        id: 102,
        baseAirspace: {
          name: 'TEST MSL CTR',
          country: 'FR',
          floorM: 500,
          floorLabel: '500m MSL',
          floorRefGnd: false,
          topM: 2000,
          topLabel: '2000m MSL',
          topRefGnd: false,
          type: Type.CTR,
          icaoClass: Class.D,
          activity: 0,
        },
        polygon: makeTestPolygon(
          [
            [5.8, 45.1],
            [6.0, 45.1],
            [6.0, 45.3],
            [5.8, 45.3],
            [5.8, 45.1],
          ],
          { xmin: 5.8, ymin: 45.1, xmax: 6.0, ymax: 45.3 },
        ),
        extent: { xmin: 5.8, ymin: 45.1, xmax: 6.0, ymax: 45.3 },
      };

      (processor as any).fetchDecodedTile = vi.fn().mockResolvedValue([mslFeature]);

      const progressStages: any[] = [];
      const req = {
        id: 11,
        tiles: [{ x: 33, y: 22, z: 6 }],
        bounds: { xmin: 5, ymin: 45, xmax: 7, ymax: 46 },
        maxAltitude: 3000,
        showClasses: [Class.D],
        showTypes: [Type.CTR],
        dateMs: Date.now(),
        tileServer: 'cloud' as const,
      };

      await processor.process(req, (p) => {
        progressStages.push(p);
      });

      expect(progressStages).toHaveLength(1);
      expect(progressStages[0].isFinal ?? true).toBe(true);
      expect(progressStages[0].isDelta).toBeUndefined();
    });

    it('deduplicates features across multiple Zoom 6 tiles by feature id without union', async () => {
      const featureTile1 = {
        id: 777,
        baseAirspace: {
          id: 777,
          name: 'CROSS TILE TMA',
          country: 'FR',
          floorM: 1000,
          floorLabel: '1000m MSL',
          floorRefGnd: false,
          topM: 3500,
          topLabel: '3500m MSL',
          topRefGnd: false,
          type: Type.TMA,
          icaoClass: Class.C,
          activity: 0,
        },
        polygon: makeTestPolygon(
          [
            [5.5, 45.0],
            [6.5, 45.0],
            [6.5, 46.0],
            [5.5, 46.0],
            [5.5, 45.0],
          ],
          { xmin: 5.5, ymin: 45.0, xmax: 6.5, ymax: 46.0 },
        ),
        extent: { xmin: 5.5, ymin: 45.0, xmax: 6.5, ymax: 46.0 },
      };

      // In unclipped Zoom 6 tiles, neighbor tile also returns the exact same full feature
      const featureTile2 = { ...featureTile1 };

      (processor as any).fetchDecodedTile = vi
        .fn()
        .mockImplementation((x: number) => Promise.resolve(x === 33 ? [featureTile1] : [featureTile2]));

      const req = {
        id: 12,
        tiles: [
          { x: 33, y: 22, z: 6 },
          { x: 34, y: 22, z: 6 },
        ],
        bounds: { xmin: 5, ymin: 44, xmax: 7, ymax: 47 },
        maxAltitude: 4000,
        showClasses: [Class.C],
        showTypes: [Type.TMA],
        dateMs: Date.now(),
        tileServer: 'cloud' as const,
      };

      const res = await processor.process(req);
      // Exactly 1 item despite being returned by both tiles
      expect(res.items).toHaveLength(1);
      expect(res.items[0].airspace.id).toBe(777);
      expect(res.items[0].airspace.name).toBe('CROSS TILE TMA');
    });

    it('clears cache when remote timestamp differs even if date is identical', async () => {
      const mockDb = {
        get: vi.fn().mockImplementation((store: string, key: string) => {
          if (store === 'metadata' && key === 'version') return Promise.resolve('1700000000000');
          return Promise.resolve(undefined);
        }),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      };

      (processor as any).getDb = vi.fn().mockResolvedValue(mockDb);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ date: '2026-11-14', timestamp: 1700000099000 }),
      } as any);

      await (processor as any).checkRemoteDate('cloud');

      expect(mockDb.clear).toHaveBeenCalledWith('footprints');
      expect(mockDb.put).toHaveBeenCalledWith('metadata', '1700000099000', 'version');
      expect(mockDb.delete).toHaveBeenCalledWith('metadata', 'date');
    });

    it('clears cache when remote airspaces-date differs from legacy stored date', async () => {
      const mockDb = {
        get: vi.fn().mockImplementation((store: string, key: string) => {
          if (store === 'metadata' && key === 'date') return Promise.resolve('2026-10-01');
          return Promise.resolve(undefined);
        }),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      };

      (processor as any).getDb = vi.fn().mockResolvedValue(mockDb);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ date: '2026-11-14' }),
      } as any);

      await (processor as any).checkRemoteDate('cloud');

      expect(mockDb.clear).toHaveBeenCalledWith('footprints');
      expect(mockDb.put).toHaveBeenCalledWith('metadata', '2026-11-14', 'version');
      expect(mockDb.delete).toHaveBeenCalledWith('metadata', 'date');
    });

    it('allows retry on subsequent calls if remote date fetch fails', async () => {
      const mockDb = {
        get: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      };
      (processor as any).getDb = vi.fn().mockResolvedValue(mockDb);

      // First attempt fails with 500
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as any);

      await (processor as any).checkRemoteDate('cloud');
      expect(mockDb.clear).not.toHaveBeenCalled();

      // Second attempt succeeds
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ date: '2026-11-14', timestamp: 1700000099000 }),
      } as any);

      await (processor as any).checkRemoteDate('cloud');
      expect(mockDb.clear).toHaveBeenCalledWith('footprints');
      expect(mockDb.put).toHaveBeenCalledWith('metadata', '1700000099000', 'version');
    });

    it('releases rawFeature after lazy decoding in getDecodedPolygon to free PBF buffer', () => {
      const mockRawFeature = {
        toFlatGeoGeometry: vi.fn().mockReturnValue({
          coords: new Float64Array([5.8, 45.1, 6.2, 45.1]),
          ends: new Uint32Array([4]),
        }),
      };
      const feat: any = {
        id: 999,
        tileX: 33,
        tileY: 22,
        extent: { xmin: 5.8, ymin: 45.1, xmax: 6.2, ymax: 45.1 },
        rawFeature: mockRawFeature,
      };

      const poly = (processor as any).getDecodedPolygon(feat);

      expect(mockRawFeature.toFlatGeoGeometry).toHaveBeenCalledWith(33, 22, 6);
      expect(poly.coords).toBeInstanceOf(Float64Array);
      expect(poly.coords.length).toBe(4);
      expect(feat.rawFeature).toBeUndefined();
      expect(feat.polygon).toBe(poly);
    });
  });
});
