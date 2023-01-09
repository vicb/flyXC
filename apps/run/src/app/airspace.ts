import { fetchResponse, Flags, getAspTileUrl, isInFeature, pixelCoordinates, Point, protos } from '@flyxc/common';
import async from 'async';
import { VectorTile } from 'mapbox-vector-tile';
import { LRU, lru } from 'tiny-lru';

// Zoom level for the airspaces tiles.
const ZOOM_LEVEL = 12;

// Look MARGIN_METER above max altitude.
const MARGIN_METER = 200;

// Average airspace tile size.
// The average size is ~250 bytes at level 12 (395MB	for 1649364 tiles).
// The maximum size is ~2.2KB.
const ASLP_LRU_CAPACITY = 10000;

// null is used when there is no tile at the given location.
let aspCache: LRU<ArrayBuffer | null> | null = null;

export function getIndicesByUrlAndPx(
  track: protos.Track,
  maxNumTiles = Number.MAX_SAFE_INTEGER,
): {
  indexesByTileUrl: Map<string, number[]>;
  pxInTiles: Array<Point>;
} {
  const indexesByTileUrl = new Map<string, number[]>();
  const pxInTiles: Array<Point> = [];

  for (let i = 0; i < track.lat.length; i++) {
    const lon = track.lon[i];
    const lat = track.lat[i];
    const { tile, px } = pixelCoordinates({ lat, lon }, ZOOM_LEVEL);
    pxInTiles.push(px);
    const url = getAspTileUrl(tile.x, tile.y, ZOOM_LEVEL);
    if (!indexesByTileUrl.has(url)) {
      indexesByTileUrl.set(url, []);
    }
    indexesByTileUrl.get(url)?.push(i);
    if (indexesByTileUrl.size >= maxNumTiles) {
      break;
    }
  }

  return { indexesByTileUrl, pxInTiles };
}

// Retrieves the airspaces for the given track.
export async function fetchAirspaces(track: protos.Track, altitude: protos.GroundAltitude): Promise<protos.Airspaces> {
  const cache = getAspCache();
  const { indexesByTileUrl, pxInTiles } = getIndicesByUrlAndPx(track, 500);

  // Downloading tiles might return 404 if there is not airspace.
  // We then can not rely on 404 to detect errors.
  await async.eachLimit(indexesByTileUrl.keys(), 5, async (url: string) => {
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

  // Retrieve fix indexes for every airspaces.
  const gndAlt = altitude.altitudes;
  const indexesByAirspaceKey = new Map<string, number[]>();
  const featureByKey = new Map<string, any>();
  const maxAltitude = Math.max(...track.alt) + MARGIN_METER;
  for (const [url, indexes] of indexesByTileUrl) {
    const buffer = cache.get(url);
    if (buffer == null) {
      continue;
    }
    const aspLayer = new VectorTile(new Uint8Array(buffer)).layers.asp;

    for (let i = 0; i < aspLayer.length; i++) {
      const feature = aspLayer.feature(i);
      const props = feature.properties;
      const key = getAspFeatureKey(feature);
      for (const fixIdx of indexes) {
        const flags = props.flags as number;
        const bottom = (props.bottom as number) + (flags & Flags.FloorRefGnd ? (gndAlt[fixIdx] as number) : 0);
        if (bottom > maxAltitude) {
          continue;
        }
        if (isInFeature(pxInTiles[fixIdx], feature)) {
          if (!indexesByAirspaceKey.has(key)) {
            indexesByAirspaceKey.set(key, []);
            featureByKey.set(key, feature);
          }
          indexesByAirspaceKey.get(key)?.push(fixIdx);
        }
      }
    }
  }

  // Compute index ranges.
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
      rangesByAirspaceKey.get(key)?.push([start, current]);
      start = next;
      current = next;
    }
    rangesByAirspaceKey.get(key)?.push([start, current]);
  }

  // Check if the tracks crosses the airspaces.
  const intoRangesByAirspaceKey = new Map<string, boolean[]>();
  for (const [key, ranges] of rangesByAirspaceKey) {
    const props = featureByKey.get(key).properties;
    const intoRanges: boolean[] = [];
    intoRangesByAirspaceKey.set(key, intoRanges);
    for (const [start, end] of ranges) {
      let into = false;
      for (let index = start; index <= end; index++) {
        const gndAlt = altitude.altitudes[index];
        const alt = track.alt[index];
        const top = props.top + (props.flags & Flags.TopRefGnd ? gndAlt : 0);
        const bottom = props.bottom + (props.flags & Flags.FloorRefGnd ? gndAlt : 0);
        if (alt >= bottom && alt <= top) {
          into = true;
          break;
        }
      }
      intoRanges.push(into);
    }
  }

  // Build the proto object
  const aspObjects: any[] = [];
  for (const [key, ranges] of rangesByAirspaceKey) {
    const props = featureByKey.get(key)?.properties;
    const intoRanges = intoRangesByAirspaceKey.get(key) as boolean[];
    ranges.forEach(([start, end], rangeIndex) => {
      aspObjects.push({
        startSec: track.timeSec[start],
        endSec: track.timeSec[end],
        name: props.name,
        category: props.category,
        top: props.top,
        bottom: props.bottom,
        flags: props.flags,
        into: intoRanges[rangeIndex],
      });
    });
  }

  aspObjects.sort((a, b) => (a.startSec < b.startSec ? -1 : 1));

  const pAsp = protos.Airspaces.create({ hasErrors: altitude.hasErrors });

  aspObjects.forEach((asp) => {
    pAsp.startSec.push(asp.startSec);
    pAsp.endSec.push(asp.endSec);
    pAsp.name.push(asp.name);
    pAsp.category.push(asp.category);
    pAsp.top.push(asp.top);
    pAsp.bottom.push(asp.bottom);
    pAsp.flags.push(asp.flags);
    pAsp.into.push(asp.into);
  });

  return pAsp;
}

// Returns a unique if for an airspace feature.
function getAspFeatureKey(feature: any): string {
  const p = feature.properties;
  return `${p.name}-${p.bottom}-${p.top}`;
}

// Returns a lazily instantiated LRU for airspace buffers.
function getAspCache(): LRU<ArrayBuffer | null> {
  if (aspCache == null) {
    console.log(`ASP LRU Capacity = ${ASLP_LRU_CAPACITY}`);
    aspCache = lru<Buffer | null>(ASLP_LRU_CAPACITY);
  }
  return aspCache;
}
