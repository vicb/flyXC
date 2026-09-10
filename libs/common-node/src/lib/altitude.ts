// Retrieves altitude information from AWS Terrarium DEM tiles.
//
// Docs:
// - https://registry.opendata.aws/terrain-tiles/
// - https://github.com/tilezen/joerd/blob/master/docs/formats.md
// - https://observablehq.com/@benjaminortizulloa/mapzen-dem
// - https://www.mapzen.com/blog/terrain-tile-service/

import lodepng from '@cwasm/lodepng';
import { fetchResponse, NO_GROUND_ALTITUDE, parallelTasksWithTimeout } from '@flyxc/common';
import type { LRU } from 'tiny-lru';
import { lru } from 'tiny-lru';

// Expected tile size in pixels.
export const TILE_SIZE_PX = 256;

// Tile memory size in bytes (256 * 256 * 4 = 262,144 bytes).
export const BYTES_PER_TILE = TILE_SIZE_PX * TILE_SIZE_PX * 4;

// Default concurrency for tile downloads.
export const DOWNLOAD_CONCURRENCY_DEFAULT = 5;

// Default timeout in seconds for tile downloads.
export const TIMEOUT_SEC_DEFAULT = 10;

const DEG_TO_RAD = Math.PI / 180;

/**
 * Precomputed Mercator projection constants for a specific zoom level.
 */
export interface ZoomConstants {
  /** Zoom level for the projection. */
  zoom: number;
  /** Full world width and height in pixels at this zoom level (`TILE_SIZE_PX * 2^zoom`). */
  worldSize: number;
  /** Half of the world size in pixels (`worldSize / 2`), representing the projection origin. */
  origin: number;
  /** Pixels per degree of longitude (`worldSize / 360`). */
  pixelsPerLonDeg: number;
  /** Pixels per radian of latitude (`worldSize / (2 * PI)`). */
  pixelsPerRad: number;
}

/**
 * Computes Mercator projection constants for a specific zoom level.
 *
 * @param zoom - Zoom level.
 * @returns Projection constants for fast projection.
 */
export function createZoomConstants(zoom: number): ZoomConstants {
  const worldSize = TILE_SIZE_PX * 2 ** zoom;
  return {
    zoom,
    worldSize,
    origin: worldSize / 2,
    pixelsPerLonDeg: worldSize / 360,
    pixelsPerRad: worldSize / (2 * Math.PI),
  };
}

/**
 * Generic coordinate sequence with latitude and longitude arrays.
 */
export interface TrackCoordinates {
  lat: ArrayLike<number>;
  lon: ArrayLike<number>;
}

/**
 * Result of an altitude query.
 */
export interface AltitudeResult {
  altitudes: number[];
  hasErrors: boolean;
}

/**
 * Configuration options for ElevationService.
 * Callers must explicitly provide zoom and either cacheSizeMb or cacheCapacity.
 */
export type ElevationOptions = {
  /** Zoom level for altitude tiles. */
  zoom: number;
  /** Default concurrency for tile downloads (defaults to DOWNLOAD_CONCURRENCY_DEFAULT). */
  concurrency?: number;
  /** Timeout in seconds for tile downloads (defaults to TIMEOUT_SEC_DEFAULT). */
  timeoutSec?: number;
} & (
  | {
      /** Size of the in-memory tile cache in megabytes. */
      cacheSizeMb: number;
      cacheCapacity?: never;
    }
  | {
      /** Maximum number of tiles to store in cache. */
      cacheCapacity: number;
      cacheSizeMb?: never;
    }
);

/**
 * Cache metrics for ElevationService LRU cache.
 */
export interface ElevationCacheStats {
  /** Current number of tiles in the cache. */
  size: number;
  /** Maximum number of tiles the cache can hold. */
  max: number;
  /** Estimated memory size of cached tiles in MB. */
  sizeMb: number;
  /** Maximum memory capacity in MB. */
  maxMb: number;
}

/**
 * Service for downloading, caching, and sampling elevations from AWS Terrarium DEM tiles.
 */
export class ElevationService {
  private readonly cache: LRU<Uint8ClampedArray>;
  private readonly inFlightDownloads = new Map<string, Promise<Uint8ClampedArray | null>>();
  private readonly concurrency: number;
  private readonly timeoutSec: number;
  private readonly zoomConstants: ZoomConstants;

  /**
   * Initializes a new ElevationService instance.
   * Callers must provide zoom and either cacheSizeMb or cacheCapacity.
   *
   * @param options - Configuration options specifying zoom, cache size/capacity, and optional concurrency/timeoutSec.
   */
  constructor(options: ElevationOptions) {
    let capacity: number;
    if (options.cacheCapacity != null) {
      capacity = options.cacheCapacity;
    } else if (options.cacheSizeMb != null) {
      capacity = Math.round((options.cacheSizeMb * 1000 * 1000) / BYTES_PER_TILE);
    } else {
      throw new Error('Either cacheCapacity or cacheSizeMb must be provided');
    }
    this.cache = lru<Uint8ClampedArray>(capacity);
    this.concurrency = options.concurrency ?? DOWNLOAD_CONCURRENCY_DEFAULT;
    this.timeoutSec = options.timeoutSec ?? TIMEOUT_SEC_DEFAULT;
    this.zoomConstants = createZoomConstants(options.zoom);
  }

  /**
   * Returns the underlying LRU cache instance.
   *
   * NOTE: This is intended only for tests (e.g., inspecting cache capacity,
   * verifying instance isolation, or injecting mock tile buffers without network calls).
   *
   * @returns The LRU cache instance holding decoded RGBA pixel buffers.
   */
  getCache(): LRU<Uint8ClampedArray> {
    return this.cache;
  }

  /**
   * Returns current LRU cache statistics (entries count and memory size in MB).
   *
   * @returns Cache statistics including current and maximum entries and MB.
   */
  getCacheStats(): ElevationCacheStats {
    const size = this.cache.size;
    const max = this.cache.max;
    const sizeMb = Math.round((size * BYTES_PER_TILE) / 1e6);
    const maxMb = Math.round((max * BYTES_PER_TILE) / 1e6);
    return { size, max, sizeMb, maxMb };
  }

  /**
   * Fast Web Mercator projection without heap allocations.
   * Writes output into provided array or typed array: [tileX, tileY, pxX, pxY].
   *
   * NOTE: Primarily used internally and exposed for unit tests.
   *
   * @param lat - Latitude in degrees.
   * @param lon - Longitude in degrees.
   * @param out - Array or typed array written in-place with `[tileX, tileY, pxX, pxY]`.
   * @param constants - Zoom projection constants (defaults to the service's computed constants).
   */
  projectLatLonFast(
    lat: number,
    lon: number,
    out: [number, number, number, number],
    constants = this.zoomConstants,
  ): void {
    projectLatLonFast(lat, lon, out, constants);
  }

  /**
   * Downloads a single tile from AWS S3, decodes PNG via @cwasm/lodepng, and caches the RGBA buffer.
   * In-flight requests are deduplicated.
   *
   * @param url - The tile URL to download.
   * @returns Object containing the decoded RGBA buffer (or null on failure) and error flag.
   */
  private async fetchTile(url: string): Promise<{ rgba: Uint8ClampedArray | null; hasError: boolean }> {
    const cached = this.cache.get(url);
    if (cached !== undefined) {
      return { rgba: cached, hasError: cached == null };
    }

    const existingDownload = this.inFlightDownloads.get(url);
    if (existingDownload) {
      const rgba = await existingDownload;
      return { rgba, hasError: rgba == null };
    }

    const downloadPromise = (async () => {
      let rgba: Uint8ClampedArray | null = null;
      try {
        const response = await fetchResponse(url, {
          retry: 3,
          timeoutS: 5,
          retryOnTimeout: true,
        });
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          const img = lodepng.decode(Buffer.from(buffer));
          if (img.width === TILE_SIZE_PX && img.height === TILE_SIZE_PX) {
            rgba = img.data;
          }
        }
      } catch {
        // Error fetching or decoding tile.
      }
      if (rgba != null) {
        this.cache.set(url, rgba);
      }
      return rgba;
    })();

    this.inFlightDownloads.set(url, downloadPromise);
    try {
      const rgba = await downloadPromise;
      return { rgba, hasError: rgba == null };
    } finally {
      this.inFlightDownloads.delete(url);
    }
  }

  /**
   * Retrieves ground altitudes for parallel latitude and longitude coordinates.
   * High performance, zero allocations in the hot path.
   *
   * @param lat - Array-like collection of latitudes in degrees.
   * @param lon - Array-like collection of longitudes in degrees.
   * @param concurrency - Maximum number of simultaneous tile downloads.
   * @param timeoutSec - Timeout in seconds for tile downloads (defaults to service's timeoutSec).
   * @returns Object containing the altitude array (in meters) and whether any errors occurred.
   */
  async fetchCoordinatesAltitude(
    lat: ArrayLike<number>,
    lon: ArrayLike<number>,
    concurrency = this.concurrency,
    timeoutSec = this.timeoutSec,
  ): Promise<AltitudeResult> {
    const len = Math.min(lat.length, lon.length);
    if (len === 0) {
      return { altitudes: [], hasErrors: false };
    }

    const urls = getElevationUrlList(lat, lon, this.zoomConstants, 50);

    // Find uncached tiles that need downloading.
    const urlsToFetch: string[] = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (this.cache.get(url) === undefined) {
        urlsToFetch.push(url);
      }
    }

    let hasErrors = false;

    // Fetch uncached tiles in parallel with optional timeout.
    if (urlsToFetch.length > 0) {
      const timeoutMs = timeoutSec != null && timeoutSec > 0 ? timeoutSec * 1000 : 0;
      const { isTimeout } = await parallelTasksWithTimeout(
        concurrency,
        urlsToFetch,
        async (url) => {
          const result = await this.fetchTile(url);
          if (result.hasError) {
            hasErrors = true;
          }
        },
        timeoutMs,
      );
      if (isTimeout) {
        hasErrors = true;
      }
    }

    // Pre-allocate altitudes array to avoid resizing.
    const altitudes = new Array<number>(len);
    const coords: [number, number, number, number] = [0, 0, 0, 0];

    let lastTileX = -1;
    let lastTileY = -1;
    let lastRgba: Uint8ClampedArray | null = null;

    for (let i = 0; i < len; i++) {
      this.projectLatLonFast(lat[i], lon[i], coords);
      const tileX = coords[0];
      const tileY = coords[1];

      let rgba: Uint8ClampedArray | null;
      if (tileX === lastTileX && tileY === lastTileY) {
        rgba = lastRgba;
      } else {
        lastTileX = tileX;
        lastTileY = tileY;
        const url = getElevationTileUrl(tileX, tileY, this.zoomConstants.zoom);
        rgba = this.cache.get(url) ?? null;
        lastRgba = rgba;
      }

      if (rgba != null) {
        altitudes[i] = getAltitudeFromRgba(rgba, coords[2], coords[3]);
      } else {
        altitudes[i] = NO_GROUND_ALTITUDE;
        hasErrors = true;
      }
    }

    return {
      altitudes,
      hasErrors,
    };
  }

  /**
   * Retrieves ground altitudes for an array of { lat, lon } point objects.
   *
   * @param points - Array of `{ lat, lon }` coordinate objects.
   * @param concurrency - Maximum number of simultaneous tile downloads.
   * @param timeoutSec - Timeout in seconds for tile downloads (defaults to service's timeoutSec).
   * @returns Object containing the altitude array (in meters) and whether any errors occurred.
   */
  async fetchPointsAltitude(
    points: Array<{ lat: number; lon: number }>,
    concurrency = this.concurrency,
    timeoutSec = this.timeoutSec,
  ): Promise<AltitudeResult> {
    const len = points.length;
    if (len === 0) {
      return { altitudes: [], hasErrors: false };
    }
    const lats = new Float64Array(len);
    const lons = new Float64Array(len);
    for (let i = 0; i < len; i++) {
      lats[i] = points[i].lat;
      lons[i] = points[i].lon;
    }
    return this.fetchCoordinatesAltitude(lats, lons, concurrency, timeoutSec);
  }

  /**
   * Returns ground altitudes for a track object or coordinate series.
   *
   * @param track - Object containing latitude and longitude arrays.
   * @param concurrency - Maximum number of simultaneous tile downloads.
   * @param timeoutSec - Timeout in seconds for tile downloads (defaults to service's timeoutSec).
   * @returns Object containing altitudes array (in meters) and error flag.
   */
  async fetchGroundAltitude(
    track: TrackCoordinates,
    concurrency = this.concurrency,
    timeoutSec = this.timeoutSec,
  ): Promise<AltitudeResult> {
    return this.fetchCoordinatesAltitude(track.lat, track.lon, concurrency, timeoutSec);
  }

  /**
   * Extracts tile URLs from a track object or coordinate series using this service's zoom level.
   *
   * NOTE: Only used for tests.
   *
   * @param track - Object containing latitude and longitude arrays.
   * @param maxNumUrls - Maximum number of URLs to return.
   * @returns Array of unique tile URLs required for the track fixes.
   */
  getUrlList(track: TrackCoordinates, maxNumUrls: number): string[] {
    return getElevationUrlList(track.lat, track.lon, this.zoomConstants, maxNumUrls);
  }
}

/**
 * Returns the URL of a Terrarium PNG image from the AWS Open Data dataset.
 *
 * NOTE: Primarily used in tests (e.g., verifying URL formatting and priming mock tiles in cache)
 * and internally when fetching tiles.
 *
 * @param x - Tile X coordinate in Web Mercator projection.
 * @param y - Tile Y coordinate in Web Mercator projection.
 * @param zoom - Zoom level of the tile.
 * @returns Absolute URL to the Terrarium tile PNG on AWS S3.
 */
export function getElevationTileUrl(x: number, y: number, zoom: number): string {
  return `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${zoom}/${x}/${y}.png`;
}

/**
 * Fast Web Mercator projection without heap allocations.
 * Writes output into provided array or typed array: [tileX, tileY, pxX, pxY].
 *
 * NOTE: Primarily used internally and exported for unit tests.
 *
 * @param lat - Latitude in degrees.
 * @param lon - Longitude in degrees.
 * @param out - Array or typed array written in-place with `[tileX, tileY, pxX, pxY]`.
 * @param constants - Precomputed zoom projection constants.
 */
export function projectLatLonFast(
  lat: number,
  lon: number,
  out: [number, number, number, number],
  constants: ZoomConstants,
): void {
  let x = Math.round(constants.origin + lon * constants.pixelsPerLonDeg);
  const sin = Math.sin(lat * DEG_TO_RAD);
  const f = sin < -0.9999 ? -0.9999 : sin > 0.9999 ? 0.9999 : sin;
  let y = Math.round(constants.origin + 0.5 * Math.log((1 + f) / (1 - f)) * -constants.pixelsPerRad);
  const maxCoord = constants.worldSize - 1;
  if (x < 0) {
    x = 0;
  } else if (x > maxCoord) {
    x = maxCoord;
  }
  if (y < 0) {
    y = 0;
  } else if (y > maxCoord) {
    y = maxCoord;
  }

  out[0] = Math.floor(x / TILE_SIZE_PX);
  out[1] = Math.floor(y / TILE_SIZE_PX);
  out[2] = x % TILE_SIZE_PX;
  out[3] = y % TILE_SIZE_PX;
}

/**
 * Extracts unique Terrarium tile URLs needed for the given latitude and longitude series.
 * Optimized with spatial locality to skip duplicate string/Set operations for consecutive fixes.
 *
 * NOTE: Primarily used internally and exported for unit tests.
 *
 * @param lat - Array-like collection of latitudes in degrees.
 * @param lon - Array-like collection of longitudes in degrees.
 * @param constants - Zoom projection constants including the zoom level.
 * @param maxNumUrls - Maximum number of URLs to return.
 * @returns Array of unique tile URLs required to cover the coordinates.
 */
export function getElevationUrlList(
  lat: ArrayLike<number>,
  lon: ArrayLike<number>,
  constants: ZoomConstants,
  maxNumUrls: number,
): string[] {
  const urls = new Set<string>();
  const len = Math.min(lat.length, lon.length);
  const coords: [number, number, number, number] = [0, 0, 0, 0];
  let lastTileX = -1;
  let lastTileY = -1;

  for (let i = 0; i < len; i++) {
    projectLatLonFast(lat[i], lon[i], coords, constants);
    const tileX = coords[0];
    const tileY = coords[1];
    if (tileX !== lastTileX || tileY !== lastTileY) {
      lastTileX = tileX;
      lastTileY = tileY;
      urls.add(getElevationTileUrl(tileX, tileY, constants.zoom));
      if (urls.size >= maxNumUrls) {
        break;
      }
    }
  }

  return Array.from(urls);
}

/**
 * Extracts tile URLs from a track object or coordinate series.
 *
 * NOTE: Only used for tests (e.g. testing URL generation on track fixtures).
 *
 * @param track - Object containing latitude and longitude arrays.
 * @param constants - Zoom projection constants including the zoom level.
 * @param maxNumUrls - Maximum number of URLs to return.
 * @returns Array of unique tile URLs required for the track fixes.
 */
export function getUrlList(track: TrackCoordinates, constants: ZoomConstants, maxNumUrls: number): string[] {
  return getElevationUrlList(track.lat, track.lon, constants, maxNumUrls);
}

/**
 * Samples elevation in meters from decoded Terrarium RGBA buffer at in-tile pixel coordinates.
 *
 * NOTE: Primarily used in tests to verify elevation decoding formulas on isolated RGBA buffers
 * and internally by the service.
 *
 * @param rgba - Decoded 256x256 RGBA pixel buffer (Uint8ClampedArray).
 * @param pxX - Pixel X offset within the tile (0–255).
 * @param pxY - Pixel Y offset within the tile (0–255).
 * @returns Elevation in meters rounded to the nearest integer.
 */
export function getAltitudeFromRgba(rgba: Uint8ClampedArray, pxX: number, pxY: number): number {
  const offset = ((pxY << 8) | pxX) << 2;
  const red = rgba[offset];
  const green = rgba[offset + 1];
  const blue = rgba[offset + 2];
  return (red << 8) + green + (blue >> 7) - 32768;
}
