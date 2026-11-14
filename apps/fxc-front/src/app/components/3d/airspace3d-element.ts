import Color from '@arcgis/core/Color';
import { watch } from '@arcgis/core/core/reactiveUtils.js';
import type Extent from '@arcgis/core/geometry/Extent';
import Point from '@arcgis/core/geometry/Point';
import * as webMercatorUtils from '@arcgis/core/geometry/support/webMercatorUtils';
import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import type ElevationSampler from '@arcgis/core/layers/support/ElevationSampler';
import type Map from '@arcgis/core/Map';
import FillSymbol3DLayer from '@arcgis/core/symbols/FillSymbol3DLayer';
import MeshSymbol3D from '@arcgis/core/symbols/MeshSymbol3D';
import type LayerView from '@arcgis/core/views/layers/LayerView';
import type SceneView from '@arcgis/core/views/SceneView';
import type { ArcgisScene } from '@arcgis/map-components/components/arcgis-scene';
import type { AirspaceTyped, Class, LatLon, Type } from '@flyxc/common';
import {
  AIRSPACE_3D_TILE_ZOOM,
  AIRSPACE_TILE_SIZE,
  AirspaceColorCategory,
  ASP_CATEGORY_COLOR,
  getPixelCoordinates,
  MAX_AIRSPACE_TILE_ZOOM,
  pointInPolygonRings,
} from '@flyxc/common';
import type { PropertyValues } from 'lit';
import { LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';

import { getAirspaceHtmlDescription, getAirspaceList } from '../../logic/airspaces';
import * as airspaces from '../../redux/airspace-slice';
import * as app from '../../redux/app-slice';
import * as arcgis from '../../redux/arcgis-slice';
import type { RootState } from '../../redux/store';
import { store } from '../../redux/store';
import { selectCurrentTrack } from '../../redux/track-slice';
import Airspace3dWorker from '../../workers/airspace3d?worker';
import {
  Airspace3dProcessor,
  type AirspaceWorkerItem,
  type AirspaceWorkerRequest,
  type AirspaceWorkerResponse,
  type GeoBounds,
  setBoundedCache,
  type TileCoord,
} from '../../workers/airspace3d-processor';
import {
  type AirspaceMeshData,
  computeGroundSignature,
  extrudeAirspaceFootprint,
  type GroundSampler,
  mergeMeshData,
} from './airspace3d-mesh';
import { createPopupContent } from './popup-content';

export function getEffectiveAirspaceDate(hasTrack: boolean, timeSec: number): Date {
  return hasTrack && Number.isFinite(timeSec) ? new Date(timeSec * 1000) : new Date();
}

export async function openAirspacePopup(
  scene: ArcgisScene,
  latLon: LatLon,
  html: string,
  clickZ?: number,
): Promise<void> {
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
export const MAX_TILES_3D = 36;
const MAX_MESH_CACHE_SIZE = 600;
const VIEW_REFRESH_DEBOUNCE_MS = 60;
const SAMPLER_REFRESH_DEBOUNCE_MS = 450;
const CLICK_Z_TOLERANCE_M = 75;

interface CachedMeshEntry {
  meshData: AirspaceMeshData;
  groundSignature?: number;
  meshLod?: number;
}

type CachedAirspaceItem = AirspaceWorkerItem & Partial<CachedMeshEntry>;

interface VisibleTileCoverage {
  tiles: TileCoord[];
  bounds: GeoBounds | null;
}

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
  let queryPoint: Point | undefined;
  const scratchXY: [number, number] = [0, 0];

  return (lon: number, lat: number): number => {
    let z: number | null | undefined;
    if (isWGS84) {
      z = sampler.elevationAt(lon, lat);
    } else if (isWebMercator) {
      (webMercatorUtils.lngLatToXY as (lon: number, lat: number, dest?: [number, number]) => [number, number])(
        lon,
        lat,
        scratchXY,
      );
      z = sampler.elevationAt(scratchXY[0], scratchXY[1]);
    } else {
      queryPoint ??= new Point({ longitude: lon, latitude: lat });
      queryPoint.longitude = lon;
      queryPoint.latitude = lat;
      z = sampler.queryElevation(queryPoint)?.z;
    }

    if (typeof z !== 'number' || !Number.isFinite(z) || z === noData || z > 20000) {
      return 0;
    }
    return z;
  };
}

function createCategorySymbol(category: AirspaceColorCategory, opacityPercent: number): MeshSymbol3D {
  const hex = ASP_CATEGORY_COLOR[category];
  const fill = new Color(hex);
  fill.a = Math.min(0.45, Math.max(0.05, (opacityPercent / 100) * 0.45));

  return new MeshSymbol3D({
    symbolLayers: [
      new FillSymbol3DLayer({
        material: { color: fill.toRgba(), colorMixMode: 'replace' },
        castShadows: false,
      }),
    ],
  });
}

function toGeoExtent(extent?: Extent | null): Extent | undefined {
  if (!extent) {
    return undefined;
  }
  if (extent.spatialReference?.isWGS84) {
    return extent;
  }
  if (extent.spatialReference?.isWebMercator) {
    return (webMercatorUtils.webMercatorToGeographic(extent) as Extent) ?? undefined;
  }
  return undefined;
}

/**
 * Computes visible airspace tile coordinates and padded geographic bounds covering the 3D frustum,
 * stepping tile zoom down as needed so border tiles fit within {@link MAX_TILES_3D}.
 */
export function getVisibleTileCoverage(view: SceneView): VisibleTileCoverage {
  const zoom = view.zoom;
  const center = view.center;
  const geoExtent = toGeoExtent(view.extent) ?? toGeoExtent(view.visibleArea?.extent);
  if (!Number.isFinite(zoom) || zoom < MIN_3D_ZOOM || !center || !geoExtent) {
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

  // Expand extent with SceneView.visibleArea so tilted frustum side/bottom/far borders are covered.
  const visibleGeoExtent = toGeoExtent(view.visibleArea?.extent);
  if (visibleGeoExtent) {
    minLon = Math.min(minLon, clamp(visibleGeoExtent.xmin, centerLon - maxHalfLon, centerLon + maxHalfLon));
    maxLon = Math.max(maxLon, clamp(visibleGeoExtent.xmax, centerLon - maxHalfLon, centerLon + maxHalfLon));
    minLat = Math.min(minLat, clamp(visibleGeoExtent.ymin, centerLat - maxHalfLat, centerLat + maxHalfLat));
    maxLat = Math.max(maxLat, clamp(visibleGeoExtent.ymax, centerLat - maxHalfLat, centerLat + maxHalfLat));
  }

  // Pad slightly to reduce pop-in during short pans.
  const padLon = (maxLon - minLon) * 0.08;
  const padLat = (maxLat - minLat) * 0.08;
  const paddedMinLon = clamp(minLon - padLon, -179.99, 179.99);
  const paddedMaxLon = clamp(maxLon + padLon, -179.99, 179.99);
  const paddedMinLat = clamp(minLat - padLat, -85, 85);
  const paddedMaxLat = clamp(maxLat + padLat, -85, 85);

  const maxIndex = (1 << AIRSPACE_3D_TILE_ZOOM) - 1;
  const nw = getPixelCoordinates(
    { lat: paddedMaxLat, lon: paddedMinLon },
    AIRSPACE_3D_TILE_ZOOM,
    AIRSPACE_TILE_SIZE,
  ).tile;
  const se = getPixelCoordinates(
    { lat: paddedMinLat, lon: paddedMaxLon },
    AIRSPACE_3D_TILE_ZOOM,
    AIRSPACE_TILE_SIZE,
  ).tile;
  const minX = clamp(Math.min(nw.x, se.x), 0, maxIndex);
  const maxX = clamp(Math.max(nw.x, se.x), 0, maxIndex);
  const minY = clamp(Math.min(nw.y, se.y), 0, maxIndex);
  const maxY = clamp(Math.max(nw.y, se.y), 0, maxIndex);

  const centerTile = getPixelCoordinates(
    { lat: clamp(centerLat, -85, 85), lon: clamp(centerLon, -179.99, 179.99) },
    AIRSPACE_3D_TILE_ZOOM,
    AIRSPACE_TILE_SIZE,
  ).tile;

  const coords: Array<TileCoord & { dist2: number }> = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      const dx = x - centerTile.x;
      const dy = y - centerTile.y;
      coords.push({ x, y, z: AIRSPACE_3D_TILE_ZOOM, dist2: dx * dx + dy * dy });
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
  private categorySymbols = new globalThis.Map<AirspaceColorCategory, MeshSymbol3D>();
  private categoryBuckets = new globalThis.Map<AirspaceColorCategory, { parts: AirspaceMeshData[]; sigHash: number }>([
    [AirspaceColorCategory.Prohibited, { parts: [], sigHash: 0 }],
    [AirspaceColorCategory.Restricted, { parts: [], sigHash: 0 }],
    [AirspaceColorCategory.Danger, { parts: [], sigHash: 0 }],
    [AirspaceColorCategory.Other, { parts: [], sigHash: 0 }],
  ]);
  private meshCache = new globalThis.Map<string, CachedMeshEntry>();
  private currentAirspaces: CachedAirspaceItem[] = [];
  private lastQueryKey?: string;
  private viewHandles: Array<{ remove: () => void }> = [];
  private samplerHandle?: { remove: () => void };
  private refreshTimer?: number;
  private samplerTimer?: number;
  private buildGeneration = 0;
  private patchedDepthCache?: { cache: any; orig: (...args: unknown[]) => unknown };
  private worker?: Worker;
  private fallbackProcessor?: Airspace3dProcessor;
  private pendingWorkerResolvers = new globalThis.Map<number, (res: AirspaceWorkerResponse) => void>();

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
      this.restoreDepthCache();
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
    this.worker?.terminate();
    this.worker = undefined;
    this.fallbackProcessor?.clear();
    this.fallbackProcessor = undefined;
    this.pendingWorkerResolvers.clear();
  }

  /**
   * Controls whether 3D airspace graphics participate in SceneView raycasts and depth clamping.
   * Keep disabled during camera navigation so dragging always anchors to terrain.
   */
  public setPickable(pickable: boolean): void {
    const uid = this.graphicsLayerView?.uid;
    const stage = (this.view as any)?.stage;
    const stageLayers = stage?._layers as Record<string, any> | undefined;
    if (!uid || !stageLayers) {
      return;
    }
    for (const sl of Object.values(stageLayers)) {
      if (sl?.apiLayerViewUid === uid) {
        sl.pickable = pickable;
      }
    }
    const depthCache = stage?.renderer?.navigationDepthCache;
    if (!pickable && depthCache && this.patchedDepthCache?.cache !== depthCache) {
      this.restoreDepthCache();
      this.patchedDepthCache = { cache: depthCache, orig: depthCache.getMinimalDepthForArea };
      depthCache.getMinimalDepthForArea = () => null;
    }
  }

  private restoreDepthCache(): void {
    if (this.patchedDepthCache) {
      this.patchedDepthCache.cache.getMinimalDepthForArea = this.patchedDepthCache.orig;
      this.patchedDepthCache = undefined;
    }
  }

  private findAirspacesAtPoint(latLon: LatLon, clickZ?: number): AirspaceTyped[] {
    if (this.currentAirspaces.length === 0) {
      return [];
    }
    const sampleGroundZ = createGroundSampler(this.sampler);
    const groundZ = sampleGroundZ(latLon.lon, latLon.lat);

    const matches: Array<{ airspace: AirspaceTyped; matchesZ: boolean; topZ: number }> = [];
    for (const item of this.currentAirspaces) {
      const ext = item.polygon.extent;
      if (ext && (latLon.lon < ext.xmin || latLon.lon > ext.xmax || latLon.lat < ext.ymin || latLon.lat > ext.ymax)) {
        continue;
      }
      if (!pointInPolygonRings(latLon.lon, latLon.lat, item.polygon.rings)) {
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
    this.restoreDepthCache();
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
    this.pendingWorkerResolvers.clear();
    this.removeGraphicsLayer();
  }

  private getWorker(): Worker | undefined {
    if (typeof Worker !== 'undefined') {
      if (!this.worker) {
        this.worker = new Airspace3dWorker();
        this.worker.onmessage = (event: MessageEvent<AirspaceWorkerResponse>) => {
          const res = event.data;
          this.applyWorkerResponse(res);
          const resolver = this.pendingWorkerResolvers.get(res.id);
          if (resolver && (res.isFinal ?? true)) {
            this.pendingWorkerResolvers.delete(res.id);
            resolver(res);
          }
        };
        this.worker.onerror = (err) => {
          console.error('Airspace3d Worker error:', err);
        };
      }
      return this.worker;
    }
    return undefined;
  }

  private applyWorkerResponse(response: AirspaceWorkerResponse): void {
    if (response.id !== this.buildGeneration || !this.showAirspace) {
      return;
    }

    const currentAirspaces = response.items as CachedAirspaceItem[];
    for (const item of currentAirspaces) {
      const cached = this.meshCache.get(item.cacheKey);
      const targetLod = item.footprint?.lod ?? item.lod ?? 1;
      const lodMatches = cached?.meshLod === targetLod;
      if (lodMatches && cached) {
        item.meshData = cached.meshData;
        item.groundSignature = cached.groundSignature;
        item.meshLod = cached.meshLod;
      } else {
        item.meshData = undefined;
        item.groundSignature = undefined;
        item.meshLod = undefined;
      }
    }
    this.currentAirspaces = currentAirspaces;

    const isRefinementPass = response.lod !== undefined && response.lod > 0;
    this.rebuildMeshes(isRefinementPass);
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
    const request: AirspaceWorkerRequest = {
      id: generation,
      tiles,
      bounds,
      maxAltitude: this.maxAltitude,
      showClasses: this.showClasses,
      showTypes: this.showTypes,
      dateMs: date.getTime(),
      tileServer: import.meta.env.VITE_AIRSPACE_SERVER,
      multiplier: this.multiplier,
    };

    this.lastQueryKey = queryKey;
    const worker = this.getWorker();
    if (worker) {
      await new Promise<AirspaceWorkerResponse>((resolve) => {
        this.pendingWorkerResolvers.set(generation, resolve);
        worker.postMessage(request);
      });
    } else {
      this.fallbackProcessor ??= new Airspace3dProcessor();
      const response = await this.fallbackProcessor.process(request);
      this.applyWorkerResponse(response);
    }
  }

  private getCategorySymbol(category: AirspaceColorCategory): MeshSymbol3D {
    let symbol = this.categorySymbols.get(category);
    if (!symbol) {
      symbol = createCategorySymbol(category, this.opacity);
      this.categorySymbols.set(category, symbol);
    }
    return symbol;
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
      const targetLod = item.footprint.lod ?? item.lod ?? 1;
      if (item.meshData != null && item.meshLod === targetLod && (!isGroundRef || item.groundSignature === sig)) {
        continue;
      }

      const meshData = extrudeAirspaceFootprint(item.footprint, item.airspace, this.multiplier, sampleGroundZ);
      dirtyCategories.add(item.category);
      extrudedCount++;
      if (meshData) {
        item.meshData = meshData;
        item.groundSignature = sig;
        item.meshLod = targetLod;
        setBoundedCache(this.meshCache, MAX_MESH_CACHE_SIZE, item.cacheKey, {
          meshData,
          groundSignature: sig,
          meshLod: targetLod,
        });
      } else {
        item.meshData = undefined;
        item.meshLod = undefined;
      }
    }

    if (onlyGroundRef && extrudedCount === 0) {
      return;
    }

    for (const bucket of this.categoryBuckets.values()) {
      bucket.parts.length = 0;
      bucket.sigHash = 0x811c9dc5;
    }
    for (const item of items) {
      if (!item.meshData) {
        continue;
      }
      const bucket = this.categoryBuckets.get(item.category);
      if (bucket) {
        bucket.parts.push(item.meshData);
        let h = bucket.sigHash;
        const key = item.cacheKey;
        for (let i = 0; i < key.length; i++) {
          h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
        }
        h = Math.imul(h ^ (item.groundSignature ?? 0), 0x01000193);
        h = Math.imul(h ^ (item.meshLod ?? 0), 0x01000193);
        bucket.sigHash = h;
      }
    }

    const categoriesToUpdate = onlyGroundRef ? dirtyCategories : ALL_CATEGORIES;
    const toRemove: Graphic[] = [];
    const toAdd: Graphic[] = [];

    for (const category of categoriesToUpdate) {
      const bucket = this.categoryBuckets.get(category);
      const nextSig = bucket && bucket.parts.length > 0 ? bucket.sigHash >>> 0 : 0;
      const prevGraphic = this.categoryGraphics.get(category);
      if ((nextSig === 0 && !prevGraphic) || (nextSig !== 0 && prevGraphic?.attributes?.sig === nextSig)) {
        continue;
      }

      const mergedMesh = bucket && bucket.parts.length > 0 ? mergeMeshData(bucket.parts) : null;
      if (prevGraphic && mergedMesh) {
        prevGraphic.geometry = mergedMesh;
        prevGraphic.attributes.sig = nextSig;
      } else if (prevGraphic && !mergedMesh) {
        toRemove.push(prevGraphic);
        this.categoryGraphics.delete(category);
      } else if (!prevGraphic && mergedMesh) {
        const graphic = new Graphic({
          geometry: mergedMesh,
          symbol: this.getCategorySymbol(category),
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
    this.categorySymbols.clear();
    for (const [category, graphic] of this.categoryGraphics.entries()) {
      graphic.symbol = this.getCategorySymbol(category);
    }
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}
