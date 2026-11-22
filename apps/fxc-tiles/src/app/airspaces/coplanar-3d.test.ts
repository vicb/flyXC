import { MERGED_AIRSPACE_ID_MIN, RESERVED_AIRSPACE_ID_MAX } from '@flyxc/common';
import { describe, expect, it } from 'vitest';

import type { AirspaceFeature } from './coplanar-3d';
import { mergeCoplanarAirspaces } from './coplanar-3d';

describe('mergeCoplanarAirspaces', () => {
  it('preserves original 2D numeric IDs for unmerged features', async () => {
    const f1: AirspaceFeature = {
      type: 'Feature',
      id: 101,
      properties: { icaoClass: 4, type: 0, floorM: 100, topM: 500, floorRefGnd: false, topRefGnd: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
      },
    };
    const f2: AirspaceFeature = {
      type: 'Feature',
      id: 202,
      properties: { icaoClass: 4, type: 0, floorM: 100, topM: 500, floorRefGnd: false, topRefGnd: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [10, 10],
            [11, 10],
            [11, 11],
            [10, 11],
            [10, 10],
          ],
        ],
      },
    };

    const result = await mergeCoplanarAirspaces([f1, f2]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(101);
    expect(result[0].properties.id).toBeUndefined();
    expect(result[1].id).toBe(202);
    expect(result[1].properties.id).toBeUndefined();
  });

  it('unions overlapping coplanar airspaces into a single dissolved polygon with id >= MERGED_AIRSPACE_ID_MIN', async () => {
    const f1: AirspaceFeature = {
      type: 'Feature',
      id: 101,
      properties: { icaoClass: 4, type: 0, floorM: 100, topM: 500, floorRefGnd: false, topRefGnd: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [2, 0],
            [2, 2],
            [0, 2],
            [0, 0],
          ],
        ],
      },
    };
    const f2: AirspaceFeature = {
      type: 'Feature',
      id: 102,
      properties: { icaoClass: 4, type: 0, floorM: 100, topM: 500, floorRefGnd: false, topRefGnd: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [1, 0],
            [3, 0],
            [3, 2],
            [1, 2],
            [1, 0],
          ],
        ],
      },
    };

    const result = await mergeCoplanarAirspaces([f1, f2]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(MERGED_AIRSPACE_ID_MIN);
    expect(result[0].properties.id).toBeUndefined();
    expect(result[0].geometry.type).toBe('Polygon');
    // Resulting polygon bounding box spans [0,0] to [3,2]
    const ring = result[0].geometry.coordinates[0];
    expect(ring).toHaveLength(5);
  });

  it('does NOT union airspaces with different vertical bounds or classes and preserves their IDs', async () => {
    const f1: AirspaceFeature = {
      type: 'Feature',
      id: 101,
      properties: { icaoClass: 4, type: 0, floorM: 100, topM: 500, floorRefGnd: false, topRefGnd: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [2, 0],
            [2, 2],
            [0, 2],
            [0, 0],
          ],
        ],
      },
    };
    const f2: AirspaceFeature = {
      type: 'Feature',
      id: 102,
      // Different top altitude: 600m
      properties: { icaoClass: 4, type: 0, floorM: 100, topM: 600, floorRefGnd: false, topRefGnd: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [1, 0],
            [3, 0],
            [3, 2],
            [1, 2],
            [1, 0],
          ],
        ],
      },
    };

    const result = await mergeCoplanarAirspaces([f1, f2]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(101);
    expect(result[1].id).toBe(102);
  });

  it('preserves original 2D IDs for disjoint bounding boxes in the same coplanar bracket', async () => {
    const f1: AirspaceFeature = {
      type: 'Feature',
      id: 301,
      properties: { icaoClass: 4, type: 0, floorM: 100, topM: 500, floorRefGnd: false, topRefGnd: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [2, 0],
            [2, 2],
            [0, 2],
            [0, 0],
          ],
        ],
      },
    };
    const f2: AirspaceFeature = {
      type: 'Feature',
      id: 302,
      properties: { icaoClass: 4, type: 0, floorM: 100, topM: 500, floorRefGnd: false, topRefGnd: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [5, 5],
            [7, 5],
            [7, 7],
            [5, 7],
            [5, 5],
          ],
        ],
      },
    };

    const result = await mergeCoplanarAirspaces([f1, f2]);
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.id).sort((a, b) => Number(a) - Number(b))).toEqual([301, 302]);
  });

  it('preserves features with reserved IDs (<= 100) and excludes them from coplanar merging', async () => {
    const f1: AirspaceFeature = {
      type: 'Feature',
      id: 7, // Reserved ID e.g. LF-R30B
      properties: { icaoClass: 4, type: 0, floorM: 100, topM: 500, floorRefGnd: false, topRefGnd: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [2, 0],
            [2, 2],
            [0, 2],
            [0, 0],
          ],
        ],
      },
    };
    const f2: AirspaceFeature = {
      type: 'Feature',
      id: RESERVED_AIRSPACE_ID_MAX + 1, // Standard coplanar feature overlapping f1
      properties: { icaoClass: 4, type: 0, floorM: 100, topM: 500, floorRefGnd: false, topRefGnd: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [1, 0],
            [3, 0],
            [3, 2],
            [1, 2],
            [1, 0],
          ],
        ],
      },
    };

    const result = await mergeCoplanarAirspaces([f1, f2]);
    expect(result).toHaveLength(2);
    // f1 preserves exact reserved id 7 and is NOT merged into f2
    const reserved = result.find((f) => f.id === 7);
    expect(reserved).toBeDefined();
    expect(reserved?.properties.id).toBeUndefined();
    // f2 is unmerged so it preserves its standard id (RESERVED_AIRSPACE_ID_MAX + 1)
    const standard = result.find((f) => f.id !== 7);
    expect(standard).toBeDefined();
    expect(standard?.id).toBe(RESERVED_AIRSPACE_ID_MAX + 1);
  });

  it('filters out micro-islands and micro-holes below MIN_RING_AREA_DEG2', async () => {
    const f1: AirspaceFeature = {
      type: 'Feature',
      id: 401,
      properties: { icaoClass: 4, type: 0, floorM: 100, topM: 500, floorRefGnd: false, topRefGnd: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
      },
    };
    const f2: AirspaceFeature = {
      type: 'Feature',
      id: 402,
      properties: { icaoClass: 4, type: 0, floorM: 100, topM: 500, floorRefGnd: false, topRefGnd: false },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0.5, 0],
            [1.5, 0],
            [1.5, 1],
            [0.5, 1],
            [0.5, 0],
          ],
          // Tiny hole with area ~ 5e-9 deg^2
          [
            [0.8, 0.5],
            [0.8001, 0.5],
            [0.8, 0.5001],
            [0.8, 0.5],
          ],
        ],
      },
    };

    const result = await mergeCoplanarAirspaces([f1, f2]);
    expect(result).toHaveLength(1);
    const coords = result[0].geometry.coordinates as [number, number][][];
    expect(coords).toHaveLength(1);
  });
});
