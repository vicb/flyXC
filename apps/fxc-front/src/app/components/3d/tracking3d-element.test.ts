import Point from '@arcgis/core/geometry/Point';
import type Polyline from '@arcgis/core/geometry/Polyline';
import type Graphic from '@arcgis/core/Graphic';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FixType } from '../../logic/live-track';
import * as liveTrackPopup from '../../logic/live-track-popup';
import * as msg from '../../logic/messages';
import { DistanceUnit, SpeedUnit } from '../../logic/units';
import { Tracking3DElement } from './tracking3d-element';

function makeMockLayer() {
  const graphics: Graphic[] = [];
  return {
    graphics,
    addMany: vi.fn((items: Graphic[]) => {
      graphics.push(...items);
    }),
    removeMany: vi.fn((items: Graphic[]) => {
      for (const item of items) {
        const idx = graphics.indexOf(item);
        if (idx >= 0) {
          graphics.splice(idx, 1);
        }
      }
    }),
  };
}

function makeGeojson(gpsAlts = [300, 350, 400]) {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [6.0, 45.0, gpsAlts[0]],
            [6.01, 45.01, gpsAlts[1]],
            [6.02, 45.02, gpsAlts[2]],
          ],
        },
        properties: {
          id: 'pilot-1',
          firstIndex: 10,
          lastIndex: 12,
          last: true,
          lastTimeSec: Math.floor(Date.now() / 1000),
          isEmergency: false,
          isUfo: false,
        },
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [6.01, 45.01, gpsAlts[1]],
        },
        properties: {
          pilotId: 'pilot-1',
          index: 11,
          fixType: FixType.message,
          timeSec: Math.floor(Date.now() / 1000),
          name: 'Pilot 1',
          alt: gpsAlts[1],
          gndAlt: 0,
          msg: 'All good',
          isUfo: false,
        },
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [6.02, 45.02, gpsAlts[2]],
        },
        properties: {
          pilotId: 'pilot-1',
          index: 12,
          fixType: FixType.pilot,
          timeSec: Math.floor(Date.now() / 1000),
          heading: 90,
          name: 'Pilot 1',
          alt: gpsAlts[2],
          gndAlt: 0,
          isUfo: false,
        },
      },
    ],
  };
}

describe('Tracking3DElement', () => {
  const mounted: Tracking3DElement[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    for (const el of mounted) {
      el.remove();
    }
    mounted.length = 0;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clamps markers above ground without shifting the track line and updates markers when sampler refines', async () => {
    let groundZ = 520;
    let onChanged: (() => void) | undefined;
    const removeHandle = vi.fn();

    const sampler = {
      noDataValue: -9999,
      queryElevation: vi.fn(
        (pt: Point) => new Point({ latitude: pt.latitude, longitude: pt.longitude, z: groundZ, hasZ: true }),
      ),
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'changed') {
          onChanged = cb;
        }
        return { remove: removeHandle };
      }),
    };

    const layer = makeMockLayer();
    const gndLayer = makeMockLayer();

    const el = new Tracking3DElement() as any;
    mounted.push(el);
    el.layer = layer;
    el.gndLayer = gndLayer;
    el.sampler = sampler;
    document.body.appendChild(el);
    await el.updateComplete;

    el.multiplier = 1;
    el.geojson = makeGeojson([300, 350, 400]);
    el.displayLabels = true;
    await el.updateComplete;

    // Track line stays at raw GPS altitudes (no artificial upward kink from coarse terrain).
    const lineGraphic = layer.graphics.find((g) => g.geometry?.type === 'polyline');
    expect(lineGraphic).toBeDefined();
    const path = (lineGraphic!.geometry as Polyline).paths[0];
    expect(path.map((p) => p[2])).toEqual([300, 350, 400]);

    // Markers clamp above ground at coarse zoom.
    const pointMarkers = layer.graphics.filter((g) => g.geometry?.type === 'point' && !g.attributes?.isLabel);
    expect(pointMarkers).toHaveLength(2);
    expect((pointMarkers[0].geometry as Point).z).toBe(520);
    expect((pointMarkers[1].geometry as Point).z).toBe(520);

    // Finer terrain tile drops below track altitude on zoom-in -> markers snap back down to track altitude.
    groundZ = 310;
    onChanged?.();
    vi.advanceTimersByTime(150);

    const updatedMarkers = layer.graphics.filter((g) => g.geometry?.type === 'point' && !g.attributes?.isLabel);
    expect((updatedMarkers[0].geometry as Point).z).toBe(350);
    expect((updatedMarkers[1].geometry as Point).z).toBe(400);

    el.remove();
    expect(removeHandle).toHaveBeenCalledTimes(1);
  });

  it('ignores invalid sampler values and falls back to track altitude', async () => {
    const sampler = {
      noDataValue: -9999,
      queryElevation: vi
        .fn()
        .mockReturnValueOnce(new Point({ latitude: 45, longitude: 6, z: -9999, hasZ: true }))
        .mockReturnValueOnce(new Point({ latitude: 45, longitude: 6, z: Number.NaN, hasZ: true }))
        .mockReturnValueOnce(new Point({ latitude: 45, longitude: 6, z: 3.4e37, hasZ: true })),
      on: vi.fn(() => ({ remove: vi.fn() })),
    };

    const layer = makeMockLayer();
    const gndLayer = makeMockLayer();

    const el = new Tracking3DElement() as any;
    mounted.push(el);
    el.layer = layer;
    el.gndLayer = gndLayer;
    el.sampler = sampler;
    document.body.appendChild(el);
    await el.updateComplete;

    el.multiplier = 1;
    el.geojson = makeGeojson([300, 350, 400]);
    await el.updateComplete;

    let pointMarkers = layer.graphics.filter((g) => g.geometry?.type === 'point' && !g.attributes?.isLabel);
    expect((pointMarkers[0].geometry as Point).z).toBe(350);
    expect((pointMarkers[1].geometry as Point).z).toBe(400);

    el.geojson = makeGeojson([300, 350, 400]);
    await el.updateComplete;
    pointMarkers = layer.graphics.filter((g) => g.geometry?.type === 'point' && !g.attributes?.isLabel);
    expect((pointMarkers[0].geometry as Point).z).toBe(350);
  });

  it('anchors the click popup to the clamped graphic geometry without double-offsetting labels', async () => {
    const sampler = {
      noDataValue: -9999,
      queryElevation: vi.fn(
        (pt: Point) => new Point({ latitude: pt.latitude, longitude: pt.longitude, z: 520, hasZ: true }),
      ),
      on: vi.fn(() => ({ remove: vi.fn() })),
    };

    const layer = makeMockLayer();
    const gndLayer = makeMockLayer();
    const openPopup = vi.fn().mockResolvedValue(undefined);
    const mockScene = { openPopup } as any;

    const el = new Tracking3DElement() as any;
    mounted.push(el);
    el.layer = layer;
    el.gndLayer = gndLayer;
    el.sampler = sampler;
    el.units = {
      altitude: DistanceUnit.Meters,
      speed: SpeedUnit.KilometersPerHour,
      vario: SpeedUnit.MetersPerSecond,
      distance: DistanceUnit.Kilometers,
    };
    document.body.appendChild(el);
    await el.updateComplete;

    el.multiplier = 1;
    el.geojson = makeGeojson([300, 350, 400]);
    el.displayLabels = true;
    await el.updateComplete;

    const pilotMarker = layer.graphics.find(
      (g) => g.geometry?.type === 'point' && g.attributes?.liveTrackIndex === 12 && !g.attributes?.isLabel,
    )!;
    const labelMarker = layer.graphics.find(
      (g) => g.geometry?.type === 'point' && g.attributes?.liveTrackIndex === 12 && g.attributes?.isLabel,
    )!;

    vi.spyOn(liveTrackPopup, 'popupContent').mockReturnValue({
      title: 'Pilot 1',
      content: 'details',
    });

    msg.clickSceneView.emit(pilotMarker, mockScene);
    expect(openPopup).toHaveBeenCalledTimes(1);
    expect(openPopup.mock.calls[0][0].location.z).toBe(550);

    msg.clickSceneView.emit(labelMarker, mockScene);
    expect(openPopup).toHaveBeenCalledTimes(2);
    expect(openPopup.mock.calls[1][0].location.z).toBe(550);
  });
});
