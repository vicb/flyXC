import { Comparison, findFirstIndex, NO_GROUND_ALTITUDE, type protos } from '@flyxc/common';
import type { AltitudeResult } from '@flyxc/common-node';
import { ElevationService } from '@flyxc/common-node';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ELEVATION_BATCH_SIZE, ELEVATION_FETCH_TIMEOUT_MS, patchTracksElevation } from './elevation';

describe('patchTracksElevation', () => {
  let mockElevationService: ElevationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockElevationService = new ElevationService({ cacheCapacity: 10, zoom: 10 });
  });

  it('should return immediately when tracks list is empty', async () => {
    const fetchSpy = vi.spyOn(mockElevationService, 'fetchCoordinatesAltitude');
    const updates = await patchTracksElevation([], mockElevationService);

    expect(updates.numFetched).toBe(0);
    expect(updates.numRetrieved).toBe(0);
    expect(updates.errors).toHaveLength(0);
    expect(updates.cache).toEqual({
      size: 0,
      max: 10,
      sizeMb: 0,
      maxMb: 3,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should fetch elevation for all points in update tracks', async () => {
    const fetchSpy = vi.spyOn(mockElevationService, 'fetchCoordinatesAltitude').mockResolvedValueOnce({
      altitudes: [500, 520, 600],
      hasErrors: false,
    });

    const delta1: protos.LiveTrack = {
      timeSec: [1000, 1010],
      lat: [45.0, 45.01],
      lon: [6.0, 6.01],
      alt: [1000, 1050],
      gndAlt: [NO_GROUND_ALTITUDE, NO_GROUND_ALTITUDE],
      flags: [0, 0],
      extra: {},
    };

    const delta2: protos.LiveTrack = {
      timeSec: [1000],
      lat: [46.0],
      lon: [7.0],
      alt: [1200],
      gndAlt: [NO_GROUND_ALTITUDE],
      flags: [0],
      extra: {},
    };

    const updates = await patchTracksElevation([{ track: delta1 }, { track: delta2 }], mockElevationService);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith([45.0, 45.01, 46.0], [6.0, 6.01, 7.0]);
    expect(updates.numFetched).toBe(3);
    expect(updates.numRetrieved).toBe(3);
    expect(updates.errors).toHaveLength(0);
    expect(delta1.gndAlt[0]).toBe(500);
    expect(delta1.gndAlt[1]).toBe(520);
    expect(delta2.gndAlt[0]).toBe(600);
  });

  it('should preserve valid existing altitudes and only fetch missing points', async () => {
    const fetchSpy = vi.spyOn(mockElevationService, 'fetchCoordinatesAltitude').mockResolvedValue({
      altitudes: [750],
      hasErrors: false,
    });

    const delta: protos.LiveTrack = {
      timeSec: [1000, 1010],
      lat: [45.0, 45.01],
      lon: [6.0, 6.01],
      alt: [1000, 1050],
      gndAlt: [400, NO_GROUND_ALTITUDE],
      flags: [0, 0],
      extra: {},
    };

    const updates = await patchTracksElevation([{ track: delta }], mockElevationService);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith([45.01], [6.01]);
    expect(updates.numFetched).toBe(1);
    expect(updates.numRetrieved).toBe(1);
    expect(delta.gndAlt[0]).toBe(400);
    expect(delta.gndAlt[1]).toBe(750);
  });

  it('should only check points on or after fromSec when fromSec is provided', async () => {
    const fetchSpy = vi.spyOn(mockElevationService, 'fetchCoordinatesAltitude').mockResolvedValue({
      altitudes: [850],
      hasErrors: false,
    });

    const track: protos.LiveTrack = {
      timeSec: [100, 200, 300],
      lat: [45.0, 45.1, 45.2],
      lon: [6.0, 6.1, 6.2],
      alt: [1000, 1050, 1100],
      gndAlt: [NO_GROUND_ALTITUDE, 500, NO_GROUND_ALTITUDE],
      flags: [0, 0, 0],
      extra: {},
    };

    // fromSec = 200:
    // index 0 (timeSec 100): < 200 -> ignored even though gndAlt is invalid
    // index 1 (timeSec 200): >= 200 -> gndAlt is valid (500) -> skipped
    // index 2 (timeSec 300): >= 200 -> gndAlt is invalid -> fetched
    const updates = await patchTracksElevation([{ track, fromSec: 200 }], mockElevationService);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith([45.2], [6.2]);
    expect(updates.numFetched).toBe(1);
    expect(updates.numRetrieved).toBe(1);
    expect(track.gndAlt[0]).toBe(NO_GROUND_ALTITUDE);
    expect(track.gndAlt[1]).toBe(500);
    expect(track.gndAlt[2]).toBe(850);
  });

  it('should find the first index greater or equal correctly', () => {
    const arr = [100, 200, 300];
    const cmp = Comparison.GREATER_EQUAL;
    expect(findFirstIndex(arr, 50, cmp)).toBe(0);
    expect(findFirstIndex(arr, 100, cmp)).toBe(0);
    expect(findFirstIndex(arr, 150, cmp)).toBe(1);
    expect(findFirstIndex(arr, 200, cmp)).toBe(1);
    expect(findFirstIndex(arr, 250, cmp)).toBe(2);
    expect(findFirstIndex(arr, 300, cmp)).toBe(2);
    expect(findFirstIndex(arr, 350, cmp)).toBe(3);
    expect(findFirstIndex([], 100, cmp)).toBe(0);
  });

  it('handles errors gracefully', async () => {
    vi.spyOn(mockElevationService, 'fetchCoordinatesAltitude').mockResolvedValueOnce({
      altitudes: [NO_GROUND_ALTITUDE],
      hasErrors: true,
    } as AltitudeResult);

    const delta: protos.LiveTrack = {
      timeSec: [1000],
      lat: [45.0],
      lon: [6.0],
      alt: [1000],
      gndAlt: [NO_GROUND_ALTITUDE],
      flags: [0],
      extra: {},
    };

    const updates = await patchTracksElevation([{ track: delta }], mockElevationService);

    expect(updates.numFetched).toBe(1);
    expect(updates.numRetrieved).toBe(0);
    expect(updates.errors.length).toBeGreaterThan(0);
    expect(delta.gndAlt[0]).toBe(NO_GROUND_ALTITUDE);
    expect(updates.durationSec).toBeGreaterThanOrEqual(0);
  });

  it('retries points with NO_GROUND_ALTITUDE', async () => {
    const fetchSpy = vi.spyOn(mockElevationService, 'fetchCoordinatesAltitude').mockResolvedValueOnce({
      altitudes: [650],
      hasErrors: false,
    });

    const delta: protos.LiveTrack = {
      timeSec: [1000],
      lat: [45.0],
      lon: [6.0],
      alt: [1000],
      gndAlt: [NO_GROUND_ALTITUDE],
      flags: [0],
      extra: {},
    };

    const updates = await patchTracksElevation([{ track: delta }], mockElevationService);

    expect(fetchSpy).toHaveBeenCalledWith([45.0], [6.0]);
    expect(updates.numFetched).toBe(1);
    expect(updates.numRetrieved).toBe(1);
    expect(delta.gndAlt[0]).toBe(650);
  });

  it('should record duration in seconds', async () => {
    vi.useFakeTimers();
    try {
      const delta: protos.LiveTrack = {
        timeSec: [1000],
        lat: [45.0],
        lon: [6.0],
        alt: [1000],
        gndAlt: [NO_GROUND_ALTITUDE],
        flags: [0],
        extra: {},
      };

      vi.spyOn(mockElevationService, 'fetchCoordinatesAltitude').mockImplementation(async () => {
        vi.advanceTimersByTime(2000);
        return { altitudes: [500], hasErrors: false };
      });

      const promise = patchTracksElevation([{ track: delta }], mockElevationService);
      await vi.runAllTimersAsync();
      const updates = await promise;

      expect(updates.durationSec).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should split queries into batches of at most ELEVATION_BATCH_SIZE', async () => {
    const fetchSpy = vi.spyOn(mockElevationService, 'fetchCoordinatesAltitude').mockResolvedValue({
      altitudes: new Array(ELEVATION_BATCH_SIZE).fill(500),
      hasErrors: false,
    });

    const delta: protos.LiveTrack = {
      timeSec: new Array(ELEVATION_BATCH_SIZE + 10).fill(1000),
      lat: new Array(ELEVATION_BATCH_SIZE + 10).fill(45.0),
      lon: new Array(ELEVATION_BATCH_SIZE + 10).fill(6.0),
      alt: new Array(ELEVATION_BATCH_SIZE + 10).fill(1000),
      gndAlt: new Array(ELEVATION_BATCH_SIZE + 10).fill(NO_GROUND_ALTITUDE),
      flags: new Array(ELEVATION_BATCH_SIZE + 10).fill(0),
      extra: {},
    };

    const updates = await patchTracksElevation([{ track: delta }], mockElevationService);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(updates.numFetched).toBe(ELEVATION_BATCH_SIZE + 10);
    expect((fetchSpy.mock.calls[0][0] as number[]).length).toBe(ELEVATION_BATCH_SIZE);
    expect((fetchSpy.mock.calls[1][0] as number[]).length).toBe(10);
  });

  it('should stop processing batches when timeout is reached', async () => {
    vi.useFakeTimers();
    try {
      const delta: protos.LiveTrack = {
        timeSec: new Array(ELEVATION_BATCH_SIZE + 10).fill(1000),
        lat: new Array(ELEVATION_BATCH_SIZE + 10).fill(45.0),
        lon: new Array(ELEVATION_BATCH_SIZE + 10).fill(6.0),
        alt: new Array(ELEVATION_BATCH_SIZE + 10).fill(1000),
        gndAlt: new Array(ELEVATION_BATCH_SIZE + 10).fill(NO_GROUND_ALTITUDE),
        flags: new Array(ELEVATION_BATCH_SIZE + 10).fill(0),
        extra: {},
      };

      const fetchSpy = vi.spyOn(mockElevationService, 'fetchCoordinatesAltitude').mockImplementation(async () => {
        vi.advanceTimersByTime(ELEVATION_FETCH_TIMEOUT_MS + 100);
        return { altitudes: new Array(ELEVATION_BATCH_SIZE).fill(500), hasErrors: false };
      });

      const promise = patchTracksElevation([{ track: delta }], mockElevationService);
      await vi.runAllTimersAsync();
      const updates = await promise;

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(updates.errors).toContain('Timeout fetching elevation for tracks');
      expect(updates.numFetched).toBe(ELEVATION_BATCH_SIZE);
      expect(updates.numRetrieved).toBe(ELEVATION_BATCH_SIZE);
    } finally {
      vi.useRealTimers();
    }
  });
});
