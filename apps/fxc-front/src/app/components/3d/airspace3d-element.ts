import { watch } from '@arcgis/core/core/reactiveUtils.js';
import Polyline from '@arcgis/core/geometry/Polyline';
import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import type ElevationSampler from '@arcgis/core/layers/support/ElevationSampler';
import type Map from '@arcgis/core/Map';
import type LineSymbol3D from '@arcgis/core/symbols/LineSymbol3D';
import type MeshSymbol3D from '@arcgis/core/symbols/MeshSymbol3D';
import type LayerView from '@arcgis/core/views/layers/LayerView';
import type SceneView from '@arcgis/core/views/SceneView';
import type { ArcgisScene } from '@arcgis/map-components/components/arcgis-scene';
import {
  AirspaceColorCategory,
  type AirspaceTyped,
  boundsDistanceSquaredKm,
  type Class,
  DEG_TO_RAD,
  FNV1A_OFFSET_BASIS,
  fnv1aMix,
  getEffectiveAirspaceDate,
  MAX_AIRSPACE_TILE_ZOOM,
  type Type,
} from '@flyxc/common';
import type { PropertyValues } from 'lit';
import { LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connect } from 'pwa-helpers';

import {
  createGroundSampler,
  getVisibleTileCoverage,
  MAX_TILES_3D,
  MIN_3D_ZOOM,
} from '../../logic/airspace3d-coverage';
import {
  type CachedAirspaceItem,
  createAirspaceFillSymbol,
  createAirspaceLineSymbol,
  destroyGraphics,
  findMatching3dItem,
  openAirspacePopup,
  syncCategoryGraphic,
} from '../../logic/airspace3d-graphics';
import {
  type AirspaceMeshData,
  computeGroundSignature,
  createMesh,
  extrudeAirspaceFootprint,
  mergeContourPaths,
  mergeMeshData,
} from '../../logic/airspace3d-mesh';
import { AirspaceMeshCache } from '../../logic/airspace3d-mesh-cache';
import { getAirspaceList, getAirspaceListHtml } from '../../logic/airspaces';
import * as airspaces from '../../redux/airspace-slice';
import * as app from '../../redux/app-slice';
import * as arcgis from '../../redux/arcgis-slice';
import type { RootState } from '../../redux/store';
import { store } from '../../redux/store';
import { selectCurrentTrack } from '../../redux/track-slice';
import Airspace3dWorker from '../../workers/airspace3d?worker';
import {
  Airspace3dProcessor,
  type AirspaceWorkerRequest,
  type AirspaceWorkerResponse,
} from '../../workers/airspace3d-processor';

export { createGroundSampler, getVisibleTileCoverage, MAX_TILES_3D, MIN_3D_ZOOM };

// Debounce after camera settles (stationary) before querying/rebuilding airspaces.
const VIEW_REFRESH_DEBOUNCE_MS = 100;
// Throttle interval while actively panning so destination airspaces stream in mid-drag.
const PAN_REFRESH_THROTTLE_MS = 350;
// Debounce terrain DEM updates before re-extruding ground-referenced airspaces.
const SAMPLER_REFRESH_DEBOUNCE_MS = 450;

const ALL_CATEGORIES = [
  AirspaceColorCategory.Prohibited,
  AirspaceColorCategory.Restricted,
  AirspaceColorCategory.Danger,
  AirspaceColorCategory.Other,
];

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
  @property({ type: Boolean })
  enabled = true;

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

  private timeSec = 0;
  private graphicsLayer?: GraphicsLayer;
  private graphicsLayerView?: LayerView;
  private categoryGraphics = new globalThis.Map<AirspaceColorCategory, Graphic>();
  private categorySymbols = new globalThis.Map<AirspaceColorCategory, MeshSymbol3D>();
  private categoryLineGraphics = new globalThis.Map<AirspaceColorCategory, Graphic>();
  private categoryLineSymbols = new globalThis.Map<AirspaceColorCategory, LineSymbol3D>();
  private highlightGraphic?: Graphic;
  private categoryBuckets = new globalThis.Map<AirspaceColorCategory, { parts: AirspaceMeshData[]; sigHash: number }>([
    [AirspaceColorCategory.Prohibited, { parts: [], sigHash: 0 }],
    [AirspaceColorCategory.Restricted, { parts: [], sigHash: 0 }],
    [AirspaceColorCategory.Danger, { parts: [], sigHash: 0 }],
    [AirspaceColorCategory.Other, { parts: [], sigHash: 0 }],
  ]);
  private meshCache = new AirspaceMeshCache();
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
        this.samplerTimer = window.setTimeout(() => this.rebuildMeshes(true), SAMPLER_REFRESH_DEBOUNCE_MS);
      });
    }

    if (!this.map || !this.showAirspace || !this.enabled) {
      this.clearLayer();
      return false;
    }

    const filterOrMapChanged =
      changedProps.has('map') ||
      changedProps.has('view') ||
      changedProps.has('enabled') ||
      changedProps.has('showAirspace') ||
      changedProps.has('maxAltitude') ||
      changedProps.has('showClasses') ||
      changedProps.has('showTypes') ||
      changedProps.has('hasTrack');

    if (filterOrMapChanged) {
      this.lastQueryKey = undefined;
      this.scheduleRefresh(true);
    } else if (changedProps.has('multiplier') || changedProps.has('sampler')) {
      const multiplierChanged = changedProps.has('multiplier');
      if (multiplierChanged) {
        this.meshCache.clear();
        for (const item of this.currentAirspaces) {
          item.meshData = undefined;
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
    this.refreshTimer = undefined;
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

  /**
   * Clears any currently active 3D airspace highlight graphic.
   */
  public clearHighlight(): void {
    if (this.highlightGraphic) {
      const g = this.highlightGraphic;
      this.highlightGraphic = undefined;
      this.graphicsLayer?.removeMany([g]);
      g.destroy?.();
    }
  }

  /**
   * Highlights the selected 3D airspace volume while its popup is displayed.
   */
  public highlightAirspace(item: CachedAirspaceItem): void {
    this.clearHighlight();
    const sampleGroundZ = createGroundSampler(this.sampler);
    const meshData =
      item.meshData ??
      (item.footprint ? extrudeAirspaceFootprint(item.footprint, item.airspace, this.multiplier, sampleGroundZ) : null);
    if (!meshData || meshData.positions.length === 0 || meshData.faces.length === 0) {
      return;
    }
    this.highlightGraphic = new Graphic({
      geometry: createMesh(meshData.positions, meshData.faces),
      symbol: createAirspaceFillSymbol(item.category ?? AirspaceColorCategory.Other, 0.8),
      attributes: { isAirspace: true, isAirspaceHighlight: true },
    });
    this.ensureGraphicsLayer().addMany([this.highlightGraphic]);
  }

  /**
   * Queries 2D airspace vector tiles at the 3D hit locations returned by ArcGIS `SceneView.hitTest`,
   * highlights the primary matched 3D volume, and opens a popup at the closest matching 3D hit point.
   */
  public async handleClick(
    hitPoints: Array<{ lat: number; lon: number; z?: number }>,
    scene: ArcgisScene,
  ): Promise<void> {
    if (!this.showAirspace || !this.enabled || hitPoints.length === 0) {
      return;
    }

    const sampleGroundZ = createGroundSampler(this.sampler);
    const mult = this.multiplier > 0 ? this.multiplier : 1;
    const date = getEffectiveAirspaceDate(this.hasTrack, this.timeSec);
    const airspaces: AirspaceTyped[] = [];
    const seen = new Set<number>();
    let popupPoint: { lat: number; lon: number; z?: number } | undefined;

    for (const pt of hitPoints) {
      const hasZ = typeof pt.z === 'number' && Number.isFinite(pt.z);
      const rawGnd = sampleGroundZ(pt.lon, pt.lat);
      const gndAltitude = (rawGnd > 0 ? rawGnd : hasZ ? pt.z! : 0) / mult;
      const list = await getAirspaceList({
        latLon: { lat: pt.lat, lon: pt.lon },
        altitude: hasZ ? pt.z! / mult : this.maxAltitude,
        gndAltitude,
        checkTop: hasZ,
        altitudeMargin: 150,
        marginPx: hasZ ? 3 : 0,
        maxFloorAltitude: this.maxAltitude,
        visibleClasses: this.showClasses,
        visibleTypes: this.showTypes,
        date,
      });

      if (list.length > 0) {
        popupPoint ??= pt;
        for (const asp of list) {
          if (!seen.has(asp.id)) {
            seen.add(asp.id);
            airspaces.push(asp);
            if (airspaces.length >= 5) {
              break;
            }
          }
        }
        if (airspaces.length >= 5) {
          break;
        }
      }
    }

    this.clearHighlight();
    if (airspaces.length > 0 && popupPoint) {
      const hitItem = findMatching3dItem(this.currentAirspaces, airspaces[0], popupPoint);
      if (hitItem) {
        this.highlightAirspace(hitItem);
      }
      await openAirspacePopup(scene, popupPoint, getAirspaceListHtml(airspaces), popupPoint.z);
    } else {
      await scene.closePopup?.();
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
        () => this.view?.center,
        () => {
          // While actively panning (stationary === false), throttle refreshes using refreshTimer
          // so destination airspaces stream in instead of waiting until the pan stops.
          if (this.showAirspace && this.view && !this.view.stationary && this.refreshTimer == null) {
            this.refreshTimer = window.setTimeout(() => {
              this.refreshTimer = undefined;
              void this.refreshView();
            }, PAN_REFRESH_THROTTLE_MS);
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
    this.refreshTimer = undefined;
    if (immediate) {
      void this.refreshView();
    } else {
      this.refreshTimer = window.setTimeout(() => {
        this.refreshTimer = undefined;
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
    this.clearHighlight();
    this.restoreDepthCache();
    this.currentAirspaces.length = 0;
    destroyGraphics(this.categoryGraphics.values());
    this.categoryGraphics.clear();
    destroyGraphics(this.categoryLineGraphics.values());
    this.categoryLineGraphics.clear();
    this.categorySymbols.clear();
    this.categoryLineSymbols.clear();
    this.graphicsLayerView = undefined;
    this.lastQueryKey = undefined;
    if (this.graphicsLayer) {
      this.map?.remove(this.graphicsLayer);
      this.graphicsLayer.destroy();
      this.graphicsLayer = undefined;
    }
  }

  private resolvePendingWorkers(beforeGeneration?: number): void {
    for (const [gen, resolve] of this.pendingWorkerResolvers) {
      if (beforeGeneration == null || gen < beforeGeneration) {
        resolve({ id: gen, items: [] });
      }
    }
    this.pendingWorkerResolvers.clear();
  }

  private clearLayer(): void {
    this.buildGeneration++;
    this.resolvePendingWorkers();
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

    if (response.isDelta) {
      const deltaMap = new globalThis.Map(response.items.map((item) => [item.airspace.id, item]));
      for (const item of this.currentAirspaces) {
        const delta = deltaMap.get(item.airspace.id);
        if (delta) {
          item.footprint = delta.footprint;
          const cached = this.meshCache.get(item.airspace, delta.footprint?.lod ?? 1);
          item.meshData = cached?.meshData;
          item.groundSignature = cached?.groundSignature;
          item.meshLod = cached?.meshLod;
        }
      }
    } else {
      const currentAirspaces = response.items as CachedAirspaceItem[];
      for (const item of currentAirspaces) {
        const cached = this.meshCache.get(item.airspace, item.footprint?.lod ?? 1);
        if (cached) {
          item.meshData = cached.meshData;
          item.groundSignature = cached.groundSignature;
          item.meshLod = cached.meshLod;
        }
      }
      this.currentAirspaces = currentAirspaces;
    }

    this.rebuildMeshes(false);
  }

  private async refreshView(): Promise<void> {
    if (!this.map || !this.showAirspace || !this.enabled) {
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
      Math.round(bounds.xmin * 5),
      Math.round(bounds.ymin * 5),
      Math.round(bounds.xmax * 5),
      Math.round(bounds.ymax * 5),
    ].join(',');
    const dateKey = this.hasTrack ? date.toISOString().slice(0, 10) : '';
    const queryKey = `${tilesKey}|${boundsKey}|${this.maxAltitude}|${this.showClasses.join(',')}|${this.showTypes.join(',')}|${dateKey}`;
    if (queryKey === this.lastQueryKey && this.graphicsLayer) {
      return;
    }

    const generation = ++this.buildGeneration;
    this.resolvePendingWorkers(generation);

    const request: AirspaceWorkerRequest = {
      id: generation,
      tiles,
      bounds,
      maxAltitude: this.maxAltitude,
      showClasses: this.showClasses,
      showTypes: this.showTypes,
      dateMs: date.getTime(),
      tileServer: import.meta.env.VITE_AIRSPACE_SERVER,
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

  private getCategorySymbol = (category: AirspaceColorCategory): MeshSymbol3D => {
    let symbol = this.categorySymbols.get(category);
    if (!symbol) {
      const alpha = Math.min(0.45, Math.max(0.05, (this.opacity / 100) * 0.45));
      symbol = createAirspaceFillSymbol(category, alpha);
      this.categorySymbols.set(category, symbol);
    }
    return symbol;
  };

  private getCategoryLineSymbol = (category: AirspaceColorCategory): LineSymbol3D => {
    let symbol = this.categoryLineSymbols.get(category);
    if (!symbol) {
      symbol = createAirspaceLineSymbol(category, this.opacity);
      this.categoryLineSymbols.set(category, symbol);
    }
    return symbol;
  };

  /**
   * Rebuilds 3D airspace geometry and updates GPU graphics layers.
   *
   * Performance Architecture:
   * 1. Selective re-extrusion & Distance LOD: Pure MSL airspaces are extruded once and cached permanently.
   *    Ground-referenced airspaces re-extrude only when their terrain signature changes, and distant
   *    airspaces skip ridge refinement (> 30 km) and perimeter contour lines (> 40 km).
   * 2. Category Batch Merging: Concatenates meshes and contours into at most 4 Mesh + 4 Polyline graphics.
   * 3. FNV-1a Signature Hashing: Skips GPU graphic reallocation when a category's signature is unchanged.
   */
  private rebuildMeshes(onlyGroundRef: boolean): void {
    if (!this.map || !this.showAirspace) {
      return;
    }

    const layer = this.ensureGraphicsLayer();
    const items = this.currentAirspaces;
    const sampleGroundZ = createGroundSampler(this.sampler);
    const dirtyCategories = new Set<AirspaceColorCategory>();
    let extrudedCount = 0;

    const camLon = this.view?.camera?.position?.longitude ?? this.view?.center?.longitude;
    const camLat = this.view?.camera?.position?.latitude ?? this.view?.center?.latitude;
    const cosLat = camLat != null ? Math.cos(camLat * DEG_TO_RAD) : 0.707;
    const maxRidgeDistKm2 = 30 * 30;
    const maxContourDistKm2 = 40 * 40;

    for (const item of items) {
      if (!item.footprint) {
        continue;
      }
      const isGroundRef = item.airspace.floorRefGnd || item.airspace.topRefGnd;
      if (onlyGroundRef && !isGroundRef && item.meshData != null) {
        continue;
      }

      const sig = isGroundRef ? computeGroundSignature(item.polygon, sampleGroundZ) : undefined;
      const targetLod = item.footprint.lod ?? 1;
      if (item.meshData != null && item.meshLod === targetLod && (!isGroundRef || item.groundSignature === sig)) {
        continue;
      }

      let maxRidgePasses: number | undefined;
      let skipContours = false;
      if (camLon != null && camLat != null && item.polygon.extent) {
        const dist2 = boundsDistanceSquaredKm(item.polygon.extent, camLon, camLat, cosLat);
        if (isGroundRef && dist2 > maxRidgeDistKm2) {
          maxRidgePasses = 0;
        }
        if (dist2 > maxContourDistKm2) {
          skipContours = true;
        }
      }

      const meshData = extrudeAirspaceFootprint(item.footprint, item.airspace, this.multiplier, sampleGroundZ, {
        maxRidgePasses,
        skipContours,
      });
      dirtyCategories.add(item.category);
      extrudedCount++;
      if (meshData) {
        item.meshData = meshData;
        item.groundSignature = sig;
        item.meshLod = targetLod;
        this.meshCache.set(item.airspace, { meshData, groundSignature: sig, meshLod: targetLod });
      } else {
        item.meshData = undefined;
        item.meshLod = undefined;
      }
    }

    if (onlyGroundRef && extrudedCount === 0) {
      return;
    }

    const multInt = Math.round(this.multiplier * 100);
    for (const bucket of this.categoryBuckets.values()) {
      bucket.parts.length = 0;
      bucket.sigHash = fnv1aMix(FNV1A_OFFSET_BASIS, multInt);
    }
    for (const item of items) {
      if (!item.meshData) {
        continue;
      }
      const bucket = this.categoryBuckets.get(item.category);
      if (bucket) {
        bucket.parts.push(item.meshData);
        let h = fnv1aMix(bucket.sigHash, item.airspace.id);
        h = fnv1aMix(h, item.groundSignature ?? 0);
        bucket.sigHash = fnv1aMix(h, item.meshLod ?? 0);
      }
    }

    const categoriesToUpdate = onlyGroundRef ? dirtyCategories : ALL_CATEGORIES;
    const toRemove: Graphic[] = [];
    const toAdd: Graphic[] = [];

    for (const category of categoriesToUpdate) {
      const bucket = this.categoryBuckets.get(category);
      const nextSig = bucket && bucket.parts.length > 0 ? bucket.sigHash >>> 0 : 0;
      const prevGraphic = this.categoryGraphics.get(category);
      const prevLineGraphic = this.categoryLineGraphics.get(category);
      if (
        (nextSig === 0 && !prevGraphic && !prevLineGraphic) ||
        (nextSig !== 0 && prevGraphic?.attributes?.sig === nextSig && prevLineGraphic?.attributes?.sig === nextSig)
      ) {
        continue;
      }

      const mergedMesh = bucket && bucket.parts.length > 0 ? mergeMeshData(bucket.parts) : null;
      syncCategoryGraphic(
        this.categoryGraphics,
        category,
        mergedMesh,
        nextSig,
        this.getCategorySymbol,
        { isAirspace: true },
        toAdd,
        toRemove,
      );

      const contourPaths = bucket && bucket.parts.length > 0 ? mergeContourPaths(bucket.parts) : [];
      const polyline =
        contourPaths.length > 0
          ? new Polyline({ paths: contourPaths, hasZ: true, spatialReference: { wkid: 4326 } })
          : null;
      syncCategoryGraphic(
        this.categoryLineGraphics,
        category,
        polyline,
        nextSig,
        this.getCategoryLineSymbol,
        { isAirspace: true, isAirspaceLine: true },
        toAdd,
        toRemove,
      );
    }

    if (toRemove.length > 0) {
      layer.removeMany(toRemove);
      destroyGraphics(toRemove);
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
    this.categoryLineSymbols.clear();
    for (const [category, graphic] of this.categoryGraphics.entries()) {
      graphic.symbol = this.getCategorySymbol(category);
    }
    for (const [category, lineGraphic] of this.categoryLineGraphics.entries()) {
      lineGraphic.symbol = this.getCategoryLineSymbol(category);
    }
  }

  createRenderRoot(): HTMLElement {
    return this;
  }
}
