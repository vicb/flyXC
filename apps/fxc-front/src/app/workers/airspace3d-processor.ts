import {
  AIRSPACE_3D_TILE_ZOOM,
  type AirspaceColorCategory,
  type AirspaceServer,
  type AirspaceString,
  type AirspaceTyped,
  applyOverrides,
  type Bounds2D,
  type Class,
  flattenPolygonRings,
  getAirspace3dTileUrl,
  getAirspaceColorCategory,
  getAirspaceDateUrl,
  isAirspaceVisible,
  toTypedAirspace,
  type Type,
} from '@flyxc/common';
import { type IDBPDatabase, openDB } from 'idb';
import { FeatureType, VectorTile } from 'mapbox-vector-tile';

import { type AirspaceFootprint, type AirspacePolygonLike, buildAirspaceFootprint } from '../logic/airspace3d-mesh';

export interface TileCoord {
  x: number;
  y: number;
  z: number;
}

export interface GeoBounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface DecodedTileFeature {
  id: number;
  baseAirspace: AirspaceTyped;
  rings: number[][][];
  extent?: Bounds2D;
}

export interface AirspaceWorkerRequest {
  id: number;
  tiles: TileCoord[];
  bounds: GeoBounds;
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
  lod?: number;
}

export interface AirspaceWorkerResponse {
  id: number;
  items: AirspaceWorkerItem[];
  lod?: number;
  isFinal?: boolean;
  error?: string;
}

const MAX_TILE_CACHE_SIZE = 128;
const MAX_FOOTPRINT_CACHE_SIZE = 256;

export function extentOverlapsBounds(ext: Bounds2D | undefined, bounds: GeoBounds): boolean {
  if (!ext) {
    return true;
  }
  return (
    ext.xmax >= bounds.minLon && ext.xmin <= bounds.maxLon && ext.ymax >= bounds.minLat && ext.ymin <= bounds.maxLat
  );
}

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

  private async getDb(): Promise<IDBPDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return null;
    }
    if (!this.dbPromise) {
      this.dbPromise = openDB('flyxc-airspaces-3d', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('metadata')) {
            db.createObjectStore('metadata');
          }
          if (!db.objectStoreNames.contains('footprints')) {
            db.createObjectStore('footprints');
          }
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
      if (!db) {
        return;
      }
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
      const storedVersion = (await db.get('metadata', 'version')) ?? (await db.get('metadata', 'date'));
      if (storedVersion !== remoteVersion) {
        await db.clear('footprints');
        await db.put('metadata', remoteVersion, 'version');
        await db.delete('metadata', 'date');
        this.footprintCache.clear();
        this.tileCache.clear();
      }
    } catch {
      // Allow retry on subsequent calls if network threw
      this.lastDateCheckTime = 0;
    }
  }

  private async getFromIdb(
    key: number,
  ): Promise<{ polygon: AirspacePolygonLike; footprint: AirspaceFootprint } | null> {
    try {
      const db = await this.getDb();
      if (!db) {
        return null;
      }
      const record = await db.get('footprints', key);
      return record ?? null;
    } catch {
      return null;
    }
  }

  private async saveToIdb(
    key: number,
    value: { polygon: AirspacePolygonLike; footprint: AirspaceFootprint },
  ): Promise<void> {
    try {
      const db = await this.getDb();
      if (!db) {
        return;
      }
      await db.put('footprints', value, key);
    } catch {
      // Ignore write errors (e.g. quota)
    }
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
        if (
          airspace.floorM > maxAltitude ||
          !isAirspaceVisible(airspace.icaoClass, showClasses, airspace.type, showTypes) ||
          (!airspace.floorRefGnd && !airspace.topRefGnd && airspace.topM <= airspace.floorM) ||
          !extentOverlapsBounds(feat.extent, bounds)
        ) {
          continue;
        }

        const sinkZeroFloor = airspace.floorRefGnd && airspace.floorM === 0;

        let cachedFp = this.footprintCache.get(feat.id);
        if (!cachedFp) {
          const idbRecord = await this.getFromIdb(feat.id);
          if (idbRecord) {
            cachedFp = idbRecord;
            setBoundedCache(this.footprintCache, MAX_FOOTPRINT_CACHE_SIZE, feat.id, cachedFp);
          }
        }

        const polygon: AirspacePolygonLike = cachedFp?.polygon ?? {
          rings: feat.rings,
          extent: feat.extent,
        };

        if (polygon.rings.length > 0) {
          let footprint: AirspaceFootprint | undefined = cachedFp?.footprint;
          const needsTerrainCap = airspace.topRefGnd || (!sinkZeroFloor && airspace.floorRefGnd);
          const isProgressive = onProgress != null && needsTerrainCap && (!footprint || footprint.lod === 0);

          if (!footprint) {
            const built = buildAirspaceFootprint(polygon, airspace, { coarse: isProgressive });
            if (built) {
              footprint = built;
              if (!isProgressive) {
                const entry = { polygon, footprint };
                setBoundedCache(this.footprintCache, MAX_FOOTPRINT_CACHE_SIZE, feat.id, entry);
                void this.saveToIdb(feat.id, entry);
              }
            }
          }

          if (footprint) {
            const item: AirspaceWorkerItem = {
              category: getAirspaceColorCategory(airspace),
              airspace,
              polygon,
              footprint,
              lod: footprint.lod ?? 1,
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
      onProgress({ id: requestId, items: [...items], lod: 0, isFinal: false });

      for (const pending of pendingRefinements) {
        if (requestId < this.lastRequestId) {
          return { id: requestId, items: [] };
        }
        const fineFootprint = buildAirspaceFootprint(pending.polygon, pending.airspace, { coarse: false });
        if (fineFootprint) {
          pending.item.footprint = fineFootprint;
          pending.item.lod = 1;
          const entry = {
            polygon: pending.polygon,
            footprint: fineFootprint,
          };
          setBoundedCache(this.footprintCache, MAX_FOOTPRINT_CACHE_SIZE, pending.item.airspace.id, entry);
          void this.saveToIdb(pending.item.airspace.id, entry);
        }
      }

      if (requestId < this.lastRequestId) {
        return { id: requestId, items: [] };
      }

      const finalResponse: AirspaceWorkerResponse = { id: requestId, items, lod: 1, isFinal: true };
      onProgress(finalResponse);
      return finalResponse;
    }

    const singleResponse: AirspaceWorkerResponse = { id: requestId, items, lod: 1, isFinal: true };
    onProgress?.(singleResponse);
    return singleResponse;
  }

  public async clear(): Promise<void> {
    this.tileCache.clear();
    this.footprintCache.clear();
    try {
      const db = await this.getDb();
      if (db) {
        await db.clear('footprints');
      }
    } catch {
      // Ignore
    }
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

    const promise = (async (): Promise<DecodedTileFeature[] | null> => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
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
          const rings = flattenPolygonRings(feature.toGeoPolygons(x, y, AIRSPACE_3D_TILE_ZOOM));
          if (rings.length === 0) {
            continue;
          }
          const [xmin, ymin, xmax, ymax] = feature.geoBbox(x, y, AIRSPACE_3D_TILE_ZOOM);
          const id = Number(feature.id);
          features.push({
            id,
            baseAirspace: toTypedAirspace(feature.properties, id),
            rings,
            extent: { xmin, ymin, xmax, ymax },
          });
        }
        return features;
      } catch {
        this.tileCache.delete(url);
        return null;
      }
    })();

    setBoundedCache(this.tileCache, MAX_TILE_CACHE_SIZE, url, promise);
    return promise;
  }
}

export function setBoundedCache<K, V>(cache: Map<K, V>, maxSize: number, key: K, value: V): void {
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
