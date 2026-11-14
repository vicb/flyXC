import Color from '@arcgis/core/Color';
import { watch } from '@arcgis/core/core/reactiveUtils.js';
import type Extent from '@arcgis/core/geometry/Extent';
import { containsExecute } from '@arcgis/core/geometry/operators/containsOperator';
import { unionExecuteMany } from '@arcgis/core/geometry/operators/unionOperator';
import Point from '@arcgis/core/geometry/Point';
import Polygon from '@arcgis/core/geometry/Polygon';
import * as webMercatorUtils from '@arcgis/core/geometry/support/webMercatorUtils';
import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import type ElevationSampler from '@arcgis/core/layers/support/ElevationSampler';
import type Map from '@arcgis/core/Map';
import SolidEdges3D from '@arcgis/core/symbols/edges/SolidEdges3D';
import FillSymbol3DLayer from '@arcgis/core/symbols/FillSymbol3DLayer';
import MeshSymbol3D from '@arcgis/core/symbols/MeshSymbol3D';
import type LayerView from '@arcgis/core/views/layers/LayerView';
import type SceneView from '@arcgis/core/views/SceneView';
import type { ArcgisScene } from '@arcgis/map-components/components/arcgis-scene';
import type { AirspaceString, AirspaceTyped, Class, LatLon, Type } from '@flyxc/common';
import {
  AIRSPACE_TILE_SIZE,
  AirspaceColorCategory,
  applyOverrides,
  ASP_COLOR_DANGER,
  ASP_COLOR_OTHER,
  ASP_COLOR_PROHIBITED,
  ASP_COLOR_RESTRICTED,
  getAirspaceColorCategory,
  getAirspaceTileUrl,
  getPixelCoordinates,
  isAirspaceVisible,
  MAX_AIRSPACE_TILE_ZOOM,
  toTypedAirspace,
} from '@flyxc/common';
import type { PropertyValues } from 'lit';
import { LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { VectorTile } from 'mapbox-vector-tile';
import { connect } from 'pwa-helpers';

import { getAirspaceHtmlDescription, getAirspaceList } from '../../logic/airspaces';
import * as airspaces from '../../redux/airspace-slice';
import * as app from '../../redux/app-slice';
import * as arcgis from '../../redux/arcgis-slice';
import type { RootState } from '../../redux/store';
import { store } from '../../redux/store';
import { selectCurrentTrack } from '../../redux/track-slice';
import {
  type AirspaceFootprint,
  type AirspaceMeshData,
  buildAirspaceFootprint,
  computeGroundSignature,
  extrudeAirspaceFootprint,
  type GroundSampler,
  mergeMeshData,
} from './airspace3d-mesh';
import { createPopupContent } from './popup-content';

function getEffectiveAirspaceDate(hasTrack: boolean, timeSec: number): Date {
  return hasTrack && Number.isFinite(timeSec) ? new Date(timeSec * 1000) : new Date();
}

async function openAirspacePopup(scene: ArcgisScene, latLon: LatLon, html: string, clickZ?: number): Promise<void> {
  await scene.openPopup({
    location: new Point({
      latitude: latLon.lat,
      longitude: latLon.lon,
      ...(clickZ != null ? { z: clickZ, hasZ: true } : {}),
    }),
    title: 'Airspaces',
    content: createPopupContent(html),
  });
}

export const MIN_3D_ZOOM = 10;
const MIN_3D_TILE_ZOOM = 8;
export const MAX_TILES_3D = 36;
const MAX_TILE_CACHE_SIZE = 300;
const MAX_FOOTPRINT_CACHE_SIZE = 600;
const MAX_MESH_CACHE_SIZE = 600;
const VIEW_REFRESH_DEBOUNCE_MS = 60;
const SAMPLER_REFRESH_DEBOUNCE_MS = 450;
const CLICK_Z_TOLERANCE_M = 75;

interface DecodedTileFeature {
  baseAirspace: AirspaceTyped;
  polygons: Array<{ id: string; polygon: Polygon }>;
}

interface CachedFootprintEntry {
  polygon: Polygon;
  footprint: AirspaceFootprint;
}

interface CachedAirspaceItem {
  airspaceKey: string;
  geomKey: string;
  footprintKey: string;
  cacheKey: string;
  category: AirspaceColorCategory;
  airspace: AirspaceTyped;
  polygon: Polygon;
  footprint?: AirspaceFootprint;
  meshData?: AirspaceMeshData;
  groundSignature?: number;
}

interface CachedMeshEntry {
  meshData: AirspaceMeshData;
  groundSignature?: number;
}

interface TileCoord {
  x: number;
  y: number;
  z: number;
}

interface GeoBounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

interface VisibleTileCoverage {
  tiles: TileCoord[];
  bounds: GeoBounds | null;
}

const CATEGORY_HEX: Record<AirspaceColorCategory, string> = {
  [AirspaceColorCategory.Prohibited]: ASP_COLOR_PROHIBITED,
  [AirspaceColorCategory.Restricted]: ASP_COLOR_RESTRICTED,
  [AirspaceColorCategory.Danger]: ASP_COLOR_DANGER,
  [AirspaceColorCategory.Other]: ASP_COLOR_OTHER,
};

const ALL_CATEGORIES = [
  AirspaceColorCategory.Prohibited,
  AirspaceColorCategory.Restricted,
  AirspaceColorCategory.Danger,
  AirspaceColorCategory.Other,
];

/**
 * Creates a fast synchronous ground elevation sampler returning exaggerated elevation in meters.
 */
export function createGroundSampler(sampler?: ElevationSampler): GroundSampler {
  if (!sampler) {
    return () => 0;
  }
  const noData = sampler.noDataValue;
  const sr = sampler.spatialReference;
  const isWGS84 = Boolean(sr?.isWGS84);
  const isWebMercator = Boolean(sr?.isWebMercator);

  return (lon: number, lat: number): number => {
    let z: number | null | undefined;
    if (isWGS84) {
      z = sampler.elevationAt(lon, lat);
    } else if (isWebMercator) {
      const [x, y] = webMercatorUtils.lngLatToXY(lon, lat);
      z = sampler.elevationAt(x, y);
    } else {
      z = sampler.queryElevation(new Point({ longitude: lon, latitude: lat }))?.z;
    }

    if (typeof z !== 'number' || !Number.isFinite(z) || z === noData || z > 20000) {
      return 0;
    }
    return z;
  };
}

function createCategorySymbol(category: AirspaceColorCategory, opacityPercent: number): MeshSymbol3D {
  const hex = CATEGORY_HEX[category];
  const fill = new Color(hex);
  fill.a = Math.min(0.45, Math.max(0.05, (opacityPercent / 100) * 0.45));
  const edge = new Color(hex);
  edge.a = Math.min(0.95, Math.max(0.3, opacityPercent / 100 + 0.25));

  return new MeshSymbol3D({
    symbolLayers: [
      new FillSymbol3DLayer({
        material: { color: fill.toRgba(), colorMixMode: 'replace' },
        edges: new SolidEdges3D({ color: edge.toRgba(), size: 1 }),
        castShadows: false,
      }),
    ],
  });
}

function getAirspaceKey(airspace: AirspaceTyped): string {
  return `${airspace.name}|${airspace.country}|${airspace.type}|${airspace.icaoClass}|${airspace.floorM}|${airspace.topM}|${airspace.floorRefGnd}|${airspace.topRefGnd}`;
}

function geoJsonGeometryToPolygons(geometry: { type: string; coordinates: any }): Polygon[] {
  const spatialReference = { wkid: 4326 };
  if (geometry.type === 'Polygon') {
    return [new Polygon({ rings: geometry.coordinates, spatialReference })];
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as number[][][][]).map((rings) => new Polygon({ rings, spatialReference }));
  }
  return [];
}

/**
 * Computes visible airspace tile coordinates and padded geographic bounds covering the 3D frustum,
 * stepping tile zoom down as needed so border tiles fit within {@link MAX_TILES_3D}.
 */
export function getVisibleTileCoverage(view: SceneView): VisibleTileCoverage {
  const zoom = view.zoom;
  const extent = view.extent;
  const center = view.center;
  if (!Number.isFinite(zoom) || zoom < MIN_3D_ZOOM || !extent || !center) {
    return { tiles: [], bounds: null };
  }

  let geoExtent: Extent | null = null;
  if (extent.spatialReference?.isWGS84) {
    geoExtent = extent;
  } else if (extent.spatialReference?.isWebMercator) {
    geoExtent = webMercatorUtils.webMercatorToGeographic(extent) as Extent;
  }
  if (!geoExtent) {
    return { tiles: [], bounds: null };
  }

  let minLon = geoExtent.xmin;
  let maxLon = geoExtent.xmax;
  let minLat = geoExtent.ymin;
  let maxLat = geoExtent.ymax;

  const centerLon = center.longitude ?? (minLon + maxLon) / 2;
  const centerLat = center.latitude ?? (minLat + maxLat) / 2;
  const maxHalfLon = Math.max(2.5, (maxLon - minLon) * 1.5);
  const maxHalfLat = Math.max(2.0, (maxLat - minLat) * 1.5);
  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  // Sample ground points across the viewport because tilted SceneView.extent under-covers side/bottom/far borders.
  if (typeof view.toMap === 'function' && view.width > 0 && view.height > 0) {
    for (const gy of [0.18, 0.45, 0.75, 1]) {
      for (const gx of [0, 0.5, 1]) {
        const pt = view.toMap({ x: view.width * gx, y: view.height * gy });
        const rawLon = pt?.longitude;
        const rawLat = pt?.latitude;
        if (
          typeof rawLon !== 'number' ||
          typeof rawLat !== 'number' ||
          !Number.isFinite(rawLon) ||
          !Number.isFinite(rawLat)
        ) {
          continue;
        }
        const lon = clamp(rawLon, centerLon - maxHalfLon, centerLon + maxHalfLon);
        const lat = clamp(rawLat, centerLat - maxHalfLat, centerLat + maxHalfLat);
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
  }

  // Pad slightly to reduce pop-in during short pans.
  const padLon = (maxLon - minLon) * 0.08;
  const padLat = (maxLat - minLat) * 0.08;
  const paddedMinLon = clamp(minLon - padLon, -179.99, 179.99);
  const paddedMaxLon = clamp(maxLon + padLon, -179.99, 179.99);
  const paddedMinLat = clamp(minLat - padLat, -85, 85);
  const paddedMaxLat = clamp(maxLat + padLat, -85, 85);

  const getTileRange = (z: number) => {
    const maxIndex = (1 << z) - 1;
    const nw = getPixelCoordinates({ lat: paddedMaxLat, lon: paddedMinLon }, z, AIRSPACE_TILE_SIZE).tile;
    const se = getPixelCoordinates({ lat: paddedMinLat, lon: paddedMaxLon }, z, AIRSPACE_TILE_SIZE).tile;
    const minX = clamp(Math.min(nw.x, se.x), 0, maxIndex);
    const maxX = clamp(Math.max(nw.x, se.x), 0, maxIndex);
    const minY = clamp(Math.min(nw.y, se.y), 0, maxIndex);
    const maxY = clamp(Math.max(nw.y, se.y), 0, maxIndex);
    return { minX, maxX, minY, maxY, count: (maxX - minX + 1) * (maxY - minY + 1) };
  };

  const maxTileZoom = clamp(Math.floor(zoom), 0, MAX_AIRSPACE_TILE_ZOOM);
  const minTileZoom = Math.min(MIN_3D_TILE_ZOOM, maxTileZoom);

  let chosenZoom = minTileZoom;
  let range = getTileRange(minTileZoom);
  for (let z = maxTileZoom; z >= minTileZoom; z--) {
    const candidate = getTileRange(z);
    chosenZoom = z;
    range = candidate;
    if (candidate.count <= MAX_TILES_3D) {
      break;
    }
  }

  const centerTile = getPixelCoordinates(
    { lat: clamp(centerLat, -85, 85), lon: clamp(centerLon, -179.99, 179.99) },
    chosenZoom,
    AIRSPACE_TILE_SIZE,
  ).tile;

  const coords: Array<TileCoord & { dist2: number }> = [];
  for (let x = range.minX; x <= range.maxX; x++) {
    for (let y = range.minY; y <= range.maxY; y++) {
      const dx = x - centerTile.x;
      const dy = y - centerTile.y;
      coords.push({ x, y, z: chosenZoom, dist2: dx * dx + dy * dy });
    }
  }

  coords.sort((a, b) => a.dist2 - b.dist2);
  return {
    tiles: coords.slice(0, MAX_TILES_3D).map(({ x, y, z }) => ({ x, y, z })),
    bounds: {
      minLon: paddedMinLon,
      minLat: paddedMinLat,
      maxLon: paddedMaxLon,
      maxLat: paddedMaxLat,
    },
  };
}

/**
 * Returns the visible airspace tile coordinates for the given SceneView.
 */
export function getVisibleTileCoords(view: SceneView): TileCoord[] {
  return getVisibleTileCoverage(view).tiles;
}

function polygonOverlapsBounds(polygon: Polygon, bounds: GeoBounds): boolean {
  const ext = polygon.extent;
  if (!ext) {
    return true;
  }
  return (
    ext.xmax >= bounds.minLon && ext.xmin <= bounds.maxLon && ext.ymax >= bounds.minLat && ext.ymin <= bounds.maxLat
  );
}

/**
 * Lit component managing 3D extruded airspace volumes in an ArcGIS SceneView when zoomed in >= {@link MIN_3D_ZOOM}.
 */
@customElement('airspace3d-element')
export class Airspace3dElement extends connect(store)(LitElement) {
  @property({ attribute: false })
  map!: Map;
  @property({ attribute: false })
  view?: SceneView;
  @property({ attribute: false })
  sampler?: ElevationSampler;

  @state()
  private maxAltitude = 1000;
  @state()
  private showAirspace = false;
  @state()
  private showClasses: Class[] = [];
  @state()
  private showTypes: Type[] = [];
  @state()
  private opacity = 70;
  @state()
  private multiplier = 1;
  @state()
  private hasTrack = false;
  @state()
  private overrideHourBucket = 0;

  private timeSec = 0;
  private graphicsLayer?: GraphicsLayer;
  private graphicsLayerView?: LayerView;
  private categoryGraphics = new globalThis.Map<AirspaceColorCategory, Graphic>();
  private tileCache = new globalThis.Map<string, Promise<DecodedTileFeature[] | null>>();
  private footprintCache = new globalThis.Map<string, CachedFootprintEntry>();
  private meshCache = new globalThis.Map<string, CachedMeshEntry>();
  private currentAirspaces: CachedAirspaceItem[] = [];
  private lastQueryKey?: string;
  private viewHandles: Array<{ remove: () => void }> = [];
  private samplerHandle?: { remove: () => void };
  private refreshTimer?: number;
  private samplerTimer?: number;
  private buildGeneration = 0;

  stateChanged(state: RootState): void {
    this.maxAltitude = airspaces.selectMaxAltitude(state);
    this.showAirspace = airspaces.selectShowAirspaces(state);
    this.showClasses = airspaces.selectShowClasses(state);
    this.showTypes = airspaces.selectShowTypes(state);
    this.opacity = airspaces.selectOpacity(state);
    this.multiplier = arcgis.selectAltitudeMultiplier(state);
    const track = selectCurrentTrack(state);
    this.hasTrack = track != null;
    this.timeSec = app.selectTimeSec(state);
    this.overrideHourBucket = track ? Math.floor(this.timeSec / 3600) : 0;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has('view')) {
      this.teardownViewWatchers();
      this.setupViewWatchers();
      this.graphicsLayerView = undefined;
    }

    if (changedProps.has('sampler')) {
      this.samplerHandle?.remove();
      this.samplerHandle = this.sampler?.on('changed', () => {
        if (!this.showAirspace || !this.currentAirspaces.some((a) => a.airspace.floorRefGnd || a.airspace.topRefGnd)) {
          return;
        }
        clearTimeout(this.samplerTimer);
        this.samplerTimer = window.setTimeout(() => {
          this.rebuildMeshes(true);
        }, SAMPLER_REFRESH_DEBOUNCE_MS);
      });
    }

    if (!this.map || !this.showAirspace) {
      this.clearLayer();
      return false;
    }

    const filterOrMapChanged =
      changedProps.has('map') ||
      changedProps.has('view') ||
      changedProps.has('showAirspace') ||
      changedProps.has('maxAltitude') ||
      changedProps.has('showClasses') ||
      changedProps.has('showTypes') ||
      changedProps.has('hasTrack') ||
      changedProps.has('overrideHourBucket');

    if (filterOrMapChanged) {
      this.lastQueryKey = undefined;
      this.scheduleRefresh(true);
    } else if (changedProps.has('multiplier') || changedProps.has('sampler')) {
      const multiplierChanged = changedProps.has('multiplier');
      if (multiplierChanged) {
        this.meshCache.clear();
        for (const item of this.currentAirspaces) {
          item.meshData = undefined;
          item.cacheKey = `${item.airspaceKey}|${item.geomKey}|${this.multiplier}`;
        }
      }
      if (this.currentAirspaces.length > 0) {
        this.rebuildMeshes(!multiplierChanged);
      } else {
        this.scheduleRefresh(true);
      }
    } else if (changedProps.has('opacity')) {
      this.updateGraphicOpacities();
    }

    return false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.teardownViewWatchers();
    this.samplerHandle?.remove();
    this.samplerHandle = undefined;
    clearTimeout(this.refreshTimer);
    clearTimeout(this.samplerTimer);
    this.clearLayer();
  }

  /**
   * Controls whether 3D airspace graphics participate in SceneView raycasts.
   * Keep disabled during camera navigation so dragging always anchors to terrain.
   */
  public setPickable(pickable: boolean): void {
    const uid = this.graphicsLayerView?.uid;
    const stageLayers = (this.view as any)?.stage?._layers as Record<string, any> | undefined;
    if (!uid || !stageLayers) {
      return;
    }
    for (const sl of Object.values(stageLayers)) {
      if (sl?.apiLayerViewUid === uid) {
        sl.pickable = pickable;
      }
    }
  }

  private findAirspacesAtPoint(latLon: LatLon, clickZ?: number): AirspaceTyped[] {
    if (this.currentAirspaces.length === 0) {
      return [];
    }
    const point = new Point({
      longitude: latLon.lon,
      latitude: latLon.lat,
      spatialReference: { wkid: 4326 },
    });
    const sampleGroundZ = createGroundSampler(this.sampler);
    const groundZ = sampleGroundZ(latLon.lon, latLon.lat);

    const matches: Array<{ airspace: AirspaceTyped; matchesZ: boolean; topZ: number }> = [];
    for (const item of this.currentAirspaces) {
      const ext = item.polygon.extent;
      if (ext && (latLon.lon < ext.xmin || latLon.lon > ext.xmax || latLon.lat < ext.ymin || latLon.lat > ext.ymax)) {
        continue;
      }
      if (!containsExecute(item.polygon, point)) {
        continue;
      }
      const floorZ = (item.airspace.floorRefGnd ? groundZ : 0) + item.airspace.floorM * this.multiplier;
      const topZ = Math.max(floorZ, (item.airspace.topRefGnd ? groundZ : 0) + item.airspace.topM * this.multiplier);
      const matchesZ = clickZ != null && clickZ >= floorZ - CLICK_Z_TOLERANCE_M && clickZ <= topZ + CLICK_Z_TOLERANCE_M;
      matches.push({ airspace: item.airspace, matchesZ, topZ });
    }

    matches.sort((a, b) => {
      if (a.matchesZ !== b.matchesZ) {
        return a.matchesZ ? -1 : 1;
      }
      return b.topZ - a.topZ;
    });

    return matches.map((m) => m.airspace);
  }

  /**
   * Handles a SceneView click when in 3D mode, prioritizing hit-tested 3D airspaces and
   * falling back to vector-tile querying if nothing hit a 3D volume.
   */
  public async handleClick(latLon: LatLon, scene: ArcgisScene, clickZ?: number): Promise<void> {
    if (!this.showAirspace) {
      return;
    }

    if (clickZ != null) {
      const localMatches = this.findAirspacesAtPoint(latLon, clickZ);
      if (localMatches.length > 0) {
        const html = localMatches.slice(0, 5).map(getAirspaceHtmlDescription).join('<br>');
        await openAirspacePopup(scene, latLon, html, clickZ);
        return;
      }
    }

    const html = await getAirspaceList(
      MAX_AIRSPACE_TILE_ZOOM,
      latLon,
      this.maxAltitude,
      0,
      this.showClasses,
      this.showTypes,
      getEffectiveAirspaceDate(this.hasTrack, this.timeSec),
    );
    if (html) {
      await openAirspacePopup(scene, latLon, html);
    }
  }

  private setupViewWatchers(): void {
    if (!this.view) {
      return;
    }
    this.viewHandles.push(
      watch(
        () => this.view?.stationary,
        (stationary) => {
          if (stationary && this.showAirspace) {
            this.scheduleRefresh(false);
          }
        },
      ),
      watch(
        () => {
          const z = this.view?.zoom;
          if (!Number.isFinite(z)) {
            return -2;
          }
          return (z ?? 0) < MIN_3D_ZOOM ? -1 : Math.floor(Math.min(z ?? 0, MAX_AIRSPACE_TILE_ZOOM));
        },
        (zoomBucket) => {
          if (this.showAirspace) {
            this.scheduleRefresh(zoomBucket < 0);
          }
        },
      ),
    );
  }

  private teardownViewWatchers(): void {
    for (const h of this.viewHandles) {
      h.remove();
    }
    this.viewHandles.length = 0;
  }

  private scheduleRefresh(immediate: boolean): void {
    clearTimeout(this.refreshTimer);
    if (immediate) {
      void this.refreshView();
    } else {
      this.refreshTimer = window.setTimeout(() => {
        void this.refreshView();
      }, VIEW_REFRESH_DEBOUNCE_MS);
    }
  }

  private ensureGraphicsLayer(): GraphicsLayer {
    if (!this.graphicsLayer) {
      const layer = new GraphicsLayer({
        elevationInfo: { mode: 'absolute-height' },
      });
      this.graphicsLayer = layer;
      this.map.add(layer);
      void this.view?.whenLayerView?.(layer)?.then((layerView) => {
        if (this.graphicsLayer === layer) {
          this.graphicsLayerView = layerView;
          this.setPickable(false);
        }
      });
    }
    return this.graphicsLayer;
  }

  private removeGraphicsLayer(): void {
    this.currentAirspaces.length = 0;
    this.categoryGraphics.clear();
    this.graphicsLayerView = undefined;
    this.lastQueryKey = undefined;
    if (this.graphicsLayer) {
      this.map?.remove(this.graphicsLayer);
      this.graphicsLayer.destroy();
      this.graphicsLayer = undefined;
    }
  }

  private clearLayer(): void {
    this.buildGeneration++;
    this.removeGraphicsLayer();
  }

  private fetchDecodedTile(x: number, y: number, z: number): Promise<DecodedTileFeature[] | null> {
    const url = getAirspaceTileUrl(x, y, z, import.meta.env.VITE_AIRSPACE_SERVER);
    const cached = this.tileCache.get(url);
    if (cached) {
      return cached;
    }

    const tilePrefix = `${z}/${x}/${y}`;
    const promise = (async (): Promise<DecodedTileFeature[] | null> => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          return null;
        }
        const buffer = await response.arrayBuffer();
        const layer = new VectorTile(new Uint8Array(buffer)).layers.asp;
        if (!layer) {
          return null;
        }
        const features: DecodedTileFeature[] = [];
        for (let i = 0; i < layer.length; i++) {
          const feature = layer.feature(i);
          if (feature.type !== 3) {
            continue;
          }
          const geo = feature.toGeoJSON(x, y, z) as { geometry: { type: string; coordinates: any } };
          const polygons = geoJsonGeometryToPolygons(geo.geometry);
          if (polygons.length > 0) {
            features.push({
              baseAirspace: toTypedAirspace(feature.properties as AirspaceString),
              polygons: polygons.map((polygon, pIdx) => ({ id: `${tilePrefix}#${i}.${pIdx}`, polygon })),
            });
          }
        }
        return features;
      } catch {
        // Evict failed promise so transient network errors can be retried later.
        this.tileCache.delete(url);
        return null;
      }
    })();

    this.setBoundedCache(this.tileCache, MAX_TILE_CACHE_SIZE, url, promise);
    return promise;
  }

  private setBoundedCache<K, V>(cache: globalThis.Map<K, V>, maxSize: number, key: K, value: V): void {
    if (cache.has(key)) {
      cache.delete(key);
    } else if (cache.size >= maxSize) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }
    cache.set(key, value);
  }

  private async refreshView(): Promise<void> {
    if (!this.map || !this.showAirspace) {
      this.clearLayer();
      return;
    }

    const zoom = this.view?.zoom;
    if (!this.view || !Number.isFinite(zoom) || (zoom ?? 0) < MIN_3D_ZOOM) {
      this.clearLayer();
      return;
    }

    const { tiles, bounds } = getVisibleTileCoverage(this.view);
    if (tiles.length === 0 || !bounds) {
      return;
    }

    const date = getEffectiveAirspaceDate(this.hasTrack, this.timeSec);
    const tilesKey = tiles.map((t) => `${t.z}/${t.x}/${t.y}`).join(',');
    const boundsKey = [
      Math.round(bounds.minLon * 5),
      Math.round(bounds.minLat * 5),
      Math.round(bounds.maxLon * 5),
      Math.round(bounds.maxLat * 5),
    ].join(',');
    const hourBucket = this.hasTrack ? this.overrideHourBucket : Math.floor(date.getTime() / 3_600_000);
    const queryKey = `${tilesKey}|${boundsKey}|${this.maxAltitude}|${this.showClasses.join(',')}|${this.showTypes.join(',')}|${hourBucket}`;
    if (queryKey === this.lastQueryKey && this.graphicsLayer) {
      return;
    }

    const generation = ++this.buildGeneration;
    const decodedTiles = await Promise.all(tiles.map((t) => this.fetchDecodedTile(t.x, t.y, t.z)));
    if (generation !== this.buildGeneration || !this.showAirspace) {
      return;
    }

    const grouped = new globalThis.Map<string, { airspace: AirspaceTyped; polygons: Polygon[]; geomIds: string[] }>();
    for (const features of decodedTiles) {
      if (!features) {
        continue;
      }
      for (const feature of features) {
        const visiblePolygons = feature.polygons.filter((p) => polygonOverlapsBounds(p.polygon, bounds));
        if (visiblePolygons.length === 0) {
          continue;
        }
        const airspace = applyOverrides(feature.baseAirspace, date);
        if (
          airspace.floorM > this.maxAltitude ||
          !isAirspaceVisible(airspace.icaoClass, this.showClasses, airspace.type, this.showTypes) ||
          (!airspace.floorRefGnd && !airspace.topRefGnd && airspace.topM <= airspace.floorM)
        ) {
          continue;
        }

        const key = getAirspaceKey(airspace);
        let entry = grouped.get(key);
        if (!entry) {
          entry = { airspace, polygons: [], geomIds: [] };
          grouped.set(key, entry);
        }
        for (const p of visiblePolygons) {
          entry.polygons.push(p.polygon);
          entry.geomIds.push(p.id);
        }
      }
    }

    const prevByKey = new globalThis.Map(this.currentAirspaces.map((item) => [item.cacheKey, item]));
    const mergedAirspaces: CachedAirspaceItem[] = [];
    for (const [airspaceKey, { airspace, polygons, geomIds }] of grouped.entries()) {
      const geomKey = geomIds.join(',');
      const sinkZeroFloor = airspace.floorRefGnd && airspace.floorM === 0;
      const footprintKey = `${airspace.floorRefGnd ? 1 : 0}${airspace.topRefGnd ? 1 : 0}${sinkZeroFloor ? 1 : 0}|${geomKey}`;
      const cachedFp = this.footprintCache.get(footprintKey);

      const polygon = cachedFp?.polygon ?? (polygons.length === 1 ? polygons[0] : unionExecuteMany(polygons));
      if (polygon && polygon.type === 'polygon' && polygon.rings.length > 0) {
        const cacheKey = `${airspaceKey}|${geomKey}|${this.multiplier}`;
        const cachedMesh = prevByKey.get(cacheKey) ?? this.meshCache.get(cacheKey);
        mergedAirspaces.push({
          airspaceKey,
          geomKey,
          footprintKey,
          cacheKey,
          category: getAirspaceColorCategory(airspace),
          airspace,
          polygon,
          footprint: cachedFp?.footprint,
          meshData: cachedMesh?.meshData,
          groundSignature: cachedMesh?.groundSignature,
        });
      }
    }

    const missingFootprints = mergedAirspaces.filter((item) => !item.footprint);
    if (missingFootprints.length > 0) {
      const builtFootprints = await Promise.all(
        missingFootprints.map(async (item) => ({
          item,
          footprint: await buildAirspaceFootprint(item.polygon, item.airspace),
        })),
      );
      if (generation !== this.buildGeneration || !this.showAirspace) {
        return;
      }
      for (const { item, footprint } of builtFootprints) {
        if (footprint) {
          item.footprint = footprint;
          this.setBoundedCache(this.footprintCache, MAX_FOOTPRINT_CACHE_SIZE, item.footprintKey, {
            polygon: item.polygon,
            footprint,
          });
        }
      }
    }

    this.lastQueryKey = queryKey;
    this.currentAirspaces = mergedAirspaces;
    this.rebuildMeshes(false);
  }

  private rebuildMeshes(onlyGroundRef: boolean): void {
    if (!this.map || !this.showAirspace) {
      return;
    }

    const layer = this.ensureGraphicsLayer();
    const items = this.currentAirspaces;
    const sampleGroundZ = createGroundSampler(this.sampler);
    const dirtyCategories = new Set<AirspaceColorCategory>();
    let extrudedCount = 0;

    for (const item of items) {
      if (!item.footprint) {
        continue;
      }
      const isGroundRef = item.airspace.floorRefGnd || item.airspace.topRefGnd;
      if (onlyGroundRef && !isGroundRef && item.meshData != null) {
        continue;
      }

      const sig = isGroundRef ? computeGroundSignature(item.polygon, sampleGroundZ) : undefined;
      if (item.meshData != null && (!isGroundRef || item.groundSignature === sig)) {
        continue;
      }

      const meshData = extrudeAirspaceFootprint(item.footprint, item.airspace, this.multiplier, sampleGroundZ);
      dirtyCategories.add(item.category);
      extrudedCount++;
      if (meshData) {
        item.meshData = meshData;
        item.groundSignature = sig;
        this.setBoundedCache(this.meshCache, MAX_MESH_CACHE_SIZE, item.cacheKey, { meshData, groundSignature: sig });
      } else {
        item.meshData = undefined;
      }
    }

    if (onlyGroundRef && extrudedCount === 0) {
      return;
    }

    const byCategory = new globalThis.Map<AirspaceColorCategory, { parts: AirspaceMeshData[]; sigParts: string[] }>();
    for (const item of items) {
      if (!item.meshData) {
        continue;
      }
      let bucket = byCategory.get(item.category);
      if (!bucket) {
        bucket = { parts: [], sigParts: [] };
        byCategory.set(item.category, bucket);
      }
      bucket.parts.push(item.meshData);
      bucket.sigParts.push(`${item.cacheKey}:${item.groundSignature ?? ''}`);
    }

    const categoriesToUpdate = onlyGroundRef ? dirtyCategories : ALL_CATEGORIES;
    const toRemove: Graphic[] = [];
    const toAdd: Graphic[] = [];

    for (const category of categoriesToUpdate) {
      const bucket = byCategory.get(category);
      const nextSig = bucket ? bucket.sigParts.join(';') : '';
      const prevGraphic = this.categoryGraphics.get(category);
      if ((nextSig === '' && !prevGraphic) || (nextSig !== '' && prevGraphic?.attributes?.sig === nextSig)) {
        continue;
      }

      if (prevGraphic) {
        toRemove.push(prevGraphic);
        this.categoryGraphics.delete(category);
      }

      const mergedMesh = bucket ? mergeMeshData(bucket.parts) : null;
      if (mergedMesh) {
        const graphic = new Graphic({
          geometry: mergedMesh,
          symbol: createCategorySymbol(category, this.opacity),
          attributes: { isAirspace: true, category, sig: nextSig },
        });
        this.categoryGraphics.set(category, graphic);
        toAdd.push(graphic);
      }
    }

    if (toRemove.length > 0) {
      layer.removeMany(toRemove);
    }
    if (toAdd.length > 0) {
      layer.addMany(toAdd);
    }
    if (toRemove.length > 0 || toAdd.length > 0) {
      this.setPickable(false);
    }
  }

  private updateGraphicOpacities(): void {
    for (const [category, graphic] of this.categoryGraphics.entries()) {
      graphic.symbol = createCategorySymbol(category, this.opacity);
    }
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}
