import { type AirspaceTyped, Class, Type } from '@flyxc/common';
import { FeatureType } from 'mapbox-vector-tile';
import { describe, expect, it, vi } from 'vitest';

import { getAirspaceListHtml, MAX_AIRSPACE_LIST_ITEMS, renderTiles } from './airspaces';

describe('renderTiles', () => {
  function makeMockFeature(opts: {
    id: number;
    type: number;
    extent?: number;
    bbox: [number, number, number, number];
    properties?: Record<string, unknown>;
  }) {
    return {
      id: opts.id,
      type: opts.type,
      extent: opts.extent ?? 4096,
      bbox: () => opts.bbox,
      properties: {
        name: `Airspace ${opts.id}`,
        icaoClass: Class.D,
        type: Type.CTR,
        floorM: 0,
        topM: 1000,
        ...opts.properties,
      },
      loadFlatGeometry: vi.fn(() => ({
        coords: [10, 10, 50, 10, 50, 50, 10, 10],
        ends: [8],
      })),
    };
  }

  it('skips non-polygon features and features outside the render canvas bbox', () => {
    const insideFeature = makeMockFeature({
      id: 1,
      type: FeatureType.POLYGON,
      bbox: [100, 100, 500, 500],
    });

    const outsideFeature = makeMockFeature({
      id: 2,
      type: FeatureType.POLYGON,
      // Bounding box far outside [0, 256] at 1:1 scale
      bbox: [3500, 3500, 4000, 4000],
    });

    const pointFeature = makeMockFeature({
      id: 3,
      type: FeatureType.POINT,
      bbox: [100, 100, 100, 100],
    });

    const features = [insideFeature, outsideFeature, pointFeature];
    const mockLayer = {
      length: features.length,
      [Symbol.iterator]: () => features[Symbol.iterator](),
    };

    const mockVectorTile: any = {
      getLayer: (name: string) => (name === 'asp' ? mockLayer : undefined),
    };

    const canvas = document.createElement('canvas');
    const ctx = {
      scale: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
    };
    canvas.getContext = vi.fn(() => ctx as any);

    const fetchInfoMap = new Map([
      [
        123,
        {
          abort: new AbortController(),
          renderTo: new Map([[0, canvas]]),
        },
      ],
    ]);

    renderTiles(
      123,
      fetchInfoMap,
      mockVectorTile,
      2000,
      [Class.D],
      [Type.CTR],
      10,
      10,
      new Date('2025-06-01T12:00:00Z'),
      50,
    );

    // Only insideFeature should decode polygons and draw paths
    expect(insideFeature.loadFlatGeometry).toHaveBeenCalledTimes(1);
    expect(outsideFeature.loadFlatGeometry).not.toHaveBeenCalled();
    expect(pointFeature.loadFlatGeometry).not.toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalledTimes(1);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });
});

describe('getAirspaceListHtml', () => {
  function makeAirspace(id: number): AirspaceTyped {
    return {
      id,
      name: `ASP ${id}`,
      icaoClass: Class.D,
      type: Type.CTR,
      floorM: 0,
      topM: 1000,
      floorRefGnd: false,
      topRefGnd: false,
      floorLabel: 'GND',
      topLabel: '1000m',
      country: 'FR',
      activity: 0,
    };
  }

  it('renders up to maxItems without more... when not truncated', () => {
    const airspaces = Array.from({ length: MAX_AIRSPACE_LIST_ITEMS }, (_, i) => makeAirspace(i + 1));
    const html = getAirspaceListHtml(airspaces);

    expect(html).toContain('ASP 1');
    expect(html).toContain(`ASP ${MAX_AIRSPACE_LIST_ITEMS}`);
    expect(html).not.toContain('more...');
  });

  it('truncates to maxItems and appends more... when more airspaces exist', () => {
    const airspaces = Array.from({ length: MAX_AIRSPACE_LIST_ITEMS + 1 }, (_, i) => makeAirspace(i + 1));
    const html = getAirspaceListHtml(airspaces);

    expect(html).toContain(`ASP ${MAX_AIRSPACE_LIST_ITEMS}`);
    expect(html).not.toContain(`ASP ${MAX_AIRSPACE_LIST_ITEMS + 1}`);
    expect(html).toContain('<i>more...</i>');
  });
});
