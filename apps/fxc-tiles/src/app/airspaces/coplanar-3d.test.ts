import { describe, expect, it } from 'vitest';

import type { AirspaceFeature } from './coplanar-3d';
import { mergeCoplanarAirspaces } from './coplanar-3d';

describe('mergeCoplanarAirspaces', () => {
  it('assigns unique numeric IDs to every feature', async () => {
    const f1: AirspaceFeature = {
      type: 'Feature',
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
    expect(result[0].id).toBe(1);
    expect(result[0].properties.id).toBeUndefined();
    expect(result[1].id).toBe(2);
    expect(result[1].properties.id).toBeUndefined();
  });

  it('unions overlapping coplanar airspaces into a single dissolved polygon', async () => {
    const f1: AirspaceFeature = {
      type: 'Feature',
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
    expect(result[0].id).toBe(1);
    expect(result[0].properties.id).toBeUndefined();
    expect(result[0].geometry.type).toBe('Polygon');
    // Resulting polygon bounding box spans [0,0] to [3,2]
    const ring = result[0].geometry.coordinates[0];
    expect(ring).toHaveLength(5);
  });

  it('does NOT union airspaces with different vertical bounds or classes', async () => {
    const f1: AirspaceFeature = {
      type: 'Feature',
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
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
  });

  it('filters out micro-islands and micro-holes below MIN_RING_AREA_DEG2', async () => {
    const f1: AirspaceFeature = {
      type: 'Feature',
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
