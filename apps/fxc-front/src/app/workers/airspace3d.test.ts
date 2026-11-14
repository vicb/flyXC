import { Class, Type } from '@flyxc/common';
import { beforeEach, describe, expect, it } from 'vitest';

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
  });
});
