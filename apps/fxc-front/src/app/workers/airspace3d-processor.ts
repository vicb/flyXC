import { unionExecuteMany } from '@arcgis/core/geometry/operators/unionOperator';
import Polygon from '@arcgis/core/geometry/Polygon';
import {
  type AirspaceColorCategory,
  type AirspaceServer,
  type AirspaceString,
  type AirspaceTyped,
  applyOverrides,
  type Class,
  getAirspaceColorCategory,
  getAirspaceTileUrl,
  isAirspaceVisible,
  toTypedAirspace,
  type Type,
} from '@flyxc/common';
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

export interface DecodedPolygonPart {
  id: string;
  rings: number[][][];
  extent?: AirspaceExtentLike;
  polygon?: Polygon;
}

export interface DecodedTileFeature {
  baseAirspace: AirspaceTyped;
  polygons: DecodedPolygonPart[];
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
}

export interface AirspaceWorkerResponse {
  id: number;
  items: AirspaceWorkerItem[];
  error?: string;
}

const MAX_TILE_CACHE_SIZE = 128;
const MAX_FOOTPRINT_CACHE_SIZE = 256;

export function getAirspaceKey(airspace: AirspaceTyped): string {
  return `${airspace.name}|${airspace.country}|${airspace.type}|${airspace.icaoClass}|${airspace.floorM}|${airspace.topM}|${airspace.floorRefGnd}|${airspace.topRefGnd}`;
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

export function geoJsonGeometryToParts(
  tilePrefix: string,
  featureIndex: number,
  geometry: { type: string; coordinates: any },
): DecodedPolygonPart[] {
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates as number[][][];
    const extent = computeRingsExtent(rings);
    return extent ? [{ id: `${tilePrefix}#${featureIndex}.0`, rings, extent }] : [];
  }
  if (geometry.type === 'MultiPolygon') {
    const parts: DecodedPolygonPart[] = [];
    const coords = geometry.coordinates as number[][][][];
    for (let pIdx = 0; pIdx < coords.length; pIdx++) {
      const rings = coords[pIdx];
      const extent = computeRingsExtent(rings);
      if (extent) {
        parts.push({ id: `${tilePrefix}#${featureIndex}.${pIdx}`, rings, extent });
      }
    }
    return parts;
  }
  return [];
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
 * Core background pipeline for fetching, decoding, unioning and triangulating 3D airspace volumes.
 * Can run inside a Web Worker or in-process (e.g. for testing).
 */
export class Airspace3dProcessor {
  private tileCache = new Map<string, Promise<DecodedTileFeature[] | null>>();
  private footprintCache = new Map<string, { polygon: AirspacePolygonLike; footprint: AirspaceFootprint }>();
  private scratchPolygons: Polygon[] = [];
  private lastRequestId = 0;

  public async process(request: AirspaceWorkerRequest): Promise<AirspaceWorkerResponse> {
    const requestId = request.id;
    if (requestId < this.lastRequestId) {
      return { id: requestId, items: [] };
    }
    this.lastRequestId = requestId;

    const { tiles, bounds, maxAltitude, showClasses, showTypes, dateMs, tileServer, multiplier } = request;
    const date = new Date(dateMs);

    const decodedTiles = await Promise.all(tiles.map((t) => this.fetchDecodedTile(t.x, t.y, t.z, tileServer)));
    if (requestId < this.lastRequestId) {
      return { id: requestId, items: [] };
    }

    const grouped = new Map<string, { airspace: AirspaceTyped; parts: DecodedPolygonPart[] }>();
    for (const features of decodedTiles) {
      if (!features) {
        continue;
      }
      for (const feature of features) {
        const airspace = applyOverrides(feature.baseAirspace, date);
        if (
          airspace.floorM > maxAltitude ||
          !isAirspaceVisible(airspace.icaoClass, showClasses, airspace.type, showTypes) ||
          (!airspace.floorRefGnd && !airspace.topRefGnd && airspace.topM <= airspace.floorM)
        ) {
          continue;
        }

        let hasVisiblePart = false;
        for (const p of feature.polygons) {
          if (extentOverlapsBounds(p.extent, bounds)) {
            hasVisiblePart = true;
            break;
          }
        }
        if (!hasVisiblePart) {
          continue;
        }

        const key = getAirspaceKey(airspace);
        let entry = grouped.get(key);
        if (!entry) {
          entry = { airspace, parts: [] };
          grouped.set(key, entry);
        }
        for (const p of feature.polygons) {
          if (extentOverlapsBounds(p.extent, bounds)) {
            entry.parts.push(p);
          }
        }
      }
    }

    const items: AirspaceWorkerItem[] = [];
    for (const [airspaceKey, { airspace, parts }] of grouped.entries()) {
      if (requestId < this.lastRequestId) {
        return { id: requestId, items: [] };
      }
      let geomKey: string;
      if (parts.length === 1) {
        geomKey = parts[0].id;
      } else {
        const ids: string[] = [];
        for (let i = 0; i < parts.length; i++) {
          ids.push(parts[i].id);
        }
        geomKey = ids.join(',');
      }
      const sinkZeroFloor = airspace.floorRefGnd && airspace.floorM === 0;
      const footprintKey = `${airspace.floorRefGnd ? 1 : 0}${airspace.topRefGnd ? 1 : 0}${sinkZeroFloor ? 1 : 0}|${geomKey}`;
      const cachedFp = this.footprintCache.get(footprintKey);

      let polygon: AirspacePolygonLike | undefined = cachedFp?.polygon;
      if (!polygon) {
        if (parts.length === 1) {
          polygon = { rings: parts[0].rings, extent: parts[0].extent };
        } else {
          this.scratchPolygons.length = 0;
          for (let i = 0; i < parts.length; i++) {
            this.scratchPolygons.push(
              (parts[i].polygon ??= new Polygon({ rings: parts[i].rings, spatialReference: { wkid: 4326 } })),
            );
          }
          const unioned = unionExecuteMany(this.scratchPolygons);
          if (unioned && unioned.type === 'polygon' && unioned.rings.length > 0) {
            polygon = {
              rings: unioned.rings,
              extent: unioned.extent
                ? {
                    xmin: unioned.extent.xmin,
                    ymin: unioned.extent.ymin,
                    xmax: unioned.extent.xmax,
                    ymax: unioned.extent.ymax,
                  }
                : computeRingsExtent(unioned.rings),
            };
          }
        }
      }

      if (polygon && polygon.rings.length > 0) {
        let footprint: AirspaceFootprint | undefined = cachedFp?.footprint;
        if (!footprint) {
          const built = await buildAirspaceFootprint(polygon, airspace);
          if (built) {
            footprint = built;
            setBoundedCache(this.footprintCache, MAX_FOOTPRINT_CACHE_SIZE, footprintKey, {
              polygon,
              footprint,
            });
          }
        }

        if (footprint) {
          const cacheKey = `${airspaceKey}|${geomKey}|${multiplier}`;
          items.push({
            airspaceKey,
            geomKey,
            footprintKey,
            cacheKey,
            category: getAirspaceColorCategory(airspace),
            airspace,
            polygon,
            footprint,
          });
        }
      }
    }

    return { id: requestId, items };
  }

  public clear(): void {
    this.tileCache.clear();
    this.footprintCache.clear();
  }

  private fetchDecodedTile(
    x: number,
    y: number,
    z: number,
    server: AirspaceServer,
  ): Promise<DecodedTileFeature[] | null> {
    const url = getAirspaceTileUrl(x, y, z, server);
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
          const polygons = geoJsonGeometryToParts(tilePrefix, i, geo.geometry);
          if (polygons.length > 0) {
            features.push({
              baseAirspace: toTypedAirspace(feature.properties as AirspaceString),
              polygons,
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
