import { Class, Type } from '@flyxc/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Airspace3dProcessor,
  computeRingsExtent,
  extentOverlapsBounds,
  geoJsonGeometryToParts,
  getAirspaceKey,
} from './airspace3d-processor';

describe('airspace3d-processor', () => {
  describe('computeRingsExtent', () => {
    it('computes bounding box for multi-ring polygon coordinates', () => {
      const rings = [
        [
          [5.8, 45.1],
          [6.2, 45.1],
          [6.2, 45.6],
          [5.8, 45.6],
          [5.8, 45.1],
        ],
      ];
      expect(computeRingsExtent(rings)).toEqual({
        xmin: 5.8,
        ymin: 45.1,
        xmax: 6.2,
        ymax: 45.6,
      });
    });

    it('returns undefined for empty rings', () => {
      expect(computeRingsExtent([])).toBeUndefined();
    });
  });

  describe('geoJsonGeometryToParts', () => {
    it('decodes GeoJSON Polygon into parts with extents', () => {
      const geometry = {
        type: 'Polygon',
        coordinates: [
          [
            [1.0, 2.0],
            [3.0, 2.0],
            [3.0, 4.0],
            [1.0, 4.0],
            [1.0, 2.0],
          ],
        ],
      };
      const parts = geoJsonGeometryToParts('10/500/300', 0, geometry);
      expect(parts).toHaveLength(1);
      expect(parts[0].id).toBe('10/500/300#0.0');
      expect(parts[0].extent).toEqual({ xmin: 1.0, ymin: 2.0, xmax: 3.0, ymax: 4.0 });
    });

    it('decodes GeoJSON MultiPolygon into distinct parts', () => {
      const geometry = {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0],
            ],
          ],
          [
            [
              [2, 2],
              [3, 2],
              [3, 3],
              [2, 3],
              [2, 2],
            ],
          ],
        ],
      };
      const parts = geoJsonGeometryToParts('10/500/300', 2, geometry);
      expect(parts).toHaveLength(2);
      expect(parts[0].id).toBe('10/500/300#2.0');
      expect(parts[1].id).toBe('10/500/300#2.1');
    });
  });

  describe('extentOverlapsBounds', () => {
    const bounds = { minLon: 5.0, minLat: 45.0, maxLon: 6.0, maxLat: 46.0 };

    it('detects overlapping and disjoint extents', () => {
      expect(extentOverlapsBounds({ xmin: 5.2, ymin: 45.2, xmax: 5.8, ymax: 45.8 }, bounds)).toBe(true);
      expect(extentOverlapsBounds({ xmin: 4.0, ymin: 45.0, xmax: 4.9, ymax: 46.0 }, bounds)).toBe(false);
      expect(extentOverlapsBounds({ xmin: 5.0, ymin: 46.1, xmax: 6.0, ymax: 47.0 }, bounds)).toBe(false);
      expect(extentOverlapsBounds(undefined, bounds)).toBe(true);
    });
  });

  describe('getAirspaceKey', () => {
    it('constructs a deterministic key from airspace attributes', () => {
      const key = getAirspaceKey({
        name: 'GENEVA TMA',
        country: 'CH',
        type: Type.TMA,
        icaoClass: Class.D,
        floorM: 1000,
        topM: 3000,
        floorRefGnd: false,
        topRefGnd: true,
      } as any);
      expect(key).toBe(`GENEVA TMA|CH|${Type.TMA}|${Class.D}|1000|3000|false|true`);
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
        multiplier: 1,
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
        polygons: [
          {
            id: '10/500/300#0.0',
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
          },
        ],
      };

      (processor as any).fetchDecodedTile = vi.fn().mockResolvedValue([gndFeature]);

      const progressStages: any[] = [];
      const req = {
        id: 10,
        tiles: [{ x: 500, y: 300, z: 10 }],
        bounds: { minLon: 5, minLat: 45, maxLon: 7, maxLat: 46 },
        maxAltitude: 3000,
        showClasses: [Class.D],
        showTypes: [Type.CTR],
        dateMs: Date.now(),
        tileServer: 'cloud' as const,
        multiplier: 1,
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
        polygons: [
          {
            id: '10/500/300#1.0',
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
          },
        ],
      };

      (processor as any).fetchDecodedTile = vi.fn().mockResolvedValue([mslFeature]);

      const progressStages: any[] = [];
      const req = {
        id: 11,
        tiles: [{ x: 500, y: 300, z: 10 }],
        bounds: { minLon: 5, minLat: 45, maxLon: 7, maxLat: 46 },
        maxAltitude: 3000,
        showClasses: [Class.D],
        showTypes: [Type.CTR],
        dateMs: Date.now(),
        tileServer: 'cloud' as const,
        multiplier: 1,
      };

      await processor.process(req, (p) => {
        progressStages.push(p);
      });

      expect(progressStages).toHaveLength(1);
      expect(progressStages[0].lod).toBe(1);
      expect(progressStages[0].isFinal).toBe(true);
    });
  });
});
