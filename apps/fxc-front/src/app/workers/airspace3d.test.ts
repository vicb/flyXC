import { Class, Type } from '@flyxc/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Airspace3dProcessor, extentOverlapsBounds } from './airspace3d-processor';

describe('airspace3d-processor', () => {
  describe('extentOverlapsBounds', () => {
    const bounds = { minLon: 5.0, minLat: 45.0, maxLon: 6.0, maxLat: 46.0 };

    it('detects overlapping and disjoint extents', () => {
      expect(extentOverlapsBounds({ xmin: 5.2, ymin: 45.2, xmax: 5.8, ymax: 45.8 }, bounds)).toBe(true);
      expect(extentOverlapsBounds({ xmin: 4.0, ymin: 45.0, xmax: 4.9, ymax: 46.0 }, bounds)).toBe(false);
      expect(extentOverlapsBounds({ xmin: 5.0, ymin: 46.1, xmax: 6.0, ymax: 47.0 }, bounds)).toBe(false);
      expect(extentOverlapsBounds(undefined, bounds)).toBe(true);
    });
  });

  describe('Airspace3dProcessor execution', () => {
    let processor: Airspace3dProcessor;

    beforeEach(() => {
      processor = new Airspace3dProcessor();
    });

    it('drops obsolete requests when a newer request ID arrives', async () => {
      const req1 = {
        id: 1,
        tiles: [],
        bounds: { minLon: 5, minLat: 45, maxLon: 6, maxLat: 46 },
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
        rings: [
          [
            [5.8, 45.1],
            [6.2, 45.1],
            [6.2, 45.5],
            [5.8, 45.5],
            [5.8, 45.1],
          ],
        ],
        extent: { xmin: 5.8, ymin: 45.1, xmax: 6.2, ymax: 45.5 },
      };

      (processor as any).fetchDecodedTile = vi.fn().mockResolvedValue([gndFeature]);

      const progressStages: any[] = [];
      const req = {
        id: 10,
        tiles: [{ x: 33, y: 22, z: 6 }],
        bounds: { minLon: 5, minLat: 45, maxLon: 7, maxLat: 46 },
        maxAltitude: 3000,
        showClasses: [Class.D],
        showTypes: [Type.CTR],
        dateMs: Date.now(),
        tileServer: 'cloud' as const,
      };

      const finalRes = await processor.process(req, (p) => {
        progressStages.push({
          id: p.id,
          lod: p.lod,
          isFinal: p.isFinal,
          itemCount: p.items.length,
          triangleCount: p.items[0]?.footprint?.terrainCap?.faces.length
            ? p.items[0].footprint.terrainCap.faces.length / 3
            : 0,
        });
      });

      expect(progressStages).toHaveLength(2);
      expect(progressStages[0]).toMatchObject({
        id: 10,
        lod: 0,
        isFinal: false,
        itemCount: 1,
      });
      expect(progressStages[1]).toMatchObject({
        id: 10,
        lod: 1,
        isFinal: true,
        itemCount: 1,
      });

      expect(progressStages[1].triangleCount).toBeGreaterThan(progressStages[0].triangleCount);
      expect(finalRes.isFinal).toBe(true);
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
        rings: [
          [
            [5.8, 45.1],
            [6.0, 45.1],
            [6.0, 45.3],
            [5.8, 45.3],
            [5.8, 45.1],
          ],
        ],
        extent: { xmin: 5.8, ymin: 45.1, xmax: 6.0, ymax: 45.3 },
      };

      (processor as any).fetchDecodedTile = vi.fn().mockResolvedValue([mslFeature]);

      const progressStages: any[] = [];
      const req = {
        id: 11,
        tiles: [{ x: 33, y: 22, z: 6 }],
        bounds: { minLon: 5, minLat: 45, maxLon: 7, maxLat: 46 },
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
      expect(progressStages[0].lod).toBe(1);
      expect(progressStages[0].isFinal).toBe(true);
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
        rings: [
          [
            [5.5, 45.0],
            [6.5, 45.0],
            [6.5, 46.0],
            [5.5, 46.0],
            [5.5, 45.0],
          ],
        ],
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
        bounds: { minLon: 5, minLat: 44, maxLon: 7, maxLat: 47 },
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
  });
});
