import Extent from '@arcgis/core/geometry/Extent';
import Point from '@arcgis/core/geometry/Point';
import Polygon from '@arcgis/core/geometry/Polygon';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import * as webMercatorUtils from '@arcgis/core/geometry/support/webMercatorUtils';
// @ts-expect-error Internal ArcGIS style evaluator without type declarations
import StyleRepository from '@arcgis/core/views/2d/engine/vectorTiles/style/StyleRepository.js';
import { TZDate } from '@date-fns/tz';
import * as common from '@flyxc/common';
import {
  AIRSPACE_3D_TILE_ZOOM,
  ASP_COLOR_DANGER,
  ASP_COLOR_OTHER,
  ASP_COLOR_PROHIBITED,
  ASP_COLOR_RESTRICTED,
  Class,
  RESERVED_AIRSPACE_ID_MAX,
  Type,
} from '@flyxc/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as meshModule from '../../logic/airspace3d-mesh';
import type * as airspacesLogic from '../../logic/airspaces';
import type * as airspaceSlice from '../../redux/airspace-slice';
import type * as appSlice from '../../redux/app-slice';
import type * as arcgisSlice from '../../redux/arcgis-slice';
import { store } from '../../redux/store';
import type * as trackSlice from '../../redux/track-slice';
import {
  Airspace3dElement,
  createGroundSampler,
  getVisibleTileCoverage,
  MAX_TILES_3D,
  MIN_3D_ZOOM,
} from './airspace3d-element';
import { buildAirspaceVectorTileStyle, FlatAirspace3dElement } from './flat-airspace3d-element';

const hoisted = vi.hoisted(() => {
  const state = {
    maxAltitude: 3000,
    showAirspace: true,
    showClasses: [] as Class[],
    showTypes: [] as Type[],
    opacity: 70,
    multiplier: 1,
    currentTrack: null as { id: string } | null,
    timeSec: 1_752_577_200, // 2025-07-15T11:00:00Z
  };

  type WatchEntry = { getter: () => unknown; cb: (val: any) => void; removed: boolean };
  const watchEntries: WatchEntry[] = [];
  const graphicsLayers: any[] = [];
  const vectorTileLayers: any[] = [];
  const tilePayloads = new Map<number, any[]>();
  const pendingBuilds: Promise<unknown>[] = [];
  const getAirspaceListMock = vi.fn(
    async (..._args: any[]) => [{ name: 'Airspace list', floorM: 0, topM: 1000 }] as any[],
  );

  return {
    state,
    watchEntries,
    graphicsLayers,
    vectorTileLayers,
    tilePayloads,
    pendingBuilds,
    getAirspaceListMock,
  };
});

vi.mock('@arcgis/core/core/reactiveUtils.js', () => ({
  watch: vi.fn((getter: () => unknown, cb: (val: any) => void) => {
    const entry = { getter, cb, removed: false };
    hoisted.watchEntries.push(entry);
    return {
      remove: () => {
        entry.removed = true;
      },
    };
  }),
}));

vi.mock('@arcgis/core/layers/GraphicsLayer', () => ({
  default: class MockGraphicsLayer {
    graphics: any[] = [];
    destroyed = false;
    elevationInfo: any;
    constructor(opts?: any) {
      this.elevationInfo = opts?.elevationInfo;
      hoisted.graphicsLayers.push(this);
    }
    addMany(items: any[]) {
      this.graphics.push(...items);
    }
    removeAll() {
      this.graphics.length = 0;
    }
    removeMany(items: any[]) {
      this.graphics = this.graphics.filter((g) => !items.includes(g));
    }
    destroy() {
      this.destroyed = true;
    }
  },
}));

vi.mock('@arcgis/core/layers/VectorTileLayer', () => ({
  default: class MockVectorTileLayer {
    style: any;
    opacity = 1;
    destroyed = false;
    constructor(opts?: any) {
      this.style = opts?.style;
      hoisted.vectorTileLayers.push(this);
    }
    destroy() {
      this.destroyed = true;
    }
  },
}));

vi.mock('mapbox-vector-tile', () => ({
  VectorTile: class MockVectorTile {
    layers: Record<string, any> = {};
    constructor(data: Uint8Array) {
      const id = data[0];
      const features = hoisted.tilePayloads.get(id) ?? [];
      const aspLayer = {
        length: features.length,
        feature: (i: number) => features[i],
        [Symbol.iterator]: () => features[Symbol.iterator](),
      };
      this.layers = {
        asp: aspLayer,
      };
    }
    getLayer(name: string) {
      return this.layers[name];
    }
  },
  FeatureType: {
    UNKNOWN: 0,
    POINT: 1,
    LINESTRING: 2,
    POLYGON: 3,
  },
}));

vi.mock('../../redux/airspace-slice', async (importOriginal) => {
  const actual = await importOriginal<typeof airspaceSlice>();
  return {
    ...actual,
    selectMaxAltitude: () => hoisted.state.maxAltitude,
    selectShowAirspaces: () => hoisted.state.showAirspace,
    selectShowClasses: () => hoisted.state.showClasses,
    selectShowTypes: () => hoisted.state.showTypes,
    selectOpacity: () => hoisted.state.opacity,
  };
});

vi.mock('../../redux/arcgis-slice', async (importOriginal) => {
  const actual = await importOriginal<typeof arcgisSlice>();
  return {
    ...actual,
    selectAltitudeMultiplier: () => hoisted.state.multiplier,
  };
});

vi.mock('../../redux/app-slice', async (importOriginal) => {
  const actual = await importOriginal<typeof appSlice>();
  return {
    ...actual,
    selectTimeSec: () => hoisted.state.timeSec,
  };
});

vi.mock('../../redux/track-slice', async (importOriginal) => {
  const actual = await importOriginal<typeof trackSlice>();
  return {
    ...actual,
    selectCurrentTrack: () => hoisted.state.currentTrack,
  };
});

vi.mock('../../logic/airspaces', async (importOriginal) => {
  const actual = await importOriginal<typeof airspacesLogic>();
  return {
    ...actual,
    getAirspaceList: hoisted.getAirspaceListMock,
  };
});

vi.mock('../../logic/airspace3d-mesh', async (importOriginal) => {
  const actual = await importOriginal<typeof meshModule>();
  return {
    ...actual,
    buildAirspaceMesh: vi.fn((params: Parameters<typeof actual.buildAirspaceMesh>[0]) => {
      const p = actual.buildAirspaceMesh(params);
      hoisted.pendingBuilds.push(p);
      return p;
    }),
    buildAirspaceMeshData: vi.fn((params: Parameters<typeof actual.buildAirspaceMeshData>[0]) => {
      const p = actual.buildAirspaceMeshData(params);
      hoisted.pendingBuilds.push(p);
      return p;
    }),
    buildAirspaceFootprint: vi.fn((...args: Parameters<typeof actual.buildAirspaceFootprint>) => {
      const p = actual.buildAirspaceFootprint(...args);
      hoisted.pendingBuilds.push(p);
      return p;
    }),
    extrudeAirspaceFootprint: vi.fn(actual.extrudeAirspaceFootprint),
  };
});

vi.mock('@flyxc/common', async (importOriginal) => {
  const actual = await importOriginal<typeof common>();
  return {
    ...actual,
    applyOverrides: vi.fn(actual.applyOverrides),
  };
});

function makeMockMap() {
  const layers: any[] = [];
  return {
    layers,
    add: vi.fn((layer: any) => {
      layers.push(layer);
    }),
    remove: vi.fn((layer: any) => {
      const idx = layers.indexOf(layer);
      if (idx >= 0) {
        layers.splice(idx, 1);
      }
    }),
  } as any;
}

function makeMockView(zoom: number, xmin = 5.9, ymin = 45.4, xmax = 6.2, ymax = 45.6) {
  const stageLayers: Record<string, { apiLayerViewUid: string; pickable: boolean }> = {};
  let uidSeq = 1;
  return {
    zoom,
    stationary: true,
    center: new Point({
      longitude: (xmin + xmax) / 2,
      latitude: (ymin + ymax) / 2,
      spatialReference: { wkid: 4326 },
    }),
    extent: new Extent({
      xmin,
      ymin,
      xmax,
      ymax,
      spatialReference: { wkid: 4326 },
    }),
    stage: {
      _layers: stageLayers,
      renderer: {
        navigationDepthCache: {
          getMinimalDepthForArea: () => 500,
        },
      },
    },
    whenLayerView: vi.fn(async () => {
      const uid = `lv-${uidSeq++}`;
      stageLayers[uid] = { apiLayerViewUid: uid, pickable: true };
      return { uid };
    }),
  } as any;
}

function makeFeature(props: Record<string, string>, ring: number[][], holes: number[][][] = [], id?: number) {
  const featureId = id ?? (props.id != null ? Number(props.id) : undefined);
  return {
    id: featureId,
    type: 3,
    properties: props,
    toGeoJSON: () => ({
      type: 'Feature',
      id: featureId,
      geometry: {
        type: 'Polygon',
        coordinates: [ring, ...holes],
      },
    }),
  };
}

let nextAirspaceId = RESERVED_AIRSPACE_ID_MAX + 1;

function makeAirspaceProps(overrides: Record<string, string | number | boolean> = {}): Record<string, any> {
  return {
    id: nextAirspaceId++,
    name: 'CHAMBERY CTR',
    category: 'CTR',
    country: 'FR',
    floorM: 0,
    floorLabel: 'GND',
    floorRefGnd: true,
    topM: 1000,
    topLabel: '1000m MSL',
    topRefGnd: false,
    type: Type.CTR,
    icaoClass: Class.D,
    activity: 0,
    flags: 0,
    ...overrides,
  };
}

async function flushAsync() {
  for (let i = 0; i < 6; i++) {
    await vi.advanceTimersByTimeAsync(10);
    if (hoisted.pendingBuilds.length > 0) {
      const batch = hoisted.pendingBuilds.splice(0, hoisted.pendingBuilds.length);
      await Promise.all(batch);
    }
    await Promise.resolve();
  }
}

function hexToUnitRgba(hex: string): [number, number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
}

function evaluateStyle(style: ReturnType<typeof buildAirspaceVectorTileStyle>, values: Record<string, unknown>) {
  const repo = new StyleRepository(style, false);
  const layer = repo.layers[0];
  const filter = layer.getFeatureFilter();
  const visible = filter ? filter.filter({ values }, 10) : true;
  const color = layer.getPaintValue('fill-color', 10, { values }) as number[];
  return { visible, color };
}

describe('buildAirspaceVectorTileStyle', () => {
  it('renders and filters non-overridden airspaces by class and type colors', () => {
    const style = buildAirspaceVectorTileStyle({
      maxAltitude: 3000,
      showClasses: [Class.A, Class.B, Class.C, Class.D, Class.E],
      showTypes: [Type.Prohibited, Type.Restricted, Type.Danger],
      opacity: 70,
      date: new TZDate('2025-07-15T12:00:00', 'Europe/Paris'),
      tileServer: 'cloud',
    });

    const classD = evaluateStyle(style, { name: 'CTR LYON', icaoClass: Class.D, type: Type.CTR, floorM: 0 });
    expect(classD.visible).toBe(true);
    expect(classD.color).toEqual(hexToUnitRgba(ASP_COLOR_PROHIBITED));

    const classE = evaluateStyle(style, { name: 'TMA LYON 3', icaoClass: Class.E, type: Type.TMA, floorM: 1000 });
    expect(classE.visible).toBe(true);
    expect(classE.color).toEqual(hexToUnitRgba(ASP_COLOR_RESTRICTED));

    const lowAlt = evaluateStyle(style, {
      name: 'PROTECTED ZONE',
      icaoClass: Class.SUA,
      type: Type.LowAltitudeOverflightRestriction,
      floorM: 0,
    });
    expect(lowAlt.visible).toBe(true);
    expect(lowAlt.color).toEqual(hexToUnitRgba(ASP_COLOR_RESTRICTED));

    const danger = evaluateStyle(style, { name: 'LF-D 123', icaoClass: Class.SUA, type: Type.Danger, floorM: 500 });
    expect(danger.visible).toBe(true);
    expect(danger.color).toEqual(hexToUnitRgba(ASP_COLOR_DANGER));

    const other = evaluateStyle(style, { name: 'GLIDING', icaoClass: Class.SUA, type: Type.Other, floorM: 0 });
    expect(other.visible).toBe(false);
    expect(other.color).toEqual(hexToUnitRgba(ASP_COLOR_OTHER));

    const tooHigh = evaluateStyle(style, { name: 'HIGH TMA', icaoClass: Class.D, type: Type.TMA, floorM: 3500 });
    expect(tooHigh.visible).toBe(false);
  });

  it('keeps wildcard visibility when Type.Other is enabled', () => {
    const style = buildAirspaceVectorTileStyle({
      maxAltitude: 3000,
      showClasses: [],
      showTypes: [Type.Other],
      opacity: 70,
      date: new Date('2025-07-15T12:00:00Z'),
      tileServer: 'cloud',
    });

    expect(style.layers[0].filter).toEqual(['all', ['any', ['boolean', true]], ['<=', ['get', 'floorM'], 3000]]);
  });
});

describe('getVisibleTileCoverage', () => {
  it('returns empty array when zoomed out below MIN_3D_ZOOM or missing extent', () => {
    expect(getVisibleTileCoverage(makeMockView(9.9)).tiles).toEqual([]);
    expect(getVisibleTileCoverage({ zoom: 10, extent: null, center: null } as any).tiles).toEqual([]);
    expect(getVisibleTileCoverage({ zoom: Number.NaN } as any).tiles).toEqual([]);
  });

  it('steps tile zoom down to cover wide/tilted frustum borders and caps at MAX_TILES_3D', () => {
    const view = makeMockView(10, 4.0, 44.0, 8.0, 47.0);
    const { tiles } = getVisibleTileCoverage(view);
    expect(tiles.length).toBeLessThanOrEqual(MAX_TILES_3D);
    expect(tiles[0].z).toBe(AIRSPACE_3D_TILE_ZOOM);

    // Very wide extent at zoom 10 uses AIRSPACE_3D_TILE_ZOOM (6) and still enforces MAX_TILES_3D sorted from center.
    const hugeView = makeMockView(10, -10.0, 35.0, 20.0, 55.0);
    const { tiles: cappedTiles } = getVisibleTileCoverage(hugeView);
    expect(cappedTiles).toHaveLength(MAX_TILES_3D);
    expect(cappedTiles[0].z).toBe(AIRSPACE_3D_TILE_ZOOM);

    // SceneView.visibleArea expands bounds beyond SceneView.extent alone while clamping horizon extremes.
    const tiltedView = {
      ...makeMockView(10, 5.5, 45.4, 6.5, 45.9),
      visibleArea: {
        extent: new Extent({ xmin: 5.5, ymin: 44.9, xmax: 6.5, ymax: 47.2, spatialReference: { wkid: 4326 } }),
      },
    } as any;
    const coverage = getVisibleTileCoverage(tiltedView);
    expect(coverage.bounds).not.toBeNull();
    expect(coverage.bounds!.maxLat).toBeGreaterThanOrEqual(47.2);
    expect(coverage.bounds!.minLat).toBeLessThanOrEqual(44.9);

    const horizonView = {
      ...makeMockView(10, 5.5, 45.4, 6.5, 45.9),
      visibleArea: {
        extent: new Extent({ xmin: -20, ymin: 30, xmax: 30, ymax: 60, spatialReference: { wkid: 4326 } }),
      },
    } as any;
    const clampedCoverage = getVisibleTileCoverage(horizonView);
    expect(clampedCoverage.bounds).not.toBeNull();
    expect(clampedCoverage.bounds!.minLon).toBeGreaterThan(-20);
    expect(clampedCoverage.bounds!.maxLon).toBeLessThan(30);
    expect(clampedCoverage.bounds!.minLat).toBeGreaterThan(30);
    expect(clampedCoverage.bounds!.maxLat).toBeLessThan(60);
  });

  it('converts WebMercator extents to geographic tile coordinates', () => {
    const [xmin, ymin] = webMercatorUtils.lngLatToXY(5.9, 45.4);
    const [xmax, ymax] = webMercatorUtils.lngLatToXY(6.2, 45.6);
    const view = {
      zoom: 10,
      center: new Point({ longitude: 6.05, latitude: 45.5, spatialReference: { wkid: 4326 } }),
      extent: new Extent({ xmin, ymin, xmax, ymax, spatialReference: SpatialReference.WebMercator }),
    } as any;

    const { tiles } = getVisibleTileCoverage(view);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles[0].z).toBe(AIRSPACE_3D_TILE_ZOOM);
  });
});

describe('createGroundSampler', () => {
  it('returns 0 when sampler is missing', () => {
    const sample = createGroundSampler(undefined);
    expect(sample(6, 45)).toBe(0);
  });

  it('reads WGS84 elevationAt directly and filters invalid/sentinel values', () => {
    const elevationAt = vi.fn((lon: number) => (lon === 1 ? -9999 : lon === 2 ? 25000 : lon === 3 ? Number.NaN : 850));
    const sample = createGroundSampler({
      noDataValue: -9999,
      spatialReference: { isWGS84: true, isWebMercator: false },
      elevationAt,
    } as any);

    expect(sample(6, 45)).toBe(850);
    expect(sample(1, 45)).toBe(0);
    expect(sample(2, 45)).toBe(0);
    expect(sample(3, 45)).toBe(0);
  });

  it('projects coordinates for WebMercator samplers and falls back to queryElevation for others', () => {
    const wmElevationAt = vi.fn(() => 420);
    const wmSample = createGroundSampler({
      noDataValue: -1,
      spatialReference: { isWGS84: false, isWebMercator: true },
      elevationAt: wmElevationAt,
    } as any);

    expect(wmSample(6, 45)).toBe(420);
    const [expectedX, expectedY] = webMercatorUtils.lngLatToXY(6, 45);
    expect(wmElevationAt).toHaveBeenCalledWith(expect.closeTo(expectedX, 4), expect.closeTo(expectedY, 4));

    const queryElevation = vi.fn(() => ({ z: 615 }));
    const otherSample = createGroundSampler({
      noDataValue: -1,
      spatialReference: { isWGS84: false, isWebMercator: false },
      queryElevation,
    } as any);

    expect(otherSample(6, 45)).toBe(615);
    expect(otherSample(7, 46)).toBe(615);
    expect(queryElevation).toHaveBeenCalledTimes(2);
    expect((queryElevation.mock.calls as any[][])[0][0]).toBe((queryElevation.mock.calls as any[][])[1][0]);
  });
});

describe('Airspace3dElement', () => {
  let element: Airspace3dElement;
  let mockMap: ReturnType<typeof makeMockMap>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    nextAirspaceId = RESERVED_AIRSPACE_ID_MAX + 1;
    hoisted.state.maxAltitude = 3000;
    hoisted.state.showAirspace = true;
    hoisted.state.showClasses = [Class.C, Class.D];
    hoisted.state.showTypes = [Type.CTR, Type.Restricted];
    hoisted.state.opacity = 70;
    hoisted.state.multiplier = 1;
    hoisted.state.currentTrack = null;
    hoisted.state.timeSec = 1_752_577_200;
    hoisted.watchEntries.length = 0;
    hoisted.graphicsLayers.length = 0;
    hoisted.vectorTileLayers.length = 0;
    hoisted.tilePayloads.clear();
    hoisted.pendingBuilds.length = 0;
    hoisted.getAirspaceListMock.mockClear();
    vi.mocked(meshModule.buildAirspaceMesh).mockClear();
    vi.mocked(meshModule.buildAirspaceMeshData).mockClear();
    vi.mocked(meshModule.buildAirspaceFootprint).mockClear();
    vi.mocked(meshModule.extrudeAirspaceFootprint).mockClear();
    vi.mocked(common.applyOverrides).mockClear();

    const origFetch = globalThis.fetch;
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const match = /\/(\d+)\/(\d+)(?:-[\w-]+)?\.pbf$/.exec(url);
      if (!match) {
        return origFetch(input, init);
      }
      // Assign deterministic tile id 1 or 2 based on tile parity.
      const id = ((Number(match[1]) + Number(match[2])) % 2) + 1;
      return {
        ok: true,
        arrayBuffer: async () => new Uint8Array([id]).buffer,
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    mockMap = makeMockMap();
    element = new Airspace3dElement();
    document.body.appendChild(element);
  });

  afterEach(() => {
    element.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('stays inactive below MIN_3D_ZOOM and cleans up GraphicsLayer when zooming back out', async () => {
    const view = makeMockView(MIN_3D_ZOOM - 1);
    element.map = mockMap;
    element.view = view;
    await element.updateComplete;
    await flushAsync();

    expect(hoisted.vectorTileLayers).toHaveLength(0);
    expect(hoisted.graphicsLayers).toHaveLength(0);
    expect(mockMap.layers).toHaveLength(0);

    // Prepare single tile feature when zoomed in.
    const polyRing = [
      [6.0, 45.45],
      [6.05, 45.45],
      [6.05, 45.5],
      [6.0, 45.5],
      [6.0, 45.45],
    ];
    hoisted.tilePayloads.set(1, [makeFeature(makeAirspaceProps(), polyRing)]);
    hoisted.tilePayloads.set(2, [makeFeature(makeAirspaceProps(), polyRing)]);

    view.zoom = MIN_3D_ZOOM;
    for (const entry of hoisted.watchEntries) {
      if (!entry.removed) {
        entry.cb(MIN_3D_ZOOM);
      }
    }
    await vi.advanceTimersByTimeAsync(260);
    await flushAsync();

    expect(hoisted.graphicsLayers).toHaveLength(1);
    expect(hoisted.graphicsLayers[0].graphics.length).toBe(2);
    expect(hoisted.graphicsLayers[0].graphics.every((g: any) => g.attributes.isAirspace)).toBe(true);

    // Zooming back below MIN_3D_ZOOM removes and destroys the 3D GraphicsLayer.
    view.zoom = 9;
    for (const entry of hoisted.watchEntries) {
      if (!entry.removed) {
        entry.cb(-1);
      }
    }
    await flushAsync();

    expect(hoisted.graphicsLayers[0].destroyed).toBe(true);
    expect(mockMap.layers).toHaveLength(0);
  });

  it('respects the enabled property, clearing 3D graphics when disabled and re-rendering when enabled', async () => {
    const view = makeMockView(10, 5.5, 45.3, 5.8, 45.7);
    const polyRing = [
      [5.55, 45.45],
      [5.65, 45.45],
      [5.65, 45.5],
      [5.55, 45.5],
      [5.55, 45.45],
    ];
    hoisted.tilePayloads.set(1, [makeFeature(makeAirspaceProps(), polyRing)]);
    hoisted.tilePayloads.set(2, [makeFeature(makeAirspaceProps(), polyRing)]);

    element.map = mockMap;
    element.view = view;
    element.enabled = false;
    await element.updateComplete;
    await vi.advanceTimersByTimeAsync(260);
    await flushAsync();

    expect(hoisted.graphicsLayers).toHaveLength(0);
    expect(mockMap.layers).toHaveLength(0);

    // Enabling triggers rendering
    element.enabled = true;
    await element.updateComplete;
    await vi.advanceTimersByTimeAsync(260);
    await flushAsync();

    expect(hoisted.graphicsLayers).toHaveLength(1);
    expect(mockMap.layers).toHaveLength(1);

    // Disabling clears the layer
    element.enabled = false;
    await element.updateComplete;
    await flushAsync();

    expect(hoisted.graphicsLayers[0].destroyed).toBe(true);
    expect(mockMap.layers).toHaveLength(0);
  });

  it('merges multi-tile polygons, reuses cached footprints across multiplier updates, and updates opacity in place', async () => {
    // Wide extent covering tile 32 and tile 33 at zoom 6 so both tile id 1 and id 2 are fetched.
    const view = makeMockView(10, 5.5, 45.3, 5.8, 45.7);
    const sharedProps = makeAirspaceProps({ floorRefGnd: false, floorM: 200, topM: 1000 });
    const secondSharedCategoryProps = makeAirspaceProps({
      name: 'CHAMBERY TMA',
      floorRefGnd: false,
      floorM: 400,
      topM: 1200,
    });
    hoisted.tilePayloads.set(1, [
      makeFeature(sharedProps, [
        [5.55, 45.45],
        [5.65, 45.45],
        [5.65, 45.5],
        [5.55, 45.5],
        [5.55, 45.45],
      ]),
      makeFeature(secondSharedCategoryProps, [
        [5.65, 45.45],
        [5.75, 45.45],
        [5.75, 45.5],
        [5.65, 45.5],
        [5.65, 45.45],
      ]),
    ]);
    hoisted.tilePayloads.set(2, [
      makeFeature(sharedProps, [
        [5.55, 45.45],
        [5.65, 45.45],
        [5.65, 45.5],
        [5.55, 45.5],
        [5.55, 45.45],
      ]),
    ]);

    element.map = mockMap;
    element.view = view;
    await element.updateComplete;
    await flushAsync();

    // Both airspaces share the same color category, so they batch into 1 Mesh Graphic and 1 Line Graphic.
    expect(hoisted.graphicsLayers[0].graphics).toHaveLength(2);
    const meshGraphic = hoisted.graphicsLayers[0].graphics.find((g: any) => !g.attributes.isAirspaceLine);
    const lineGraphic = hoisted.graphicsLayers[0].graphics.find((g: any) => g.attributes.isAirspaceLine);
    expect(meshGraphic?.attributes.category).toBe(common.AirspaceColorCategory.Prohibited);
    expect(lineGraphic?.attributes.category).toBe(common.AirspaceColorCategory.Prohibited);
    expect(meshModule.buildAirspaceFootprint).toHaveBeenCalledTimes(2);
    expect(meshModule.extrudeAirspaceFootprint).toHaveBeenCalledTimes(2);

    const prevGraphic = meshGraphic!;
    const prevSymbol = prevGraphic.symbol;
    const prevGeom = prevGraphic.geometry;
    const prevLineSymbol = lineGraphic!.symbol;
    const prevLineGeom = lineGraphic!.geometry;
    hoisted.state.opacity = 30;
    store.dispatch({ type: 'TEST_OPACITY' });
    await element.updateComplete;

    expect(meshModule.buildAirspaceFootprint).toHaveBeenCalledTimes(2);
    expect(meshModule.extrudeAirspaceFootprint).toHaveBeenCalledTimes(2);
    expect(prevGraphic.symbol).not.toBe(prevSymbol);
    expect(lineGraphic!.symbol).not.toBe(prevLineSymbol);

    // Changing exaggeration multiplier re-extrudes synchronously and updates Graphic.geometry in place.
    hoisted.state.multiplier = 2;
    store.dispatch({ type: 'TEST_MULTIPLIER' });
    await element.updateComplete;
    await flushAsync();

    expect(meshModule.buildAirspaceFootprint).toHaveBeenCalledTimes(2);
    expect(meshModule.extrudeAirspaceFootprint).toHaveBeenCalledTimes(4);
    expect(hoisted.graphicsLayers[0].graphics).toHaveLength(2);
    expect(meshGraphic).toBe(prevGraphic);
    expect(meshGraphic.geometry).not.toBe(prevGeom);
    expect(lineGraphic!.geometry).not.toBe(prevLineGeom);

    // Updating showClasses or showTypes immediately refreshes view and removes excluded airspaces
    hoisted.state.showClasses = [];
    hoisted.state.showTypes = [];
    store.dispatch({ type: 'TEST_FILTER' });
    await element.updateComplete;
    await flushAsync();

    expect(hoisted.graphicsLayers[0].graphics).toHaveLength(0);
  });

  it('passes active track date to applyOverrides when a track is loaded, and current date otherwise', async () => {
    const view = makeMockView(10, 6.0, 45.45, 6.02, 45.47);
    const props = makeAirspaceProps();
    hoisted.tilePayloads.set(1, [
      makeFeature(props, [
        [6.0, 45.45],
        [6.02, 45.45],
        [6.02, 45.47],
        [6.0, 45.47],
        [6.0, 45.45],
      ]),
    ]);
    hoisted.tilePayloads.set(2, hoisted.tilePayloads.get(1)!);

    // Without track: uses wall-clock Date (2026+ or current Date.now()).
    element.map = mockMap;
    element.view = view;
    await element.updateComplete;
    await flushAsync();

    expect(common.applyOverrides).toHaveBeenCalled();
    const firstDate = vi.mocked(common.applyOverrides).mock.calls[0][1];
    expect(firstDate.getFullYear()).not.toBe(2025);

    // With active track: uses new Date(timeSec * 1000) -> 2025-07-15.
    vi.mocked(common.applyOverrides).mockClear();
    hoisted.state.currentTrack = { id: 'track-1' };
    hoisted.state.timeSec = 1_752_577_200;
    store.dispatch({ type: 'TEST_TRACK' });
    await element.updateComplete;
    await flushAsync();

    expect(common.applyOverrides).toHaveBeenCalled();
    const trackDate = vi.mocked(common.applyOverrides).mock.calls[0][1];
    expect(trackDate.getTime()).toBe(1_752_577_200 * 1000);
  });

  it('debounces sampler changed events, skips unchanged terrain, and only rebuilds changed GND meshes', async () => {
    let samplerChangeCb: (() => void) | undefined;
    let elevation = 500;
    const mockSampler = {
      noDataValue: -9999,
      spatialReference: { isWGS84: true, isWebMercator: false },
      elevationAt: () => elevation,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'changed') {
          samplerChangeCb = cb;
        }
        return { remove: vi.fn() };
      }),
    } as any;

    const view = makeMockView(10, 6.0, 45.45, 6.02, 45.47);
    const mslProps = makeAirspaceProps({ name: 'MSL ZONE', floorRefGnd: false, floorM: 500, topM: 1500 });
    const gndProps = makeAirspaceProps({ name: 'GND ZONE', floorRefGnd: true, floorM: 3200, topM: 3800 });
    const ring = [
      [6.0, 45.45],
      [6.02, 45.45],
      [6.02, 45.47],
      [6.0, 45.47],
      [6.0, 45.45],
    ];

    // Put both features in the cached tile, with GND ZONE initially filtered out by maxAltitude (3000).
    hoisted.tilePayloads.set(1, [makeFeature(mslProps, ring), makeFeature(gndProps, ring)]);
    hoisted.tilePayloads.set(2, hoisted.tilePayloads.get(1)!);

    element.map = mockMap;
    element.view = view;
    element.sampler = mockSampler;
    await element.updateComplete;
    await flushAsync();

    expect(meshModule.buildAirspaceFootprint).toHaveBeenCalledTimes(1);
    expect(meshModule.extrudeAirspaceFootprint).toHaveBeenCalledTimes(1);
    elevation = 900;
    samplerChangeCb?.();
    await vi.advanceTimersByTimeAsync(500);
    await flushAsync();
    expect(meshModule.extrudeAirspaceFootprint).toHaveBeenCalledTimes(1);

    // Increase maxAltitude so GND ZONE becomes visible alongside MSL ZONE.
    hoisted.state.maxAltitude = 3500;
    store.dispatch({ type: 'TEST_RELOAD' });
    await element.updateComplete;
    await flushAsync();

    // MSL ZONE stays cached; only GND ZONE is newly built on maxAltitude reload.
    expect(meshModule.buildAirspaceFootprint).toHaveBeenCalledTimes(2);
    expect(meshModule.extrudeAirspaceFootprint).toHaveBeenCalledTimes(2);
    vi.mocked(meshModule.buildAirspaceFootprint).mockClear();
    vi.mocked(meshModule.extrudeAirspaceFootprint).mockClear();

    // If terrain height did not change, sampler event skips rebuilding GND ZONE.
    samplerChangeCb?.();
    await vi.advanceTimersByTimeAsync(500);
    await flushAsync();
    expect(meshModule.extrudeAirspaceFootprint).toHaveBeenCalledTimes(0);

    // When terrain height changes by >= 5m, sampler event synchronously re-extrudes ONLY GND ZONE without re-triangulating.
    elevation = 1200;
    samplerChangeCb?.();
    await vi.advanceTimersByTimeAsync(500);
    await flushAsync();

    expect(meshModule.buildAirspaceFootprint).toHaveBeenCalledTimes(0);
    expect(meshModule.extrudeAirspaceFootprint).toHaveBeenCalledTimes(1);
    expect(vi.mocked(meshModule.extrudeAirspaceFootprint).mock.calls[0][1].name).toBe('GND ZONE');
  });

  it('cleans up layers when showAirspace becomes false and on disconnectedCallback', async () => {
    const view = makeMockView(10, 6.0, 45.45, 6.02, 45.47);
    hoisted.tilePayloads.set(1, [
      makeFeature(makeAirspaceProps(), [
        [6.0, 45.45],
        [6.02, 45.45],
        [6.02, 45.47],
        [6.0, 45.47],
        [6.0, 45.45],
      ]),
    ]);
    hoisted.tilePayloads.set(2, hoisted.tilePayloads.get(1)!);

    element.map = mockMap;
    element.view = view;
    await element.updateComplete;
    await flushAsync();

    expect(hoisted.graphicsLayers).toHaveLength(1);
    expect(view.stage.renderer.navigationDepthCache.getMinimalDepthForArea()).toBeNull();
    hoisted.state.showAirspace = false;
    store.dispatch({ type: 'TEST_HIDE' });
    await element.updateComplete;

    expect(hoisted.graphicsLayers[0].destroyed).toBe(true);
    expect(mockMap.layers).toHaveLength(0);
    expect(view.stage.renderer.navigationDepthCache.getMinimalDepthForArea()).toBe(500);

    element.disconnectedCallback();
    expect(hoisted.watchEntries.every((w) => w.removed)).toBe(true);
  });

  it('opens popup from local 3D matches or getAirspaceList fallback, respects holes, and toggles pickable', async () => {
    const view = makeMockView(10, 6.0, 45.45, 6.04, 45.49);
    const ring = [
      [6.0, 45.45],
      [6.04, 45.45],
      [6.04, 45.49],
      [6.0, 45.49],
      [6.0, 45.45],
    ];
    const hole = [
      [6.015, 45.465],
      [6.025, 45.465],
      [6.025, 45.475],
      [6.015, 45.475],
      [6.015, 45.465],
    ];
    hoisted.tilePayloads.set(1, [
      makeFeature(makeAirspaceProps({ name: 'LOCAL ZONE', floorRefGnd: false, floorM: 600, topM: 1200 }), ring, [hole]),
    ]);
    hoisted.tilePayloads.set(2, hoisted.tilePayloads.get(1)!);

    const scene = { openPopup: vi.fn(async () => undefined), closePopup: vi.fn(async () => undefined) } as any;
    element.map = mockMap;
    element.view = view;
    await element.updateComplete;
    await flushAsync();

    // Single-tile airspaces pass lightweight { rings, extent } objects without constructing ArcGIS Polygon instances.
    const passedPoly = vi.mocked(meshModule.buildAirspaceFootprint).mock.calls[0][0];
    expect(passedPoly).not.toBeInstanceOf(Polygon);
    expect(passedPoly.extent).toEqual({ xmin: 6.0, ymin: 45.45, xmax: 6.04, ymax: 45.49 });

    // Non-pickable by default so map drag anchors on ground; setPickable toggles stage layer flag.
    expect(view.stage._layers['lv-1'].pickable).toBe(false);
    expect(view.stage.renderer.navigationDepthCache.getMinimalDepthForArea()).toBeNull();
    element.setPickable(true);
    expect(view.stage._layers['lv-1'].pickable).toBe(true);
    element.setPickable(false);
    expect(view.stage._layers['lv-1'].pickable).toBe(false);
    expect(view.stage.renderer.navigationDepthCache.getMinimalDepthForArea()).toBeNull();

    // Clicking an active 3D volume queries 2D tiles, highlights the matching 3D volume, and opens popup.
    hoisted.getAirspaceListMock.mockResolvedValueOnce([
      {
        name: 'LOCAL ZONE',
        type: Type.CTR,
        icaoClass: Class.D,
        floorM: 600,
        floorRefGnd: false,
        floorLabel: '600m',
        topM: 1200,
        topRefGnd: false,
        topLabel: '1200m',
      } as any,
    ]);
    await element.handleClick([{ lat: 45.455, lon: 6.005, z: 900 }], scene);
    expect(hoisted.getAirspaceListMock).toHaveBeenCalledTimes(1);
    expect(scene.openPopup).toHaveBeenCalledTimes(1);
    expect(scene.openPopup.mock.calls[0][0].location.z).toBe(900);

    // Selected airspace volume is highlighted on the GraphicsLayer.
    const highlight = hoisted.graphicsLayers[0].graphics.find((g: any) => g.attributes?.isAirspaceHighlight);
    expect(highlight).toBeDefined();

    // Clicking an empty location without airspace clears the highlight and closes any open popup.
    hoisted.getAirspaceListMock.mockResolvedValueOnce([]);
    await element.handleClick([{ lat: 40.0, lon: 0.0 }], scene);
    expect(hoisted.graphicsLayers[0].graphics.find((g: any) => g.attributes?.isAirspaceHighlight)).toBeUndefined();
    expect(scene.closePopup).toHaveBeenCalledTimes(1);

    // Clicking with a track loaded passes effective track date to getAirspaceList.
    hoisted.state.currentTrack = { id: 'track-1' };
    hoisted.state.timeSec = 1_752_577_200;
    store.dispatch({ type: 'TEST_POPUP_DATE' });
    await element.updateComplete;

    await element.handleClick([{ lat: 46.5, lon: 7.5 }], scene);
    expect(hoisted.getAirspaceListMock).toHaveBeenCalledTimes(3);
    expect((hoisted.getAirspaceListMock.mock.calls[2][0].date as Date).getTime()).toBe(1_752_577_200 * 1000);
    expect(scene.openPopup).toHaveBeenCalledTimes(2);
  });

  it('deduplicates airspaces across multiple 3D hit points, unexaggerates altitudes, and uses 3px wall margin', async () => {
    const view = makeMockView(10, 6.2, 44.8, 6.4, 45.0);
    const ring = [
      [6.2, 44.8],
      [6.4, 44.8],
      [6.4, 45.0],
      [6.2, 45.0],
      [6.2, 44.8],
    ];
    hoisted.tilePayloads.set(1, [
      makeFeature(
        makeAirspaceProps({
          name: '',
          type: Type.LowAltitudeOverflightRestriction,
          icaoClass: Class.SUA,
          floorRefGnd: true,
          floorM: 0,
          floorLabel: '',
          topRefGnd: true,
          topM: 1000,
          topLabel: '',
        }),
        ring,
      ),
    ]);
    hoisted.tilePayloads.set(2, hoisted.tilePayloads.get(1)!);

    const scene = { openPopup: vi.fn(async () => undefined), closePopup: vi.fn(async () => undefined) } as any;
    element.map = mockMap;
    element.view = view;
    element.sampler = {
      noDataValue: -9999,
      spatialReference: { isWGS84: true, isWebMercator: false },
      elevationAt: () => 2600,
      on: vi.fn(() => ({ remove: vi.fn() })),
    } as any;
    hoisted.state.multiplier = 1.3;
    store.dispatch({ type: 'TEST_MULTIPLIER' });
    await element.updateComplete;
    await flushAsync();

    hoisted.getAirspaceListMock
      .mockResolvedValueOnce([
        {
          name: 'PARC/RESERVE ECRINS',
          type: Type.LowAltitudeOverflightRestriction,
          icaoClass: Class.SUA,
          floorM: 0,
          floorRefGnd: true,
          floorLabel: 'GND',
          topM: 1000,
          topRefGnd: true,
          topLabel: '3281ft GND',
        } as any,
      ])
      .mockResolvedValueOnce([
        {
          name: 'PARC/RESERVE ECRINS',
          type: Type.LowAltitudeOverflightRestriction,
          icaoClass: Class.SUA,
          floorM: 0,
          floorRefGnd: true,
          floorLabel: 'GND',
          topM: 1000,
          topRefGnd: true,
          topLabel: '3281ft GND',
        } as any,
        {
          name: 'LF-R196A1',
          type: Type.Restricted,
          icaoClass: Class.SUA,
          floorM: 1000,
          topM: 5000,
          floorLabel: '1000m',
          topLabel: '5000m',
        } as any,
      ]);

    await element.handleClick(
      [
        { lat: 44.85, lon: 6.25, z: 2600 },
        { lat: 44.9, lon: 6.3, z: 3900 },
      ],
      scene,
    );

    expect(hoisted.getAirspaceListMock).toHaveBeenCalledTimes(2);
    const firstQuery = hoisted.getAirspaceListMock.mock.calls[0][0] as any;
    expect(firstQuery.gndAltitude).toBeCloseTo(2000, 1);
    expect(firstQuery.altitude).toBeCloseTo(2000, 1);
    expect(firstQuery.checkTop).toBe(true);
    expect(firstQuery.altitudeMargin).toBe(150);
    expect(firstQuery.marginPx).toBe(3);

    expect(scene.openPopup).toHaveBeenCalledTimes(1);
    const popup = scene.openPopup.mock.calls[0][0];
    expect(popup.location.latitude).toBe(44.85);
    expect(popup.location.longitude).toBe(6.25);
    expect(popup.location.z).toBe(2600);
    const content = popup.content.shadowRoot?.innerHTML ?? popup.content.innerHTML;
    expect(content).toContain('PARC/RESERVE ECRINS');
    expect(content).toContain('LF-R196A1');
    // Deduplicated: PARC/RESERVE ECRINS appears once despite matching at both hit points
    expect(content.match(/PARC\/RESERVE ECRINS/g)).toHaveLength(1);

    hoisted.state.multiplier = 1;
    store.dispatch({ type: 'TEST_MULTIPLIER' });
    hoisted.getAirspaceListMock.mockResolvedValue([{ name: 'Airspace list', floorM: 0, topM: 1000 }] as any[]);
  });

  it('handles progressive worker responses from coarse (LOD 0) to fine (LOD 1) updating graphic geometry in place', async () => {
    element.map = mockMap;
    element.view = makeMockView(10, 6.0, 45.0, 6.2, 45.2);
    element.sampler = {
      noDataValue: -9999,
      spatialReference: { isWGS84: true, isWebMercator: false },
      elevationAt: () => 400,
      on: vi.fn(() => ({ remove: vi.fn() })),
    } as any;
    await element.updateComplete;

    const gndAirspace = {
      name: 'PROG TMA',
      country: 'FR',
      floorM: 300,
      floorLabel: '300m AGL',
      floorRefGnd: true,
      topM: 2000,
      topLabel: '2000m AGL',
      topRefGnd: true,
      type: Type.TMA,
      icaoClass: Class.D,
      activity: 0,
    };

    const poly = {
      rings: [
        [
          [6.0, 45.0],
          [6.2, 45.0],
          [6.2, 45.2],
          [6.0, 45.2],
          [6.0, 45.0],
        ],
      ],
      extent: { xmin: 6.0, ymin: 45.0, xmax: 6.2, ymax: 45.2 },
    };

    const coarseFp = await meshModule.buildAirspaceFootprint(poly, gndAirspace, { coarse: true });
    const fineFp = await meshModule.buildAirspaceFootprint(poly, gndAirspace, { coarse: false });

    const gen = ((element as any).buildGeneration = 100);

    const coarseResponse = {
      id: gen,
      lod: 0,
      isFinal: false,
      items: [
        {
          airspaceKey: 'PROG TMA',
          geomKey: '100',
          footprintKey: '110|100',
          cacheKey: 'PROG TMA|100|1',
          category: common.AirspaceColorCategory.Other,
          airspace: gndAirspace as any,
          polygon: poly,
          footprint: coarseFp!,
          lod: 0,
        },
      ],
    };

    // Apply LOD 0 response (First Paint)
    (element as any).applyWorkerResponse(coarseResponse);
    const layer = hoisted.graphicsLayers[hoisted.graphicsLayers.length - 1];
    expect(layer.graphics).toHaveLength(2);
    const graphicLOD0 = layer.graphics.find((g: any) => !g.attributes.isAirspaceLine);
    const initialVertexCount = graphicLOD0.geometry.vertexAttributes.position.length / 3;

    // Apply LOD 1 response (Fine Refinement)
    const fineResponse = {
      id: gen,
      lod: 1,
      isFinal: true,
      items: [
        {
          airspaceKey: 'PROG TMA',
          geomKey: '100',
          footprintKey: '110|100',
          cacheKey: 'PROG TMA|100|1',
          category: common.AirspaceColorCategory.Other,
          airspace: gndAirspace as any,
          polygon: poly,
          footprint: fineFp!,
          lod: 1,
        },
      ],
    };

    (element as any).applyWorkerResponse(fineResponse);
    // Graphic replaced in-place in graphics layer
    expect(layer.graphics).toHaveLength(2);
    const graphicLOD1 = layer.graphics.find((g: any) => !g.attributes.isAirspaceLine);
    const fineVertexCount = graphicLOD1.geometry.vertexAttributes.position.length / 3;

    expect(fineVertexCount).toBeGreaterThan(initialVertexCount);
  });
});

describe('FlatAirspace3dElement', () => {
  let element: FlatAirspace3dElement;
  let mockMap: ReturnType<typeof makeMockMap>;

  beforeEach(() => {
    hoisted.state.maxAltitude = 3000;
    hoisted.state.showAirspace = true;
    hoisted.state.showClasses = [Class.C, Class.D];
    hoisted.state.showTypes = [Type.CTR, Type.Restricted];
    hoisted.state.opacity = 70;
    hoisted.state.currentTrack = null;
    hoisted.state.timeSec = 1_752_577_200;
    hoisted.vectorTileLayers.length = 0;
    hoisted.getAirspaceListMock.mockClear();

    mockMap = makeMockMap();
    element = new FlatAirspace3dElement();
    document.body.appendChild(element);
  });

  afterEach(() => {
    element.remove();
  });

  it('creates VectorTileLayer only when enabled and showAirspace are true, and rebuilds on state changes', async () => {
    element.map = mockMap;
    element.enabled = false;
    await element.updateComplete;
    expect(hoisted.vectorTileLayers).toHaveLength(0);

    element.enabled = true;
    await element.updateComplete;
    expect(hoisted.vectorTileLayers).toHaveLength(1);
    expect(mockMap.layers).toHaveLength(1);
    expect(hoisted.vectorTileLayers[0].style.layers[0].paint['fill-opacity']).toBeCloseTo(0.7);

    // Opacity change rebuilds the VectorTileLayer with the updated fill-opacity.
    hoisted.state.opacity = 40;
    store.dispatch({ type: 'TEST_FLAT_OPACITY' });
    await element.updateComplete;
    expect(hoisted.vectorTileLayers).toHaveLength(2);
    expect(hoisted.vectorTileLayers[0].destroyed).toBe(true);
    expect(hoisted.vectorTileLayers[1].style.layers[0].paint['fill-opacity']).toBeCloseTo(0.4);

    // Filter change recreates the VectorTileLayer.
    hoisted.state.maxAltitude = 2000;
    store.dispatch({ type: 'TEST_FLAT_FILTER' });
    await element.updateComplete;
    expect(hoisted.vectorTileLayers).toHaveLength(3);
    expect(hoisted.vectorTileLayers[1].destroyed).toBe(true);

    // Track change recreates the VectorTileLayer with track-date overrides.
    hoisted.state.currentTrack = { id: 'track-1' };
    store.dispatch({ type: 'TEST_FLAT_TRACK' });
    await element.updateComplete;
    expect(hoisted.vectorTileLayers).toHaveLength(4);
    expect(hoisted.vectorTileLayers[2].destroyed).toBe(true);

    // Disabling removes and destroys the layer.
    element.enabled = false;
    await element.updateComplete;
    expect(hoisted.vectorTileLayers[3].destroyed).toBe(true);
    expect(mockMap.layers).toHaveLength(0);
  });

  it('opens popup with effective track date on click only when enabled, and current date when no track is loaded', async () => {
    const scene = { openPopup: vi.fn(async () => undefined), closePopup: vi.fn(async () => undefined) } as any;
    element.map = mockMap;
    element.enabled = false;
    await element.updateComplete;

    await element.handleClick({ lat: 45.5, lon: 6.1 }, scene);
    expect(hoisted.getAirspaceListMock).not.toHaveBeenCalled();

    element.enabled = true;
    await element.updateComplete;

    const before = Date.now();
    await element.handleClick({ lat: 45.5, lon: 6.1 }, scene);
    const after = Date.now();
    expect(hoisted.getAirspaceListMock).toHaveBeenCalledTimes(1);
    const wallClockDate = hoisted.getAirspaceListMock.mock.calls[0][0].date as Date;
    expect(wallClockDate.getTime()).toBeGreaterThanOrEqual(before);
    expect(wallClockDate.getTime()).toBeLessThanOrEqual(after);
    expect(scene.openPopup).toHaveBeenCalledTimes(1);

    hoisted.state.currentTrack = { id: 'track-1' };
    hoisted.state.timeSec = 1_752_577_200;
    store.dispatch({ type: 'TEST_FLAT_DATE' });
    await element.updateComplete;

    await element.handleClick({ lat: 45.5, lon: 6.1 }, scene);
    expect(hoisted.getAirspaceListMock).toHaveBeenCalledTimes(2);
    expect((hoisted.getAirspaceListMock.mock.calls[1][0].date as Date).getTime()).toBe(1_752_577_200 * 1000);
    expect(scene.openPopup).toHaveBeenCalledTimes(2);
  });
});
