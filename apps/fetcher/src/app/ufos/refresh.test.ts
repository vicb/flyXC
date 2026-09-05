import { LiveDataRetentionSec, protos } from '@flyxc/common';
import { describe, expect, it } from 'vitest';

import { applyUfoFleetUpdates } from './refresh';
import type { UfoFleetUpdates } from './ufo';

describe('applyUfoFleetUpdates', () => {
  it('should merge deltas, simplify, and retain points within UFO retention window', () => {
    const nowSec = 1700000000;

    const existingDrone1Track: protos.LiveTrack = {
      timeSec: [nowSec - 1000],
      lat: [60.0],
      lon: [10.0],
      alt: [200],
      flags: [0],
      extra: {},
    };

    const state = protos.FetcherState.create({
      ufoFleets: {
        aviant: {
          ufos: {
            drone1: existingDrone1Track,
          },
        },
      },
    });

    const deltaDrone1: protos.LiveTrack = {
      timeSec: [nowSec - 200, nowSec - 198, nowSec - 50],
      lat: [60.01, 60.011, 60.02],
      lon: [10.01, 10.011, 10.02],
      alt: [210, 211, 220],
      flags: [0, 0, 0],
      extra: {},
    };

    const deltaDrone2: protos.LiveTrack = {
      timeSec: [nowSec - 100],
      lat: [61.0],
      lon: [11.0],
      alt: [300],
      flags: [0],
      extra: {},
    };

    const updates: UfoFleetUpdates = {
      fleetName: 'aviant',
      deltas: new Map([
        ['drone1', deltaDrone1],
        ['drone2', deltaDrone2],
      ]),
      errors: [],
      startFetchSec: nowSec - 5,
      endFetchSec: nowSec,
    };

    applyUfoFleetUpdates(state, [updates], nowSec);

    const ufos = state.ufoFleets.aviant.ufos;
    expect(ufos.drone1).toBeDefined();
    expect(ufos.drone2).toBeDefined();

    // drone1 merged existing + delta, and simplified (point at nowSec - 198 removed due to 5s interval)
    expect(ufos.drone1.timeSec).toEqual([nowSec - 1000, nowSec - 200, nowSec - 50]);
    expect(ufos.drone2.timeSec).toEqual([nowSec - 100]);
  });

  it('should remove UFOs whose tracks are completely older than UFO retention window', () => {
    const nowSec = 1700000000;
    const oldSec = nowSec - LiveDataRetentionSec.Ufo - 500;

    const oldTrack: protos.LiveTrack = {
      timeSec: [oldSec],
      lat: [60.0],
      lon: [10.0],
      alt: [200],
      flags: [0],
      extra: {},
    };

    const recentTrack: protos.LiveTrack = {
      timeSec: [nowSec - 500],
      lat: [61.0],
      lon: [11.0],
      alt: [300],
      flags: [0],
      extra: {},
    };

    const state = protos.FetcherState.create({
      ufoFleets: {
        aviant: {
          ufos: {
            droneOld: oldTrack,
            droneRecent: recentTrack,
          },
        },
      },
    });

    const updates: UfoFleetUpdates = {
      fleetName: 'aviant',
      deltas: new Map(),
      errors: [],
      startFetchSec: nowSec - 5,
      endFetchSec: nowSec,
    };

    applyUfoFleetUpdates(state, [updates], nowSec);

    const ufos = state.ufoFleets.aviant.ufos;
    expect(ufos.droneOld).toBeUndefined();
    expect(ufos.droneRecent).toBeDefined();
    expect(ufos.droneRecent.timeSec).toEqual([nowSec - 500]);
  });
});
