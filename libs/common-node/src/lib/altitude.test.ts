import * as common from '@flyxc/common';
import { getPixelCoordinates } from '@flyxc/common';
import { vi } from 'vitest';

import {
  createZoomConstants,
  ElevationService,
  getAltitudeFromRgba,
  getElevationTileUrl,
  getElevationUrlList,
  getUrlList,
  projectLatLonFast,
  TILE_SIZE_PX,
  TIMEOUT_SEC_DEFAULT,
} from './altitude';

describe('Altitude in common-node', () => {
  let elevationService: ElevationService;

  beforeEach(() => {
    elevationService = new ElevationService({ cacheCapacity: 100, zoom: 10 });
  });

  describe('Fast Web Mercator Projection', () => {
    it('matches getPixelCoordinates for various points at zoom 10', () => {
      const testCoordinates = [
        { lat: 0, lon: 0 },
        { lat: 45.8326, lon: 6.8652 }, // Mont Blanc
        { lat: 45.811, lon: 6.248 }, // Annecy
        { lat: -33.8688, lon: 151.2093 }, // Sydney
        { lat: 37.7749, lon: -122.4194 }, // San Francisco
        { lat: -22.9068, lon: -43.1729 }, // Rio de Janeiro
        { lat: 64.1466, lon: -21.9426 }, // Reykjavik
      ];

      const out: [number, number, number, number] = [0, 0, 0, 0];

      for (const { lat, lon } of testCoordinates) {
        elevationService.projectLatLonFast(lat, lon, out);
        const expected = getPixelCoordinates({ lat, lon }, 10, TILE_SIZE_PX);

        expect(out[0]).toBe(expected.tile.x);
        expect(out[1]).toBe(expected.tile.y);
        expect(out[2]).toBe(expected.px.x);
        expect(out[3]).toBe(expected.px.y);
      }
    });

    it('matches getPixelCoordinates across various zoom levels (0 to 15)', () => {
      const testCoordinates = [
        { lat: 0, lon: 0 },
        { lat: 45.8326, lon: 6.8652 },
        { lat: -33.8688, lon: 151.2093 },
        { lat: 37.7749, lon: -122.4194 },
      ];

      const out: [number, number, number, number] = [0, 0, 0, 0];
      const testZooms = [0, 1, 3, 5, 8, 10, 12, 15];

      for (const zoom of testZooms) {
        const zoomService = new ElevationService({ cacheCapacity: 10, zoom });
        const constants = createZoomConstants(zoom);

        for (const { lat, lon } of testCoordinates) {
          // Test on ElevationService instance initialized with this zoom
          zoomService.projectLatLonFast(lat, lon, out);
          const expected = getPixelCoordinates({ lat, lon }, zoom, TILE_SIZE_PX);

          expect(out[0]).toBe(expected.tile.x);
          expect(out[1]).toBe(expected.tile.y);
          expect(out[2]).toBe(expected.px.x);
          expect(out[3]).toBe(expected.px.y);

          // Test standalone function passing computed constants
          projectLatLonFast(lat, lon, out, constants);
          expect(out[0]).toBe(expected.tile.x);
          expect(out[1]).toBe(expected.tile.y);
          expect(out[2]).toBe(expected.px.x);
          expect(out[3]).toBe(expected.px.y);
        }
      }
    });

    it('clamps boundary coordinates to valid world tile and pixel ranges', () => {
      const out: [number, number, number, number] = [0, 0, 0, 0];
      const constants = createZoomConstants(10);
      const maxTile = 2 ** 10 - 1; // 1023

      // Extreme longitudes
      projectLatLonFast(0, 180, out, constants);
      expect(out[0]).toBe(maxTile);
      expect(out[2]).toBe(TILE_SIZE_PX - 1);

      projectLatLonFast(0, -180, out, constants);
      expect(out[0]).toBe(0);
      expect(out[2]).toBe(0);

      // Extreme latitudes beyond Mercator limits
      projectLatLonFast(90, 0, out, constants);
      expect(out[1]).toBe(0);
      expect(out[3]).toBe(0);

      projectLatLonFast(-90, 0, out, constants);
      expect(out[1]).toBe(maxTile);
      expect(out[3]).toBe(TILE_SIZE_PX - 1);
    });
  });

  describe('Elevation decoding from RGBA', () => {
    it('computes correct altitude from RGBA channels', () => {
      // 0m elevation: (128 * 256 + 0 + 0 / 256) - 32768 = 0
      const rgbaZero = new Uint8ClampedArray(4);
      rgbaZero[0] = 128;
      rgbaZero[1] = 0;
      rgbaZero[2] = 0;
      rgbaZero[3] = 255;
      expect(getAltitudeFromRgba(rgbaZero, 0, 0)).toBe(0);

      // Mont Blanc peak: 4757m
      // 4757 + 32768 = 37525 -> 37525 / 256 = 146.582...
      // Red: 146 (146 * 256 = 37376)
      // Remainder: 37525 - 37376 = 149 (Green: 149)
      // Blue: 0
      const rgbaMontBlanc = new Uint8ClampedArray(4);
      rgbaMontBlanc[0] = 146;
      rgbaMontBlanc[1] = 149;
      rgbaMontBlanc[2] = 0;
      rgbaMontBlanc[3] = 255;
      expect(getAltitudeFromRgba(rgbaMontBlanc, 0, 0)).toBe(4757);

      // Negative elevation: -430m (Dead Sea)
      // -430 + 32768 = 32338
      // Red: 126 (126 * 256 = 32256)
      // Green: 82
      const rgbaDeadSea = new Uint8ClampedArray(4);
      rgbaDeadSea[0] = 126;
      rgbaDeadSea[1] = 82;
      rgbaDeadSea[2] = 0;
      rgbaDeadSea[3] = 255;
      expect(getAltitudeFromRgba(rgbaDeadSea, 0, 0)).toBe(-430);
    });
  });

  describe('Tile URL generation and list extraction', () => {
    it('formats correct S3 Terrarium URL', () => {
      expect(getElevationTileUrl(531, 364, 10)).toBe(
        'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/10/531/364.png',
      );
    });

    it('extracts unique tile URLs and respects maxNumUrls', () => {
      const constants = createZoomConstants(10);
      expect(constants.zoom).toBe(10);

      // Points in same tile
      const lats = [45.83, 45.84, 45.835];
      const lons = [6.86, 6.87, 6.865];
      const urls = getElevationUrlList(lats, lons, constants, 10);
      expect(urls).toHaveLength(1);
      expect(urls[0]).toBe('https://elevation-tiles-prod.s3.amazonaws.com/terrarium/10/531/364.png');

      // Multiple tiles with upper bound
      const multiLats = [45.0, 46.0, 47.0, 48.0, 49.0];
      const multiLons = [6.0, 7.0, 8.0, 9.0, 10.0];
      expect(getElevationUrlList(multiLats, multiLons, constants, 2)).toHaveLength(2);

      // Using getUrlList with track coordinates
      expect(getUrlList({ lat: multiLats, lon: multiLons }, constants, 2)).toHaveLength(2);

      // Using elevationService.getUrlList
      expect(elevationService.getUrlList({ lat: multiLats, lon: multiLons }, 2)).toHaveLength(2);
    });
  });

  describe('Altitude retrieval with cache', () => {
    it('retrieves elevations from cached RGBA buffer with zero errors', async () => {
      const cache = elevationService.getCache();

      // Create a dummy 256x256 tile buffer
      const dummyTile = new Uint8ClampedArray(256 * 256 * 4);
      // Fill all pixels with 1000m: 1000 + 32768 = 33768. R: 131, G: 232, B: 0
      for (let i = 0; i < 256 * 256; i++) {
        dummyTile[i * 4] = 131;
        dummyTile[i * 4 + 1] = 232;
        dummyTile[i * 4 + 2] = 0;
        dummyTile[i * 4 + 3] = 255;
      }

      const tileUrl = getElevationTileUrl(531, 364, 10);
      cache.set(tileUrl, dummyTile);

      const result = await elevationService.fetchCoordinatesAltitude([45.8326, 45.84], [6.8652, 6.87]);
      expect(result.hasErrors).toBe(false);
      expect(result.altitudes).toEqual([1000, 1000]);

      // Using fetchPointsAltitude
      const pointsResult = await elevationService.fetchPointsAltitude([
        { lat: 45.8326, lon: 6.8652 },
        { lat: 45.84, lon: 6.87 },
      ]);
      expect(pointsResult.hasErrors).toBe(false);
      expect(pointsResult.altitudes).toEqual([1000, 1000]);

      // Using fetchGroundAltitude
      const trackResult = await elevationService.fetchGroundAltitude({
        lat: [45.8326, 45.84],
        lon: [6.8652, 6.87],
      });
      expect(trackResult.hasErrors).toBe(false);
      expect(trackResult.altitudes).toEqual([1000, 1000]);
    });

    it('returns empty result for empty inputs', async () => {
      expect(await elevationService.fetchCoordinatesAltitude([], [])).toEqual({ altitudes: [], hasErrors: false });
      expect(await elevationService.fetchPointsAltitude([])).toEqual({ altitudes: [], hasErrors: false });
      expect(await elevationService.fetchGroundAltitude({ lat: [], lon: [] })).toEqual({
        altitudes: [],
        hasErrors: false,
      });
    });

    it('does not cache failed tile downloads allowing later retries', async () => {
      const fetchSpy = vi.spyOn(common, 'fetchResponse').mockRejectedValueOnce(new Error('Network error'));

      const result = await elevationService.fetchCoordinatesAltitude([45.83], [6.86]);
      expect(result.hasErrors).toBe(true);
      expect(result.altitudes).toEqual([common.NO_GROUND_ALTITUDE]);

      // Verify URL was not stored in cache
      const tileUrl = getElevationTileUrl(531, 364, 10);
      expect(elevationService.getCache().get(tileUrl)).toBeUndefined();
      expect(elevationService.getCache().has(tileUrl)).toBe(false);

      fetchSpy.mockRestore();
    });

    it('limits tile fetching to at most 50 tiles per request to protect cache', async () => {
      // Create a service with sufficient cache capacity
      const service = new ElevationService({ cacheCapacity: 100, zoom: 10 });
      const count = 60;
      const lats = new Float64Array(count);
      const lons = new Float64Array(count);
      const coords: [number, number, number, number] = [0, 0, 0, 0];
      const cache = service.getCache();

      // Pre-populate dummy tile buffer for each unique tile
      const dummyTile = new Uint8ClampedArray(256 * 256 * 4);
      // Fill all pixels with 500m: 500 + 32768 = 33268. R: 129, G: 244, B: 0
      for (let j = 0; j < 256 * 256; j++) {
        dummyTile[j * 4] = 129;
        dummyTile[j * 4 + 1] = 244;
        dummyTile[j * 4 + 2] = 0;
        dummyTile[j * 4 + 3] = 255;
      }

      for (let i = 0; i < count; i++) {
        // Space longitudes across different tiles along the equator (lat = 0)
        const lon = -170 + (i * 340) / count;
        lats[i] = 0;
        lons[i] = lon;

        service.projectLatLonFast(0, lon, coords);
        const tileUrl = getElevationTileUrl(coords[0], coords[1], 10);
        cache.set(tileUrl, dummyTile);
      }

      // Verify that getElevationUrlList with maxNumUrls = 50 caps at 50 URLs
      const urls = getElevationUrlList(lats, lons, createZoomConstants(10), 50);
      expect(urls.length).toBe(50);

      // Verify that fetchCoordinatesAltitude samples correctly
      const result = await service.fetchCoordinatesAltitude(lats, lons);
      expect(result.hasErrors).toBe(false);
      expect(result.altitudes).toHaveLength(count);
      for (let i = 0; i < count; i++) {
        expect(result.altitudes[i]).toBe(500);
      }
    });
  });

  describe('ElevationService class', () => {
    it('supports custom cache size in MB and tile capacity', () => {
      // 50 MB should give capacity around ~191 tiles
      const service50Mb = new ElevationService({ cacheSizeMb: 50, zoom: 10 });
      expect(service50Mb.getCache().max).toBe(191);

      // Custom tile capacity directly
      const service10Tiles = new ElevationService({ cacheCapacity: 10, zoom: 10 });
      expect(service10Tiles.getCache().max).toBe(10);
    });

    it('isolates cache between different service instances', async () => {
      const serviceA = new ElevationService({ cacheCapacity: 10, zoom: 10 });
      const serviceB = new ElevationService({ cacheCapacity: 10, zoom: 10 });

      const dummyTile = new Uint8ClampedArray(256 * 256 * 4);
      dummyTile[0] = 131; // 1000m
      dummyTile[1] = 232;
      dummyTile[3] = 255;

      const tileUrl = getElevationTileUrl(531, 364, 10);
      serviceA.getCache().set(tileUrl, dummyTile);

      expect(serviceA.getCache().has(tileUrl)).toBe(true);
      expect(serviceB.getCache().has(tileUrl)).toBe(false);

      serviceA.getCache().clear();
      expect(serviceA.getCache().has(tileUrl)).toBe(false);
    });

    it('returns cache statistics including size and MB', () => {
      const service = new ElevationService({ cacheSizeMb: 50, zoom: 10 });
      expect(service.getCacheStats()).toEqual({
        size: 0,
        max: 191,
        sizeMb: 0,
        maxMb: 50,
      });

      const dummyTile = new Uint8ClampedArray(256 * 256 * 4);
      service.getCache().set('tile1', dummyTile);
      service.getCache().set('tile2', dummyTile);

      const stats = service.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.max).toBe(191);
      expect(stats.sizeMb).toBe(1); // 2 * 262144 / 1e6 ~ 0.52 -> rounds to 1
      expect(stats.maxMb).toBe(50);
    });
  });

  describe('Timeout handling', () => {
    it('fills missing coordinates with NO_GROUND_ALTITUDE when a timeout occurs', async () => {
      const service = new ElevationService({ cacheCapacity: 10, zoom: 10, timeoutSec: 0.05 });

      // Point 1 in tile (531, 364)
      const lat1 = 45.8326;
      const lon1 = 6.8652;
      // Point 2 in a different tile
      const lat2 = 45.0;
      const lon2 = 6.0;

      // Pre-cache tile for Point 1 with 1000m elevation
      const dummyTile = new Uint8ClampedArray(256 * 256 * 4);
      for (let i = 0; i < 256 * 256; i++) {
        dummyTile[i * 4] = 131;
        dummyTile[i * 4 + 1] = 232;
        dummyTile[i * 4 + 3] = 255;
      }
      const coords: [number, number, number, number] = [0, 0, 0, 0];
      service.projectLatLonFast(lat1, lon1, coords);
      service.getCache().set(getElevationTileUrl(coords[0], coords[1], 10), dummyTile);

      // Mock fetchResponse to hang longer than timeoutSec (50ms)
      const fetchSpy = vi.spyOn(common, 'fetchResponse').mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  ok: false,
                  status: 504,
                } as any),
              150,
            );
          }),
      );

      const result = await service.fetchCoordinatesAltitude([lat1, lat2], [lon1, lon2]);
      expect(result.hasErrors).toBe(true);
      // First point is from cached tile -> 1000m
      expect(result.altitudes[0]).toBe(1000);
      // Second point timed out and is missing -> NO_GROUND_ALTITUDE
      expect(result.altitudes[1]).toBe(common.NO_GROUND_ALTITUDE);

      fetchSpy.mockRestore();
    });

    it('allows timeoutSec override per call', async () => {
      const service = new ElevationService({ cacheCapacity: 10, zoom: 10 });

      const fetchSpy = vi.spyOn(common, 'fetchResponse').mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  ok: false,
                  status: 504,
                } as any),
              150,
            );
          }),
      );

      const result = await service.fetchCoordinatesAltitude([45.0], [6.0], 5, 0.05);
      expect(result.hasErrors).toBe(true);
      expect(result.altitudes[0]).toBe(common.NO_GROUND_ALTITUDE);

      fetchSpy.mockRestore();
    });

    it('has default timeout constant set to 10 seconds', () => {
      expect(TIMEOUT_SEC_DEFAULT).toBe(10);
      const service = new ElevationService({ cacheCapacity: 10, zoom: 10 });
      // Access private timeoutSec for verification
      expect((service as any).timeoutSec).toBe(10);
    });
  });
});
