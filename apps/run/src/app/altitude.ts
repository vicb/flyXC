// Retrieves the altitude information for a track.
//
// Altitudes are retrieved from https://registry.opendata.aws/terrain-tiles/
//
// Docs:
// - https://github.com/tilezen/joerd/blob/master/docs/formats.md,
// - https://observablehq.com/@benjaminortizulloa/mapzen-dem,
// - https://www.mapzen.com/blog/terrain-tile-service/

import { fetchResponse, pixelCoordinates, protos } from '@flyxc/common';
import async from 'async';
import lodepng from 'lodepng';
import { LRU, lru } from 'tiny-lru';

// Zoom level for the altitude tiles.
const ZOOM_LEVEL = 10;

// Expected tile size in pixels.
const TILE_PX_SIZE = 256;

// Cache for RGBA pixels.
let rgbaCache: LRU<Uint8ClampedArray> | null = null;

// Default size of the RGBA LRU in MB.
const RGBA_LRU_SIZE_MB = 160;
const RGBA_SIZE_B = TILE_PX_SIZE * TILE_PX_SIZE * 4;
const RGBA_LRU_CAPACITY = Math.round((RGBA_LRU_SIZE_MB * 1000 * 1000) / RGBA_SIZE_B);

export function getUrlList(track: protos.Track, maxNumUrls = Number.MAX_SAFE_INTEGER): string[] {
  const urls = new Set<string>();
  for (let i = 0; i < track.lat.length; i++) {
    const lon = track.lon[i];
    const lat = track.lat[i];
    const { tile } = pixelCoordinates({ lat, lon }, ZOOM_LEVEL, TILE_PX_SIZE);
    urls.add(getPngUrl(tile.x, tile.y, ZOOM_LEVEL));
    if (urls.size >= maxNumUrls) {
      break;
    }
  }
  return Array.from(urls);
}

// Returns the ground altitudes for the track.
export async function fetchGroundAltitude(track: protos.Track): Promise<protos.GroundAltitude> {
  // Retrieve the list of urls to download.
  const cache = getRgbaCache();
  const urls = getUrlList(track, 150);

  // Download the tiles.
  let hasErrors = false;
  await async.eachLimit(Array.from(urls), 5, async (url: string) => {
    let rgba = cache.get(url);
    if (rgba === undefined) {
      rgba = null;
      try {
        const response = await fetchResponse(url, {
          retry: 3,
          timeoutS: 5,
          retryOnTimeout: true,
        });
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          const img = await lodepng.decode(Buffer.from(buffer));
          if (img.width == TILE_PX_SIZE && img.height == TILE_PX_SIZE) {
            rgba = img.data;
          }
        } else {
          hasErrors = true;
        }
      } catch (e) {
        console.error(`Error downloading ${url}`);
        hasErrors = true;
      }
      cache.set(url, rgba);
    }
  });

  // Retrieve the fixes altitude.
  const altitudes = track.lat.map((lat: number, i: number) => {
    const lon = track.lon[i];
    const { tile, px } = pixelCoordinates({ lat, lon }, ZOOM_LEVEL, TILE_PX_SIZE);
    const url = getPngUrl(tile.x, tile.y, ZOOM_LEVEL);
    const rgba = cache.get(url);
    let gndAlt = 0;
    if (rgba != null) {
      const offset = 4 * (256 * px.y + px.x);
      const red = rgba[offset];
      const green = rgba[offset + 1];
      const blue = rgba[offset + 2];
      gndAlt = Math.round(red * 256 + green + blue / 256 - 32768);
    }
    return gndAlt;
  });

  return {
    altitudes,
    hasErrors,
  };
}

// Returns the url of a terrarium png image on the amazon public dataset.
function getPngUrl(x: number, y: number, zoom: number): string {
  return `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${zoom}/${x}/${y}.png`;
}

// Returns a lazily instantiated LRU for RGBA pixels.
function getRgbaCache(): LRU<Uint8ClampedArray> {
  if (rgbaCache == null) {
    console.log(`RGBA LRU Capacity = ${RGBA_LRU_CAPACITY} - ${RGBA_LRU_SIZE_MB}MB`);
    rgbaCache = lru<Uint8ClampedArray>(RGBA_LRU_CAPACITY);
  }
  return rgbaCache;
}
