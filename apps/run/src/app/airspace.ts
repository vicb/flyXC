import {
  AIRSPACE_TILE_SIZE,
  AirspaceColorCategory,
  AirspaceString,
  AirspaceTyped,
  fetchResponse,
  Flags,
  getAirspaceColorCategory,
  getAirspaceTileUrl,
  isInFeature,
  MAX_AIRSPACE_TILE_ZOOM,
  pixelCoordinates,
  Point,
  protos,
  toTypedAirspace,
} from '@flyxc/common';
import async from 'async';
import { VectorTile } from 'mapbox-vector-tile';
import { LRU, lru } from 'tiny-lru';

// Look MARGIN_METER above max altitude.
const MARGIN_METER = 200;

// Average airspace tile size.
// The average size is ~250 bytes at level 12 (395MB	for 1649364 tiles).
// The maximum size is ~2.2KB.
const ASLP_LRU_CAPACITY = 10000;

// null is used when there is no tile at the given location.
let airspaceCache: LRU<ArrayBuffer | null> | null = null;

export function getIndicesByUrlAndPx(
  track: protos.Track,
  maxNumTiles = Number.MAX_SAFE_INTEGER,
): {
  // List of track indices for each tile url.
  indexesByTileUrl: Map<string, number[]>;
  // Location in the tile for each track point.
  pxInTiles: Array<Point>;
} {
  const indexesByTileUrl = new Map<string, number[]>();
  const pxInTiles: Array<Point> = [];

  for (let i = 0; i < track.lat.length; i++) {
    const lon = track.lon[i];
    const lat = track.lat[i];
    const { tile, px } = pixelCoordinates({ lat, lon }, MAX_AIRSPACE_TILE_ZOOM, AIRSPACE_TILE_SIZE);
    pxInTiles.push(px);
    const url = getAirspaceTileUrl(tile.x, tile.y, MAX_AIRSPACE_TILE_ZOOM, 'cloud');
    if (!indexesByTileUrl.has(url)) {
      indexesByTileUrl.set(url, []);
    }
    indexesByTileUrl.get(url).push(i);
    if (indexesByTileUrl.size >= maxNumTiles) {
      console.warn(`Too many tiles requested (${maxNumTiles})`);
      break;
    }
  }

  return { indexesByTileUrl, pxInTiles };
}

// Populate the cache with the passed URLs.
async function populateTileCache(cache: LRU<ArrayBuffer | null>, urls: string[]): Promise<void> {
  // Downloading tiles might return 404 if there is not airspace.
  // We then can not rely on 404 to detect errors.
  await async.eachLimit(urls, 5, async (url: string) => {
    let buffer = cache.get(url);
    if (buffer === undefined) {
      try {
        const response = await fetchResponse(url, {
          retry: 3,
          timeoutS: 5,
          retryOnTimeout: true,
        });
        buffer = response.ok ? await response.arrayBuffer() : null;
      } catch (e) {
        buffer = null;
      }
      cache.set(url, buffer);
    }
  });
}

// Retrieves the airspaces for the given track.
export async function fetchAirspaces(track: protos.Track, altitude: protos.GroundAltitude): Promise<protos.Airspaces> {
  const cache = getAirspaceCache();
  const { indexesByTileUrl, pxInTiles } = getIndicesByUrlAndPx(track, 500);

  await populateTileCache(cache, [...indexesByTileUrl.keys()]);

  // Retrieve fix indexes for every airspaces.
  const gndAlt = altitude.altitudes;
  const indexesByAirspaceId = new Map<string, number[]>();
  const airspaceById = new Map<string, AirspaceTyped>();
  const maxAltitudeToCheck = Math.max(...track.alt) + MARGIN_METER;
  for (const [url, indexes] of indexesByTileUrl) {
    const buffer = cache.get(url);
    if (buffer == null) {
      continue;
    }
    const aspLayer = new VectorTile(new Uint8Array(buffer)).layers.asp;

    for (let i = 0; i < aspLayer.length; i++) {
      const feature = aspLayer.feature(i);
      const airspace = toTypedAirspace(feature.properties as AirspaceString);
      const airspaceId = getAirspaceFeatureId(airspace);
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
        if (isInFeature(pxInTiles[fixIdx], feature)) {
          if (!indexesByAirspaceId.has(airspaceId)) {
            indexesByAirspaceId.set(airspaceId, []);
            airspaceById.set(airspaceId, airspace);
          }
          indexesByAirspaceId.get(airspaceId).push(fixIdx);
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

  const proto = protos.Airspaces.create({ hasErrors: altitude.hasErrors });

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
    airspaceCache = lru<Buffer | null>(ASLP_LRU_CAPACITY);
  }
  return airspaceCache;
}
