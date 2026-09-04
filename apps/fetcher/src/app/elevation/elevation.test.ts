import type * as common from '@flyxc/common';
import { fetchResponse, protos } from '@flyxc/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { patchLastFixAGL } from './elevation';

vi.mock('@flyxc/common', async (importOriginal) => {
  const actual = await importOriginal<typeof common>();
  return {
    ...actual,
    fetchResponse: vi.fn(),
  };
});

function createArcgisResponse(points: { lat: number; lon: number; alt: number }[]) {
  const paths: [number, number, number][] = [];
  for (const p of points) {
    paths.push([p.lon, p.lat, p.alt]);
    paths.push([-15, -15, 0]);
  }
  return {
    results: [
      {
        paramName: 'OutputProfile',
        value: {
          features: [
            {
              geometry: {
                paths: [paths],
              },
            },
          ],
        },
      },
    ],
  };
}

describe('patchLastFixAGL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return immediately when updatedPilotIds is empty', async () => {
    const state = protos.FetcherState.create({
      pilots: {
        1: {
          track: {
            timeSec: [1000],
            lat: [45.0],
            lon: [6.0],
            alt: [1000],
            flags: [0],
            extra: {},
          },
        },
      },
    });

    const updates = await patchLastFixAGL(state, new Set());

    expect(updates.numFetched).toBe(0);
    expect(updates.numRetrieved).toBe(0);
    expect(updates.errors).toHaveLength(0);
    expect(fetchResponse).not.toHaveBeenCalled();
  });

  it('should only check updated pilots when updatedPilotIds is provided', async () => {
    // Pilot 1: updated, missing gndAlt
    const pilot1Track: protos.LiveTrack = {
      timeSec: [1000],
      lat: [45.0],
      lon: [6.0],
      alt: [1000],
      flags: [0],
      extra: {},
    };

    // Pilot 2: NOT updated, missing gndAlt
    const pilot2Track: protos.LiveTrack = {
      timeSec: [1000],
      lat: [46.0],
      lon: [7.0],
      alt: [1200],
      flags: [0],
      extra: {},
    };

    // Pilot 3: updated, but ALREADY has gndAlt
    const pilot3Track: protos.LiveTrack = {
      timeSec: [1000],
      lat: [47.0],
      lon: [8.0],
      alt: [1500],
      flags: [0],
      extra: { 0: { gndAlt: 850 } },
    };

    const state = protos.FetcherState.create({
      pilots: {
        1: { track: pilot1Track },
        2: { track: pilot2Track },
        3: { track: pilot3Track },
      },
    });

    const arcgisJson = createArcgisResponse([{ lat: 45.0, lon: 6.0, alt: 420.4 }]);
    vi.mocked(fetchResponse).mockResolvedValueOnce({
      ok: true,
      json: async () => arcgisJson,
    } as any);

    // Only pilot 1 and 3 are in updatedPilotIds
    const updates = await patchLastFixAGL(state, new Set([1, 3]));

    expect(fetchResponse).toHaveBeenCalledTimes(1);
    expect(updates.numFetched).toBe(1);
    expect(updates.numRetrieved).toBe(1);

    // Pilot 1 had gndAlt patched
    expect(state.pilots[1].track.extra[0]?.gndAlt).toBe(420);

    // Pilot 2 was NOT updated: gndAlt remains undefined
    expect(state.pilots[2].track.extra[0]?.gndAlt).toBeUndefined();

    // Pilot 3 already had gndAlt: remains unchanged
    expect(state.pilots[3].track.extra[0]?.gndAlt).toBe(850);
  });

  it('should check all pilots when updatedPilotIds is not provided', async () => {
    const pilot1Track: protos.LiveTrack = {
      timeSec: [1000],
      lat: [45.0],
      lon: [6.0],
      alt: [1000],
      flags: [0],
      extra: {},
    };
    const pilot2Track: protos.LiveTrack = {
      timeSec: [1000],
      lat: [46.0],
      lon: [7.0],
      alt: [1200],
      flags: [0],
      extra: {},
    };

    const state = protos.FetcherState.create({
      pilots: {
        1: { track: pilot1Track },
        2: { track: pilot2Track },
      },
    });

    const arcgisJson = createArcgisResponse([
      { lat: 45.0, lon: 6.0, alt: 420 },
      { lat: 46.0, lon: 7.0, alt: 530 },
    ]);
    vi.mocked(fetchResponse).mockResolvedValueOnce({
      ok: true,
      json: async () => arcgisJson,
    } as any);

    const updates = await patchLastFixAGL(state);

    expect(updates.numFetched).toBe(2);
    expect(updates.numRetrieved).toBe(2);
    expect(state.pilots[1].track.extra[0]?.gndAlt).toBe(420);
    expect(state.pilots[2].track.extra[0]?.gndAlt).toBe(530);
  });

  it('handles transient network failure gracefully and leaves gndAlt unset for future retries', async () => {
    const pilotTrack: protos.LiveTrack = {
      timeSec: [1000],
      lat: [45.0],
      lon: [6.0],
      alt: [1000],
      flags: [0],
      extra: {},
    };

    const state = protos.FetcherState.create({
      pilots: {
        1: { track: pilotTrack },
      },
    });

    vi.mocked(fetchResponse).mockRejectedValueOnce(new Error('Network timeout'));

    const updates = await patchLastFixAGL(state, new Set([1]));

    expect(updates.numFetched).toBe(1);
    expect(updates.numRetrieved).toBe(0);
    expect(updates.errors).toHaveLength(1);
    expect(updates.errors[0]).toContain('Network timeout');

    // gndAlt remains unset so it can be retried when pilot is updated
    expect(state.pilots[1].track.extra[0]?.gndAlt).toBeUndefined();

    // In a subsequent cycle where pilot 1 is updated again, retry succeeds
    const arcgisJson = createArcgisResponse([{ lat: 45.0, lon: 6.0, alt: 420 }]);
    vi.mocked(fetchResponse).mockResolvedValueOnce({
      ok: true,
      json: async () => arcgisJson,
    } as any);

    const retryUpdates = await patchLastFixAGL(state, new Set([1]));
    expect(retryUpdates.numFetched).toBe(1);
    expect(retryUpdates.numRetrieved).toBe(1);
    expect(state.pilots[1].track.extra[0]?.gndAlt).toBe(420);
  });
});
