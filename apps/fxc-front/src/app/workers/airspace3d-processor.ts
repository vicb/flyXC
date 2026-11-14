import {
  type AirspaceColorCategory,
  type AirspaceServer,
  type AirspaceString,
  type AirspaceTyped,
  applyOverrides,
  type Class,
  getAirspace3dTileUrl,
  getAirspaceColorCategory,
  getAirspaceDateUrl,
  isAirspaceVisible,
  toTypedAirspace,
  type Type,
} from '@flyxc/common';
import { type IDBPDatabase, openDB } from 'idb';
import { VectorTile } from 'mapbox-vector-tile';

import {
  type AirspaceExtentLike,
  type AirspaceFootprint,
  type AirspacePolygonLike,
  buildAirspaceFootprint,
} from '../components/3d/airspace3d-mesh';

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
  id: number | string;
  baseAirspace: AirspaceTyped;
  rings: number[][][];
  extent?: AirspaceExtentLike;
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
  multiplier: number;
}

export interface AirspaceWorkerItem {
  airspaceKey: string;
  geomKey: string;
  footprintKey: string;
  cacheKey: string;
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

export function getAirspaceKey(airspace: AirspaceTyped): string {
  return String(airspace.id);
}

export function computeRingsExtent(rings: number[][][]): AirspaceExtentLike | undefined {
  let xmin = Number.POSITIVE_INFINITY;
  let ymin = Number.POSITIVE_INFINITY;
  let xmax = Number.NEGATIVE_INFINITY;
  let ymax = Number.NEGATIVE_INFINITY;
  for (const ring of rings) {
    for (const pt of ring) {
      const lon = pt[0];
      const lat = pt[1];
      if (lon < xmin) {
        xmin = lon;
      }
      if (lon > xmax) {
        xmax = lon;
      }
      if (lat < ymin) {
        ymin = lat;
      }
      if (lat > ymax) {
        ymax = lat;
      }
    }
  }
  return xmin <= xmax && ymin <= ymax ? { xmin, ymin, xmax, ymax } : undefined;
}

export function geoJsonGeometryToRings(geometry: {
  type: string;
  coordinates: any;
}): { rings: number[][][]; extent?: AirspaceExtentLike } | undefined {
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates as number[][][];
    const extent = computeRingsExtent(rings);
    return extent ? { rings, extent } : undefined;
  }
  if (geometry.type === 'MultiPolygon') {
    const coords = geometry.coordinates as number[][][][];
    const rings: number[][][] = [];
    for (const poly of coords) {
      rings.push(...poly);
    }
    const extent = computeRingsExtent(rings);
    return extent ? { rings, extent } : undefined;
  }
  return undefined;
}

export function extentOverlapsBounds(ext: AirspaceExtentLike | undefined, bounds: GeoBounds): boolean {
  if (!ext) {
    return true;
  }
  return (
    ext.xmax >= bounds.minLon && ext.xmin <= bounds.maxLon && ext.ymax >= bounds.minLat && ext.ymin <= bounds.maxLat
  );
}

/**
 * Core background pipeline for fetching, decoding, caching and triangulating 3D airspace volumes.
 * Uses Zoom 6 unclipped tiles to eliminate multi-tile polygon union entirely.
 * Can run inside a Web Worker or in-process (e.g. for testing).
 */
export class Airspace3dProcessor {
  private tileCache = new Map<string, Promise<DecodedTileFeature[] | null>>();
  private footprintCache = new Map<string, { polygon: AirspacePolygonLike; footprint: AirspaceFootprint }>();
  private lastRequestId = 0;
  private dbPromise: Promise<IDBPDatabase | null> | null = null;
  private lastDateCheckTime = 0;
  private lastCheckedServer?: AirspaceServer;
  private currentVersion?: string;

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
      this.currentVersion = remoteVersion;
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
    key: string,
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
    key: string,
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

    const { tiles, bounds, maxAltitude, showClasses, showTypes, dateMs, tileServer, multiplier } = request;
    const date = new Date(dateMs);

    // Sync IndexedDB cache with remote airspaces-date.json
    await this.checkRemoteDate(tileServer);

    const decodedTiles = await Promise.all(tiles.map((t) => this.fetchDecodedTile(t.x, t.y, t.z, tileServer)));
    if (requestId < this.lastRequestId) {
      return { id: requestId, items: [] };
    }

    const seenIds = new Set<number | string>();
    const items: AirspaceWorkerItem[] = [];
    const pendingRefinements: {
      item: AirspaceWorkerItem;
      airspace: AirspaceTyped;
      polygon: AirspacePolygonLike;
      footprintKey: string;
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

        const airspaceKey = getAirspaceKey(airspace);
        const geomKey = String(feat.id);
        const sinkZeroFloor = airspace.floorRefGnd && airspace.floorM === 0;
        const FOOTPRINT_SCHEMA_VERSION = 'v4';
        const footprintKey = `${FOOTPRINT_SCHEMA_VERSION}|${airspace.floorRefGnd ? 1 : 0}${airspace.topRefGnd ? 1 : 0}${sinkZeroFloor ? 1 : 0}|${geomKey}`;

        let cachedFp = this.footprintCache.get(footprintKey);
        if (!cachedFp) {
          const idbRecord = await this.getFromIdb(footprintKey);
          if (idbRecord) {
            cachedFp = idbRecord;
            setBoundedCache(this.footprintCache, MAX_FOOTPRINT_CACHE_SIZE, footprintKey, cachedFp);
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
            const built = await buildAirspaceFootprint(polygon, airspace, { coarse: isProgressive });
            if (built) {
              footprint = built;
              if (!isProgressive) {
                const entry = { polygon, footprint };
                setBoundedCache(this.footprintCache, MAX_FOOTPRINT_CACHE_SIZE, footprintKey, entry);
                void this.saveToIdb(footprintKey, entry);
              }
            }
          }

          if (footprint) {
            const versionPrefix = this.currentVersion ? `${this.currentVersion}|` : '';
            const cacheKey = `${versionPrefix}${airspaceKey}|${geomKey}|${multiplier}`;
            const item: AirspaceWorkerItem = {
              airspaceKey,
              geomKey,
              footprintKey,
              cacheKey,
              category: getAirspaceColorCategory(airspace),
              airspace,
              polygon,
              footprint,
              lod: footprint.lod ?? 1,
            };
            items.push(item);

            if (isProgressive) {
              pendingRefinements.push({ item, airspace, polygon, footprintKey });
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
        const fineFootprint = await buildAirspaceFootprint(pending.polygon, pending.airspace, { coarse: false });
        if (fineFootprint) {
          pending.item.footprint = fineFootprint;
          pending.item.lod = 1;
          const entry = {
            polygon: pending.polygon,
            footprint: fineFootprint,
          };
          setBoundedCache(this.footprintCache, MAX_FOOTPRINT_CACHE_SIZE, pending.footprintKey, entry);
          void this.saveToIdb(pending.footprintKey, entry);
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
          const geo = feature.toGeoJSON(x, y, 6) as { geometry: { type: string; coordinates: any } };
          const ringsInfo = geoJsonGeometryToRings(geo.geometry);
          if (ringsInfo && ringsInfo.rings.length > 0) {
            const baseAirspace = toTypedAirspace(feature.properties as AirspaceString);
            const rawId = feature.id ?? feature.properties?.id ?? baseAirspace.id;
            const featureId = typeof rawId === 'number' || typeof rawId === 'string' ? rawId : `${x}/${y}#${i}`;
            features.push({
              id: featureId,
              baseAirspace,
              rings: ringsInfo.rings,
              extent: ringsInfo.extent,
            });
          }
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
