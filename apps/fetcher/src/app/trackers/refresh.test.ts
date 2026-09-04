import { LiveDataRetentionSec, protos } from '@flyxc/common';
import { describe, expect, it } from 'vitest';

import { applyTrackerUpdates } from './refresh';
import type { TrackerUpdates } from './tracker';

describe('applyTrackerUpdates', () => {
  it('should merge deltas and simplify tracks only for updated pilots', () => {
    const nowSec = 1700000000;

    // Pilot 1: Has track and receives an update with close points (needs simplification)
    const pilot1Track: protos.LiveTrack = {
      timeSec: [nowSec - 100],
      lat: [45.0],
      lon: [6.0],
      alt: [1000],
      flags: [0],
      extra: {},
    };

    // Pilot 2: Has track with close points but NO update this cycle (should NOT be simplified)
    const pilot2Track: protos.LiveTrack = {
      timeSec: [nowSec - 50, nowSec - 45, nowSec - 40],
      lat: [46.0, 46.1, 46.2],
      lon: [7.0, 7.1, 7.2],
      alt: [1200, 1210, 1220],
      flags: [0, 0, 0],
      extra: {},
    };

    // Pilot 3: Empty track with no updates
    const pilot3Track: protos.LiveTrack = {
      timeSec: [],
      lat: [],
      lon: [],
      alt: [],
      flags: [],
      extra: {},
    };

    const state = protos.FetcherState.create({
      pilots: {
        1: { track: pilot1Track },
        2: { track: pilot2Track },
        3: { track: pilot3Track },
      },
    });

    const deltaFor1: protos.LiveTrack = {
      timeSec: [nowSec - 30, nowSec - 28, nowSec - 20],
      lat: [45.1, 45.2, 45.3],
      lon: [6.1, 6.2, 6.3],
      alt: [1050, 1060, 1070],
      flags: [0, 0, 0],
      extra: {},
    };

    const updates: TrackerUpdates = {
      name: 'inreach',
      trackerDeltas: new Map([[1, deltaFor1]]),
      trackerErrors: new Map(),
      errors: [],
      fetchedTracker: new Set([1]),
      startFetchSec: nowSec - 5,
      endFetchSec: nowSec,
    };

    const updatedIds = applyTrackerUpdates(state, [updates], nowSec);

    expect(updatedIds).toEqual(new Set([1]));

    // Pilot 1 was updated: delta merged and simplified
    // Points within intervalSec (5s) are decimated:
    // [nowSec - 100, nowSec - 30, nowSec - 20] (point at nowSec - 28 simplified out)
    expect(state.pilots[1].track.timeSec).toEqual([nowSec - 100, nowSec - 30, nowSec - 20]);

    // Pilot 2 was NOT updated: track remains completely untouched with all 3 points
    expect(state.pilots[2].track.timeSec).toEqual([nowSec - 50, nowSec - 45, nowSec - 40]);

    // Pilot 3 had no updates: track remains empty
    expect(state.pilots[3].track.timeSec).toEqual([]);
  });

  it('should drop outdated points (> 48h) for non-updated pilots', () => {
    const nowSec = 1700000000;
    const oldSec = nowSec - LiveDataRetentionSec.Max - 1000;

    const pilotTrack: protos.LiveTrack = {
      timeSec: [oldSec, nowSec - 100],
      lat: [45.0, 45.1],
      lon: [6.0, 6.1],
      alt: [1000, 1100],
      flags: [0, 0],
      extra: {},
    };

    const state = protos.FetcherState.create({
      pilots: {
        1: { track: pilotTrack },
      },
    });

    applyTrackerUpdates(state, [], nowSec);

    // Outdated point dropped, recent point kept
    expect(state.pilots[1].track.timeSec).toEqual([nowSec - 100]);
  });

  it('should drop outdated points (> 48h) for updated pilots as well', () => {
    const nowSec = 1700000000;
    const oldSec = nowSec - LiveDataRetentionSec.Max - 1000;

    const pilotTrack: protos.LiveTrack = {
      timeSec: [oldSec, nowSec - 100],
      lat: [45.0, 45.1],
      lon: [6.0, 6.1],
      alt: [1000, 1100],
      flags: [0, 0],
      extra: {},
    };

    const state = protos.FetcherState.create({
      pilots: {
        1: { track: pilotTrack },
      },
    });

    const delta: protos.LiveTrack = {
      timeSec: [nowSec - 50],
      lat: [45.2],
      lon: [6.2],
      alt: [1200],
      flags: [0],
      extra: {},
    };

    const updates: TrackerUpdates = {
      name: 'inreach',
      trackerDeltas: new Map([[1, delta]]),
      trackerErrors: new Map(),
      errors: [],
      fetchedTracker: new Set([1]),
      startFetchSec: nowSec - 5,
      endFetchSec: nowSec,
    };

    applyTrackerUpdates(state, [updates], nowSec);

    // Outdated point dropped, and new delta merged
    expect(state.pilots[1].track.timeSec).toEqual([nowSec - 100, nowSec - 50]);
  });
});
