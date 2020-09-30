// Retrieves the altitude information for a track.
//
// Altitudes are retrieved from https://registry.opendata.aws/terrain-tiles/
//
// Docs:
// - https://github.com/tilezen/joerd/blob/master/docs/formats.md,
// - https://observablehq.com/@benjaminortizulloa/mapzen-dem,
// - https://www.mapzen.com/blog/terrain-tile-service/

import async from 'async';
import lru, { Lru } from 'tiny-lru';

import { decode } from '@vivaxy/png';

import { pixelCoordinates } from '../../../common/proj';
import { ProtoGroundAltitude, ProtoTrack } from '../../../common/track';
import { httpsGet } from './request';

// Zoom level for the altitude tiles.
const ZOOM_LEVEL = 10;

// Expected tile size in pixels.
const TILE_PX_SIZE = 256;

// Cache for RGBA pixels.
let rgbaCache: Lru<number[]> | null = null;

// Default size of the RGBA LRU in MB.
// Use the `RGBA_LRU_SIZE_MB` environment variable to override the capacity.
const DEFAULT_RGBA_LRU_SIZE_MB = 80;
const IMAGE_SIZE_MB = (TILE_PX_SIZE * TILE_PX_SIZE * 4) / (1000 * 1000);

// Returns the ground altitudes for the track.
export async function fetchGroundAltitude(track: ProtoTrack): Promise<ProtoGroundAltitude> {
  // Retrieve the list of urls to download.
  const urls = track.lat.reduce((files: Set<string>, lat: number, i: number) => {
    const lon = track.lon[i];
    const { tile } = pixelCoordinates({ lat, lon }, ZOOM_LEVEL);
    return files.add(getPngUrl(tile.x, tile.y, ZOOM_LEVEL));
  }, new Set<string>());

  // Download the tiles.
  let hasErrors = false;
  const rgbas = new Map<string, number[] | undefined>();
  await async.eachLimit(Array.from(urls), 5, async (url: string) => {
    let rgba = getRgbaCache().get(url);
    if (rgba == null) {
      try {
        const metadata = decode(await httpsGet(url));
        if (metadata.width == TILE_PX_SIZE && metadata.height == TILE_PX_SIZE) {
          rgba = metadata.data;
          getRgbaCache().set(url, rgba);
        }
      } catch (e) {
        console.error(`Error downloading ${url}`);
        hasErrors = true;
      }
    }
    rgbas.set(url, rgba);
  });

  // Retrieve the fixes altitude.
  const altitudes = track.lat.map((lat: number, i: number) => {
    const lon = track.lon[i];
    const { tile, px } = pixelCoordinates({ lat, lon }, ZOOM_LEVEL);
    const url = getPngUrl(tile.x, tile.y, ZOOM_LEVEL);
    const rgba = rgbas.get(url);
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
    has_errors: hasErrors,
  };
}

// Returns the url of a terrarium png image on the amazon public dataset.
function getPngUrl(x: number, y: number, zoom: number): string {
  return `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${zoom}/${x}/${y}.png`;
}

// Returns a lazily instantiated LRU for RGBA pixels.
// Use the `RGBA_LRU_SIZE_MB` environment variable to override the capacity.
function getRgbaCache(): Lru<number[]> {
  if (rgbaCache == null) {
    const mb = Number(process.env.RGBA_LRU_SIZE_MB || DEFAULT_RGBA_LRU_SIZE_MB);
    const capacity = Math.floor(mb / IMAGE_SIZE_MB);
    console.log(`RGBA LRU Capacity = ${capacity} - ${Math.round(capacity * IMAGE_SIZE_MB)}MB`);
    rgbaCache = lru<number[]>(capacity);
  }
  return rgbaCache;
}
