import type { AirspaceString, AirspaceTyped, PmtilesSource, Point } from '@flyxc/common';
import {
  AIRSPACE_PMTILES_FILENAME,
  AIRSPACE_TILE_SIZE,
  AirspaceColorCategory,
  applyOverrides,
  arrayMax,
  EtagMismatch,
  fetchPmtilesTile,
  Flags,
  getAirspaceColorCategory,
  getPixelCoordinates,
  isPointInFeatureBbox,
  isPointInFlatGeometry,
  MAX_AIRSPACE_TILE_ZOOM,
  parallelTasksWithTimeout,
  protos,
  resetPmtilesClient,
  setPmtilesSourceFactory,
  toTypedAirspace,
} from '@flyxc/common';
import { AwsClient } from 'aws4fetch';
import { FeatureType, type FlatGeometry, VectorTile } from 'mapbox-vector-tile';
import type { LRU } from 'tiny-lru';
import { lru } from 'tiny-lru';

// Look MARGIN_METER above max altitude.
const MARGIN_METER = 200;

// Average airspace tile size.
// The average size is ~250 bytes at level 12 (395MB	for 1649364 tiles).
// The maximum size is ~2.2KB.
const ASLP_LRU_CAPACITY = 10000;

// Refresh PMTiles archive metadata/cache at most once per hour in long-lived Cloud Run instances.
const PMTILES_CACHE_TTL_MS = 3600_000;
const R2_BUCKET = 'flyxc-airspaces';
const R2_TIMEOUT_MS = 15_000;

// null is used when there is no tile at the given location.
let airspaceCache: LRU<ArrayBuffer | null> | null = null;
let pmtilesLastRefreshMs = 0;
let cacheGeneration = 0;
let r2SourceRegistered = false;

function getR2AirspaceUrl(): string {
  const accountId = process.env.R2_ACCOUNT_ID || SECRETS.R2_ACCOUNT_ID;
  return `https://${accountId}.r2.cloudflarestorage.com/${R2_BUCKET}/${AIRSPACE_PMTILES_FILENAME}`;
}

function createR2Source(url: string): PmtilesSource {
  const r2 = new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID || SECRETS.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || SECRETS.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
    retries: 3,
    initRetryMs: 200,
  });

  return {
    getKey: () => url,
    async getBytes(offset: number, length: number, signal?: AbortSignal, etag?: string) {
      const headers: Record<string, string> = {
        Range: `bytes=${offset}-${offset + length - 1}`,
      };
      if (etag) {
        headers['If-Match'] = etag;
      }
      const timeout = AbortSignal.timeout(R2_TIMEOUT_MS);
      const res = await r2.fetch(url, {
        headers,
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (res.status === 412 || res.status === 416) {
        throw new EtagMismatch(res.headers.get('etag') ?? undefined);
      }
      if (!res.ok) {
        throw new Error(`R2 range fetch failed: HTTP ${res.status}`);
      }
      return {
        data: await res.arrayBuffer(),
        etag: res.headers.get('etag') ?? undefined,
        cacheControl: res.headers.get('cache-control') ?? undefined,
        expires: res.headers.get('expires') ?? undefined,
      };
    },
  };
}

/**
 * Maps each track fix to its airspace tile key (`x/y` at `MAX_AIRSPACE_TILE_ZOOM`) and pixel coordinates.
 *
 * @param maxNumTiles - Stops collecting fixes once this many distinct tiles are reached.
 * @returns `indexesByTileUrl` (fix indices grouped by `x/y` tile key) and `pxInTiles` (per-fix pixel coordinates).
 */
export function getIndicesByUrlAndPx(
  track: protos.Track,
  maxNumTiles = Number.MAX_SAFE_INTEGER,
): {
  // List of track indices for each tile key (`x/y`).
  indexesByTileUrl: Map<string, number[]>;
  // Location in the tile for each track point.
  pxInTiles: Array<Point>;
} {
  const indexesByTileUrl = new Map<string, number[]>();
  const pxInTiles: Array<Point> = [];

  for (let i = 0; i < track.lat.length; i++) {
    const lon = track.lon[i];
    const lat = track.lat[i];
    const { tile, px } = getPixelCoordinates({ lat, lon }, MAX_AIRSPACE_TILE_ZOOM, AIRSPACE_TILE_SIZE);
    pxInTiles.push(px);
    const key = `${tile.x}/${tile.y}`;
    if (!indexesByTileUrl.has(key)) {
      indexesByTileUrl.set(key, []);
    }
    indexesByTileUrl.get(key)!.push(i);
    if (indexesByTileUrl.size >= maxNumTiles) {
      console.warn(`Too many tiles requested (${maxNumTiles})`);
      break;
    }
  }

  return { indexesByTileUrl, pxInTiles };
}

/**
 * Fetches a PMTiles tile with up to 3 attempts.
 * Returns tile bytes, or `null` if the tile is absent from the archive; throws if all attempts fail.
 */
async function fetchTileWithRetry(
  url: string,
  x: number,
  y: number,
  onEtagMismatch: () => void,
): Promise<ArrayBuffer | null> {
  for (let attempt = 3; ; attempt--) {
    try {
      return await fetchPmtilesTile(url, MAX_AIRSPACE_TILE_ZOOM, x, y, undefined, onEtagMismatch);
    } catch (err) {
      if (attempt === 1) {
        throw err;
      }
    }
  }
}

/**
 * Populates `cache` for the given `x/y` tile keys from the cloud PMTiles archive.
 * Refreshes the PMTiles client and clears `cache` after `PMTILES_CACHE_TTL_MS` or on ETag mismatch.
 * Failed tile fetches are retried and omitted from the returned map rather than throwing.
 *
 * @param tileKeys - Tile keys in `x/y` format at `MAX_AIRSPACE_TILE_ZOOM`.
 * @returns Request-local map of tile buffers (`null` when absent from the archive; omitted on fetch failure).
 * @throws If a non-fetch task step rejects (e.g., cache write failure).
 */
export async function populateTileCache(
  cache: LRU<ArrayBuffer | null>,
  tileKeys: string[],
): Promise<Map<string, ArrayBuffer | null>> {
  const pmtilesUrl = getR2AirspaceUrl();
  if (!r2SourceRegistered) {
    setPmtilesSourceFactory(pmtilesUrl, createR2Source);
    r2SourceRegistered = true;
  }
  const now = Date.now();
  if (now - pmtilesLastRefreshMs > PMTILES_CACHE_TTL_MS) {
    if (pmtilesLastRefreshMs > 0) {
      cacheGeneration++;
      resetPmtilesClient(pmtilesUrl);
      cache.clear();
    }
    pmtilesLastRefreshMs = now;
  }

  const tiles = new Map<string, ArrayBuffer | null>();
  const { results } = await parallelTasksWithTimeout(5, tileKeys, async (key: string) => {
    let buffer = cache.get(key);
    if (buffer === undefined) {
      const [x, y] = key.split('/').map(Number);
      const gen = cacheGeneration;
      try {
        buffer = await fetchTileWithRetry(pmtilesUrl, x, y, () => {
          cacheGeneration++;
          cache.clear();
        });
      } catch {
        return;
      }
      if (gen === cacheGeneration) {
        cache.set(key, buffer);
      }
    }
    tiles.set(key, buffer);
  });

  for (const result of results) {
    if (result.status === 'rejected') {
      throw result.reason;
    }
  }

  return tiles;
}

/**
 * Computes airspaces along `track` using `altitude` for ground-referenced floors and ceilings.
 *
 * @returns Airspace intervals sorted by `startSec`, with `hasErrors` set if ground altitude or any tile fetch failed.
 */
export async function fetchAirspaces(track: protos.Track, altitude: protos.GroundAltitude): Promise<protos.Airspaces> {
  const cache = getAirspaceCache();
  const { indexesByTileUrl, pxInTiles } = getIndicesByUrlAndPx(track, 500);

  const tiles = await populateTileCache(cache, [...indexesByTileUrl.keys()]);

  // Retrieve fix indexes for every airspaces.
  const gndAlt = altitude.altitudes;
  const indexesByAirspaceId = new Map<string, number[]>();
  const airspaceById = new Map<string, AirspaceTyped>();
  const maxAltitudeToCheck = arrayMax(track.alt) + MARGIN_METER;
  const startDate = track.timeSec[0] ? new Date(track.timeSec[0] * 1000) : new Date();
  let hasErrors = altitude.hasErrors;
  for (const [url, indexes] of indexesByTileUrl) {
    if (!tiles.has(url)) {
      hasErrors = true;
      continue;
    }
    const buffer = tiles.get(url);
    if (buffer == null) {
      continue;
    }
    const aspLayer = new VectorTile(new Uint8Array(buffer)).getLayer<AirspaceString>('asp');
    if (!aspLayer) {
      continue;
    }

    for (const feature of aspLayer) {
      if (feature.type !== FeatureType.POLYGON) {
        continue;
      }
      const airspace = applyOverrides(toTypedAirspace(feature.properties, feature.id), startDate);
      const airspaceId = getAirspaceFeatureId(airspace);
      let flatGeom: FlatGeometry | undefined;
      for (const fixIdx of indexes) {
        // Do not check airspaces above the track.
        // When the bottom references the ground it could be above the top for high ground elevation.
        // So we need to check both the bottom and the top.
        const floor = airspace.floorM + (airspace.floorRefGnd ? gndAlt[fixIdx] : 0);
        const top = airspace.topM + (airspace.topRefGnd ? gndAlt[fixIdx] : 0);
        const actualFloor = Math.min(floor, top);
        if (actualFloor > maxAltitudeToCheck) {
          // The airspace is above the track max altitude.
          continue;
        }
        const point = pxInTiles[fixIdx];
        if (isPointInFeatureBbox(point, feature)) {
          flatGeom ??= feature.loadFlatGeometry();
          if (flatGeom && isPointInFlatGeometry(point, flatGeom.coords, flatGeom.ends, feature.extent)) {
            if (!indexesByAirspaceId.has(airspaceId)) {
              indexesByAirspaceId.set(airspaceId, []);
              airspaceById.set(airspaceId, airspace);
            }
            indexesByAirspaceId.get(airspaceId)!.push(fixIdx);
          }
        }
      }
    }
  }

  // Compute index ranges.
  // [1, 2, 3, 8, 15, 16] -> [[1, 3], [8, 8], [1,16]]
  const rangesByAirspaceId = new Map<string, Array<[startIdx: number, endIdx: number]>>();
  for (const [id, indexes] of indexesByAirspaceId) {
    const ranges: Array<[startIdx: number, endIdx: number]> = [];
    rangesByAirspaceId.set(id, ranges);
    indexes.sort((a, b) => (a < b ? -1 : 1));
    let startIdx = indexes[0];
    let currentIdx = indexes[0];
    for (let i = 1; i < indexes.length; i++) {
      const nextIdx = indexes[i];
      if (nextIdx == currentIdx + 1) {
        currentIdx = nextIdx;
        continue;
      }
      ranges.push([startIdx, currentIdx]);
      startIdx = nextIdx;
      currentIdx = nextIdx;
    }
    ranges.push([startIdx, currentIdx]);
  }

  // Check if the tracks crosses the airspaces.
  const intoRangesByAirspaceId = new Map<string, boolean[]>();
  for (const [id, ranges] of rangesByAirspaceId) {
    const airspace = airspaceById.get(id);
    const intoRanges: boolean[] = [];
    intoRangesByAirspaceId.set(id, intoRanges);
    for (const [startIdx, endIdx] of ranges) {
      let into = false;
      for (let index = startIdx; index <= endIdx; index++) {
        const gndAlt = altitude.altitudes[index];
        const trackAlt = track.alt[index];
        const top = airspace.topM + (airspace.topRefGnd ? gndAlt : 0);
        const bottom = airspace.floorM + (airspace.floorRefGnd ? gndAlt : 0);
        if (trackAlt >= bottom && trackAlt <= top) {
          into = true;
          break;
        }
      }
      intoRanges.push(into);
    }
  }

  // Build the proto object
  const aspObjects: any[] = [];
  for (const [id, ranges] of rangesByAirspaceId) {
    const airspace = airspaceById.get(id);
    const intoRanges = intoRangesByAirspaceId.get(id);
    ranges.forEach(([start, end], rangeIndex) => {
      aspObjects.push({
        startSec: track.timeSec[start],
        endSec: track.timeSec[end],
        name: airspace.name,
        top: airspace.topM,
        bottom: airspace.floorM,
        into: intoRanges[rangeIndex],
        flags: getAirspaceFlags(airspace),
        icaoClass: airspace.icaoClass as number,
        type: airspace.type as number,
        activity: airspace.activity as number,
      });
    });
  }

  aspObjects.sort((a, b) => (a.startSec < b.startSec ? -1 : 1));

  const proto = protos.Airspaces.create({ hasErrors });

  aspObjects.forEach((asp) => {
    proto.startSec.push(asp.startSec);
    proto.endSec.push(asp.endSec);
    proto.name.push(asp.name);
    proto.top.push(asp.top);
    proto.bottom.push(asp.bottom);
    proto.flags.push(asp.flags);
    proto.into.push(asp.into);
    proto.icaoClass.push(asp.icaoClass);
    proto.type.push(asp.type);
    proto.activity.push(asp.activity);
  });

  return proto;
}

// Flags encode the color category and whether floor/top altitude ref is gnd.
function getAirspaceFlags(airspace: AirspaceTyped): number {
  let flags = 0;
  switch (getAirspaceColorCategory(airspace)) {
    case AirspaceColorCategory.Prohibited:
      flags |= Flags.AirspaceProhibited;
      break;
    case AirspaceColorCategory.Restricted:
      flags |= Flags.AirspaceRestricted;
      break;
    case AirspaceColorCategory.Danger:
      flags |= Flags.AirspaceDanger;
      break;
    case AirspaceColorCategory.Other:
      flags |= Flags.AirspaceOther;
      break;
  }

  if (airspace.floorRefGnd) {
    flags |= Flags.FloorRefGnd;
  }

  if (airspace.topRefGnd) {
    flags |= Flags.TopRefGnd;
  }

  return flags;
}

// Returns a unique id for an airspace.
function getAirspaceFeatureId(airspace: AirspaceTyped): string {
  return `${airspace.name}-${airspace.floorM}-${airspace.topM}`;
}

// Returns a lazily instantiated LRU for airspace tiles buffers.
function getAirspaceCache(): LRU<ArrayBuffer | null> {
  if (airspaceCache == null) {
    console.log(`ASP LRU Capacity = ${ASLP_LRU_CAPACITY}`);
    airspaceCache = lru<ArrayBuffer | null>(ASLP_LRU_CAPACITY);
  }
  return airspaceCache;
}
