import {
  AIRSPACE_3D_TILE_ZOOM,
  type AirspaceColorCategory,
  type AirspaceServer,
  type AirspaceString,
  type AirspaceTyped,
  applyOverrides,
  type Bounds2D,
  boundsOverlap,
  type Class,
  getAirspace3dTileUrl,
  getAirspaceColorCategory,
  getAirspaceDateUrl,
  isAirspaceVisible,
  setBoundedCache,
  toTypedAirspace,
  type Type,
} from '@flyxc/common';
import { type IDBPDatabase, openDB } from 'idb';
import { type Feature, FeatureType, VectorTile } from 'mapbox-vector-tile';

import {
  type AirspaceFootprint,
  type AirspacePolygonLike,
  buildAirspaceFootprint,
} from '../logic/airspace3d-footprint';

export interface TileCoord {
  x: number;
  y: number;
  z: number;
}

/**
 * Intermediate representation of an airspace feature parsed from a vector tile.
 *
 * Supports lazy geometry decoding:
 * - When tiles are initially parsed, cheap metadata (`id`, `baseAirspace`, and geographic `extent`
 *   via fast bbox) are populated alongside the `rawFeature` reference.
 * - Full polygon coordinate extraction (`toFlatGeoGeometry`) is deferred because most tile features
 *   are culled early by viewport, altitude, or visibility filters, or already hit the IndexedDB cache.
 * - When a surviving feature actually requires triangulation, `getDecodedPolygon` decodes `rawFeature`
 *   and caches the resulting flat geometry in `polygon`.
 * - In unit tests, pre-constructed `polygon` fixtures can be supplied directly without a `rawFeature`.
 */
export interface DecodedTileFeature {
  /** Numeric airspace feature ID. */
  id: number;
  /** Base airspace attributes decoded from vector tile properties. */
  baseAirspace: AirspaceTyped;
  /**
   * Lazily decoded or pre-computed flat polygon geometry.
   * If undefined, decoded on-demand from {@link rawFeature} via `getDecodedPolygon`.
   */
  polygon?: AirspacePolygonLike;
  /** Geographic bounding box in WGS84 degrees, used for fast viewport culling. */
  extent?: Bounds2D;
  /**
   * Raw vector tile feature reference for on-demand geometry decoding (`toFlatGeoGeometry`).
   * Avoids decoding coordinate buffers for airspaces culled by altitude or visibility filters.
   */
  rawFeature?: Feature<AirspaceString>;
  /** Tile X coordinate for unprojecting tile-local coordinates to WGS84 degrees. */
  tileX?: number;
  /** Tile Y coordinate for unprojecting tile-local coordinates to WGS84 degrees. */
  tileY?: number;
}

export interface AirspaceWorkerRequest {
  id: number;
  tiles: TileCoord[];
  bounds: Bounds2D;
  maxAltitude: number;
  showClasses: Class[];
  showTypes: Type[];
  dateMs: number;
  tileServer: AirspaceServer;
}

export interface AirspaceWorkerItem {
  category: AirspaceColorCategory;
  airspace: AirspaceTyped;
  polygon: AirspacePolygonLike;
  footprint: AirspaceFootprint;
}

export interface AirspaceWorkerResponse {
  id: number;
  items: AirspaceWorkerItem[];
  /** Whether processing for this request ID is fully complete (default: true). */
  isFinal?: boolean;
  /** Whether items are deltas to merge into existing items rather than replacing them (default: false). */
  isDelta?: boolean;
  error?: string;
}

const MAX_TILE_CACHE_SIZE = 128;
const MAX_FOOTPRINT_CACHE_SIZE = 1500;

/**
 * Core background pipeline for fetching, decoding, caching and triangulating 3D airspace volumes.
 *
 * Architectural Principles:
 * 1. Unclipped Zoom 6 Tiles: Rather than clipping polygons at tile boundaries and having to stitch
 *    them together with complex and fragile polygon union operations, airspaces are served unclipped
 *    at Zoom 6. Each airspace geometry appears in full in whichever tile its center/origin belongs,
 *    and duplicates across tiles are trivially deduplicated by feature ID.
 * 2. Two-tier Persistent Cache: Footprint geometries and 2D triangulations are cached in a fast
 *    in-memory Map (L1) and persisted across browser sessions in IndexedDB (L2).
 * 3. Cache Invalidation: An automated remote date/timestamp check against the airspace server
 *    invalidates the IndexedDB cache when fresh aeronautical data cycles are published.
 * 4. Progressive Level of Detail (LOD) & Adaptive Triangulation: Polygons with terrain-referenced
 *    caps are first emitted at LOD 0 (coarse Steiner grid, up to ~4800m) for immediate rendering,
 *    followed by LOD 1 for fine fidelity without freezing the UI. Base grid spacing and wall
 *    densification scale with minimum AGL clearance (`computeTargetGridM`, covering both AGL ceilings
 *    and elevated AGL floors down to 400m), and LOD 1 caps are further subdivided across sharp mountain
 *    ridges during DEM extrusion (`refineTerrainCapForRidges`) to prevent ridge puncture.
 *
 * Can run inside a dedicated Web Worker or in-process (e.g. for unit tests).
 */
export class Airspace3dProcessor {
  private tileCache = new Map<string, Promise<DecodedTileFeature[] | null>>();
  private footprintCache = new Map<number, { polygon: AirspacePolygonLike; footprint: AirspaceFootprint }>();
  private lastRequestId = 0;
  private dbPromise: Promise<IDBPDatabase | null> | null = null;
  private lastDateCheckTime = 0;
  private lastCheckedServer?: AirspaceServer;
  private lastObservedVersion?: string;
  private cacheGeneration = 0;

  private invalidateMemoryCaches(): void {
    this.cacheGeneration++;
    this.footprintCache.clear();
    this.tileCache.clear();
  }

  private async getDb(): Promise<IDBPDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return null;
    }
    if (!this.dbPromise) {
      this.dbPromise = openDB('flyxc-airspaces-3d', 1, {
        upgrade(db) {
          db.createObjectStore('metadata');
          db.createObjectStore('footprints');
        },
      }).catch(() => null);
    }
    return this.dbPromise;
  }

  private async checkRemoteDate(server: AirspaceServer): Promise<void> {
    const now = Date.now();
    if (this.lastCheckedServer === server && now - this.lastDateCheckTime < 60_000) {
      return;
    }
    this.lastCheckedServer = server;
    this.lastDateCheckTime = now;
    try {
      const db = await this.getDb();
      const remoteDateUrl = getAirspaceDateUrl(server);
      const res = await fetch(remoteDateUrl, { cache: 'no-cache' });
      if (!res.ok) {
        // Allow retry on subsequent calls if request failed
        this.lastDateCheckTime = 0;
        return;
      }
      const { date: remoteDate, timestamp: remoteTimestamp } = (await res.json()) as {
        date?: string;
        timestamp?: number | string;
      };
      const remoteVersion = remoteTimestamp != null ? String(remoteTimestamp) : remoteDate;
      if (!remoteVersion) {
        return;
      }
      const storedVersion = db ? await db.get('metadata', 'version') : undefined;
      const versionChanged = db
        ? storedVersion !== remoteVersion
        : this.lastObservedVersion != null && this.lastObservedVersion !== remoteVersion;

      if (versionChanged) {
        this.invalidateMemoryCaches();
        if (db) {
          const tx = db.transaction(['footprints', 'metadata'], 'readwrite');
          await Promise.all([
            tx.objectStore('footprints').clear(),
            tx.objectStore('metadata').put(remoteVersion, 'version'),
            tx.done,
          ]);
        }
      }
      this.lastObservedVersion = remoteVersion;
    } catch {
      // Allow retry on subsequent calls if network threw
      this.lastDateCheckTime = 0;
    }
  }

  private async withDb<T>(fn: (db: IDBPDatabase) => Promise<T>): Promise<T | null> {
    try {
      const db = await this.getDb();
      return db ? await fn(db) : null;
    } catch {
      return null;
    }
  }

  private cacheFootprint(
    id: number,
    entry: { polygon: AirspacePolygonLike; footprint: AirspaceFootprint },
    generation: number,
  ): void {
    if (generation !== this.cacheGeneration) {
      return;
    }
    setBoundedCache(this.footprintCache, MAX_FOOTPRINT_CACHE_SIZE, id, entry);
    void this.withDb((db) => db.put('footprints', entry, id));
  }

  public async process(
    request: AirspaceWorkerRequest,
    onProgress?: (response: AirspaceWorkerResponse) => void,
  ): Promise<AirspaceWorkerResponse> {
    const requestId = request.id;
    if (requestId < this.lastRequestId) {
      return { id: requestId, items: [] };
    }
    this.lastRequestId = requestId;

    const { tiles, bounds, maxAltitude, showClasses, showTypes, dateMs, tileServer } = request;
    const date = new Date(dateMs);

    // Sync IndexedDB cache with remote airspaces-date.json
    await this.checkRemoteDate(tileServer);

    const fetchGeneration = this.cacheGeneration;
    const decodedTiles = await Promise.all(tiles.map((t) => this.fetchDecodedTile(t.x, t.y, t.z, tileServer)));
    if (requestId < this.lastRequestId) {
      return { id: requestId, items: [] };
    }

    const seenIds = new Set<number>();
    const items: AirspaceWorkerItem[] = [];
    const pendingRefinements: {
      item: AirspaceWorkerItem;
      airspace: AirspaceTyped;
      polygon: AirspacePolygonLike;
    }[] = [];

    for (const features of decodedTiles) {
      if (!features) {
        continue;
      }
      for (const feat of features) {
        if (requestId < this.lastRequestId) {
          return { id: requestId, items: [] };
        }
        if (seenIds.has(feat.id)) {
          continue;
        }
        seenIds.add(feat.id);

        const airspace = applyOverrides(feat.baseAirspace, date);
        airspace.id ??= feat.id;
        if (
          airspace.floorM > maxAltitude ||
          !isAirspaceVisible(airspace.icaoClass, showClasses, airspace.type, showTypes) ||
          (!airspace.floorRefGnd && !airspace.topRefGnd && airspace.topM <= airspace.floorM) ||
          !boundsOverlap(feat.extent, bounds)
        ) {
          continue;
        }

        const sinkZeroFloor = airspace.floorRefGnd && airspace.floorM === 0;

        let cachedFp = this.footprintCache.get(feat.id);
        if (!cachedFp) {
          const idbRecord = await this.withDb<
            { polygon: AirspacePolygonLike; footprint: AirspaceFootprint } | undefined
          >((db) => db.get('footprints', feat.id));
          if (idbRecord) {
            cachedFp = idbRecord;
            setBoundedCache(this.footprintCache, MAX_FOOTPRINT_CACHE_SIZE, feat.id, cachedFp);
          }
        }

        const polygon: AirspacePolygonLike = cachedFp?.polygon ?? feat.polygon ?? this.getDecodedPolygon(feat);

        if (polygon.ends.length > 0) {
          let footprint: AirspaceFootprint | undefined = cachedFp?.footprint;
          const needsTerrainCap = airspace.topRefGnd || (!sinkZeroFloor && airspace.floorRefGnd);
          const isProgressive = onProgress != null && needsTerrainCap && (!footprint || footprint.lod === 0);

          if (!footprint) {
            const built = buildAirspaceFootprint(polygon, airspace, { coarse: isProgressive });
            if (built) {
              footprint = built;
              if (!isProgressive) {
                this.cacheFootprint(feat.id, { polygon, footprint }, fetchGeneration);
              }
            }
          }

          if (footprint) {
            const item: AirspaceWorkerItem = {
              category: getAirspaceColorCategory(airspace),
              airspace,
              polygon,
              footprint,
            };
            items.push(item);

            if (isProgressive) {
              pendingRefinements.push({ item, airspace, polygon });
            }
          }
        }
      }
    }

    if (onProgress && pendingRefinements.length > 0) {
      onProgress({ id: requestId, items: [...items], isFinal: false });

      const refinedItems: AirspaceWorkerItem[] = [];
      for (const pending of pendingRefinements) {
        if (requestId < this.lastRequestId) {
          return { id: requestId, items: [] };
        }
        const fineFootprint = buildAirspaceFootprint(pending.polygon, pending.airspace, { coarse: false });
        if (fineFootprint) {
          pending.item.footprint = fineFootprint;
          this.cacheFootprint(
            pending.item.airspace.id,
            {
              polygon: pending.polygon,
              footprint: fineFootprint,
            },
            fetchGeneration,
          );
          refinedItems.push(pending.item);
        }
      }

      if (requestId < this.lastRequestId) {
        return { id: requestId, items: [] };
      }

      const finalResponse: AirspaceWorkerResponse = {
        id: requestId,
        items: refinedItems,
        isDelta: true,
      };
      onProgress(finalResponse);
      return finalResponse;
    }

    const singleResponse: AirspaceWorkerResponse = { id: requestId, items };
    onProgress?.(singleResponse);
    return singleResponse;
  }

  public async clear(): Promise<void> {
    this.invalidateMemoryCaches();
    await this.withDb((db) => db.clear('footprints'));
  }

  private getDecodedPolygon(feat: DecodedTileFeature): AirspacePolygonLike {
    if (feat.polygon) {
      return feat.polygon;
    }
    if (feat.rawFeature && feat.tileX !== undefined && feat.tileY !== undefined) {
      const flat = feat.rawFeature.toFlatGeoGeometry(feat.tileX, feat.tileY, AIRSPACE_3D_TILE_ZOOM);
      feat.polygon = {
        coords: flat.coords,
        ends: flat.ends,
        extent: feat.extent,
      };
      // Release raw vector tile feature to free underlying PBF buffer and internal flatGeometry cache
      feat.rawFeature = undefined;
      return feat.polygon;
    }
    return {
      coords: new Float64Array(0),
      ends: new Uint32Array(0),
      extent: feat.extent,
    };
  }

  public fetchDecodedTile(
    x: number,
    y: number,
    _z: number,
    server: AirspaceServer,
  ): Promise<DecodedTileFeature[] | null> {
    const url = getAirspace3dTileUrl(x, y, server);
    const cached = this.tileCache.get(url);
    if (cached) {
      return cached;
    }

    const gen = this.cacheGeneration;
    const promise = (async (): Promise<DecodedTileFeature[] | null> => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          if (response.status !== 404 && gen === this.cacheGeneration) {
            this.tileCache.delete(url);
          }
          return null;
        }
        const buffer = await response.arrayBuffer();
        const tile = new VectorTile(new Uint8Array(buffer));
        const layer = tile.getLayer<AirspaceString>('asp');
        if (!layer) {
          return null;
        }
        const features: DecodedTileFeature[] = [];
        for (const feature of layer) {
          if (feature.type !== FeatureType.POLYGON) {
            continue;
          }
          const [xmin, ymin, xmax, ymax] = feature.geoBbox(x, y, AIRSPACE_3D_TILE_ZOOM);
          const id = Number(feature.id);
          features.push({
            id,
            baseAirspace: toTypedAirspace(feature.properties, id),
            extent: { xmin, ymin, xmax, ymax },
            rawFeature: feature,
            tileX: x,
            tileY: y,
          });
        }
        return features;
      } catch {
        if (gen === this.cacheGeneration) {
          this.tileCache.delete(url);
        }
        return null;
      }
    })();

    setBoundedCache(this.tileCache, MAX_TILE_CACHE_SIZE, url, promise);
    return promise;
  }
}
