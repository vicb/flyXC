import async from 'async';
import Protobuf from 'pbf';
import lru, { Lru } from 'tiny-lru';

import { VectorTile } from '@mapbox/vector-tile';

import { Flags, getAspTileUrl, isInFeature } from '../../../common/airspaces';
import { tileCoordinates } from '../../../common/proj';
import { Point, ProtoAirspaces, ProtoGroundAltitude, ProtoTrack } from '../../../common/track';
import { httpsGet } from './request';

// Zoom level for the airspaces tiles.
const ZOOM_LEVEL = 12;

// Look MARGIN_METER above max altitude.
const MARGIN_METER = 200;

// Average airspace tile size.
// The average size is ~250 bytes at level 12 (395MB	for 1649364 tiles).
// The maximum size is ~2.2KB.
const DEFAULT_ASP_LRU_SIZE_MB = 80;
const ASP_SIZE_MB = 1000 / (1000 * 1000);

// null is used when there is no tile at the given location.
let aspCache: Lru<Buffer | null> | null = null;

// Retrieves the airspaces for the given track.
export async function fetchAirspaces(track: ProtoTrack, altitude: ProtoGroundAltitude): Promise<ProtoAirspaces> {
  // Retrieve the list of urls to download.
  const indexesByTileUrl = new Map<string, number[]>();
  const tilePixels: Array<Point> = [];

  track.lat.forEach((lat: number, i: number) => {
    const lon = track.lon[i];
    const { tile, px } = tileCoordinates({ lat, lon }, ZOOM_LEVEL);
    tilePixels.push(px);
    const url = getAspTileUrl(tile.x, tile.y, ZOOM_LEVEL);
    if (!indexesByTileUrl.has(url)) {
      indexesByTileUrl.set(url, []);
    }
    indexesByTileUrl.get(url)?.push(i);
  });

  // Download the tiles.
  const bufferByTileUrl = new Map<string, Buffer | null>();
  await async.eachLimit(indexesByTileUrl.keys(), 5, async (url: string) => {
    let buffer = getAspCache().get(url);
    if (buffer === undefined) {
      try {
        buffer = await httpsGet(url);
      } catch (e) {
        // Downloading tiles might return 404 if there is not airspace.
        // We then can not rely on 404 to detect errors.
        buffer = null;
      }
    }
    getAspCache().set(url, buffer);
    bufferByTileUrl.set(url, buffer);
  });

  // Retrieve fix indexes for every airspaces.
  const gndAlt = altitude.altitudes;
  const indexesByAirspaceKey = new Map<string, number[]>();
  const airspaceKeys = new Map<string, any>();
  const maxAltitude = Math.max(...track.alt) + MARGIN_METER;
  for (const [url, indexes] of indexesByTileUrl) {
    const buffer = bufferByTileUrl.get(url);
    if (buffer == null) {
      continue;
    }
    const aspLayer = new VectorTile(new Protobuf(buffer)).layers.asp;

    for (let i = 0; i < aspLayer.length; i++) {
      const feature = aspLayer.feature(i);
      const props = feature.properties;
      const key = getAspFeatureKey(feature);
      for (const fixIdx of indexes) {
        const bottom = props.flags & Flags.BOTTOM_REF_GND ? gndAlt[fixIdx] + props.bottom : props.bottom;
        if (bottom > maxAltitude) {
          continue;
        }
        if (isInFeature(tilePixels[fixIdx], feature)) {
          if (!indexesByAirspaceKey.has(key)) {
            indexesByAirspaceKey.set(key, []);
            airspaceKeys.set(key, feature);
          }
          indexesByAirspaceKey.get(key)?.push(fixIdx);
        }
      }
    }
  }

  // Compute timestamp ranges.
  const rangesByAirspaceKey = new Map<string, Array<[number, number]>>();
  for (const [key, indexes] of indexesByAirspaceKey) {
    indexes.sort((a, b) => (a < b ? -1 : 1));
    let start = indexes[0];
    let current = indexes[0];
    rangesByAirspaceKey.set(key, []);
    for (let i = 1; i < indexes.length; i++) {
      const next = indexes[i];
      if (next == current + 1) {
        current = next;
        continue;
      }
      rangesByAirspaceKey.get(key)?.push([track.ts[start], track.ts[current]]);
      start = next;
      current = next;
    }
    rangesByAirspaceKey.get(key)?.push([track.ts[start], track.ts[current]]);
  }

  // Build the proto object
  const aspObjects: any[] = [];
  for (const [key, ranges] of rangesByAirspaceKey) {
    const props = airspaceKeys.get(key)?.properties;
    ranges.forEach(([start, end]) => {
      aspObjects.push({
        start,
        end,
        name: props.name,
        category: props.category,
        top: props.top,
        bottom: props.bottom,
        flags: props.flags,
      });
    });
  }

  aspObjects.sort((a, b) => (a.start < b.start ? -1 : 1));

  const protoAirspaces: ProtoAirspaces = {
    start_ts: [],
    end_ts: [],
    name: [],
    category: [],
    top: [],
    bottom: [],
    flags: [],
    has_errors: altitude.has_errors,
  };

  aspObjects.forEach((asp) => {
    protoAirspaces.start_ts.push(asp.start);
    protoAirspaces.end_ts.push(asp.end);
    protoAirspaces.name.push(asp.name);
    protoAirspaces.category.push(asp.category);
    protoAirspaces.top.push(asp.top);
    protoAirspaces.bottom.push(asp.bottom);
    protoAirspaces.flags.push(asp.flags);
  });

  return protoAirspaces;
}

// Returns a unique if for an airspace feature.
function getAspFeatureKey(feature: any): string {
  const p = feature.properties;
  return p.name + '-' + p.bottom + '-' + p.top;
}

// Returns a lazily instantiated LRU for airspace buffers.
// Use the `ASP_LRU_SIZE_MB` environment variable to override the capacity.
function getAspCache(): Lru<Buffer | null> {
  if (aspCache == null) {
    const mb = Number(process.env.ASP_LRU_SIZE_MB || DEFAULT_ASP_LRU_SIZE_MB);
    const capacity = Math.floor(mb / ASP_SIZE_MB);
    console.log(`ASP LRU Capacity = ${capacity} - ${Math.round(capacity * ASP_SIZE_MB)}MB`);
    aspCache = lru<Buffer | null>(capacity);
  }
  return aspCache;
}
