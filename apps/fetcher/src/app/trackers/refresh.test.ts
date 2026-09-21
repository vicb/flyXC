import { LiveTrackDurationSec, protos } from '@flyxc/common';
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
      gndAlt: [500],
      flags: [0],
      extra: {},
    };

    // Pilot 2: Has track with close points but NO update this cycle (should NOT be simplified)
    const pilot2Track: protos.LiveTrack = {
      timeSec: [nowSec - 50, nowSec - 45, nowSec - 40],
      lat: [46.0, 46.1, 46.2],
      lon: [7.0, 7.1, 7.2],
      alt: [1200, 1210, 1220],
      gndAlt: [600, 610, 620],
      flags: [0, 0, 0],
      extra: {},
    };

    // Pilot 3: Empty track with no updates
    const pilot3Track: protos.LiveTrack = {
      timeSec: [],
      lat: [],
      lon: [],
      alt: [],
      gndAlt: [],
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
      gndAlt: [550, 560, 570],
      flags: [0, 0, 0],
      extra: {},
    };

    const updates: TrackerUpdates = {
      name: 'inreach',
      trackerDeltas: new Map([[1, deltaFor1]]),
      trackerStatus: new Map(),
      trackerErrors: new Map(),
      errors: [],
      fetchedTracker: new Set([1]),
      startFetchSec: nowSec - 5,
      endFetchSec: nowSec,
    };

    const updatedIds = applyTrackerUpdates(state, [updates], nowSec);

    expect(updatedIds).toEqual(new Map([[1, nowSec - 30]]));

    // Pilot 1 was updated: delta merged and simplified
    // Points within intervalSec (5s) are decimated:
    // [nowSec - 100, nowSec - 30, nowSec - 20] (point at nowSec - 28 simplified out)
    expect(state.pilots[1].track.timeSec).toEqual([nowSec - 100, nowSec - 30, nowSec - 20]);

    // Pilot 2 was NOT updated: track remains completely untouched with all 3 points
    expect(state.pilots[2].track.timeSec).toEqual([nowSec - 50, nowSec - 45, nowSec - 40]);

    // Pilot 3 had no updates: track remains empty
    expect(state.pilots[3].track.timeSec).toEqual([]);
  });

  it('should record the earliest timestamp when multiple patches update the same pilot', () => {
    const nowSec = 1700000000;
    const pilot1Track: protos.LiveTrack = {
      timeSec: [nowSec - 200],
      lat: [45.0],
      lon: [6.0],
      alt: [1000],
      gndAlt: [500],
      flags: [0],
      extra: {},
    };
    const state = protos.FetcherState.create({
      pilots: {
        1: { track: pilot1Track },
      },
    });

    const update1: TrackerUpdates = {
      name: 'inreach',
      trackerDeltas: new Map([
        [
          1,
          {
            timeSec: [nowSec - 50, nowSec - 30],
            lat: [45.1, 45.2],
            lon: [6.1, 6.2],
            alt: [1050, 1060],
            gndAlt: [0, 0],
            flags: [0, 0],
            extra: {},
          },
        ],
      ]),
      trackerStatus: new Map(),
      trackerErrors: new Map(),
      errors: [],
      fetchedTracker: new Set([1]),
      startFetchSec: nowSec - 5,
      endFetchSec: nowSec,
    };

    const update2: TrackerUpdates = {
      name: 'ogn',
      trackerDeltas: new Map([
        [
          1,
          {
            timeSec: [nowSec - 80, nowSec - 40],
            lat: [45.05, 45.15],
            lon: [6.05, 6.15],
            alt: [1020, 1055],
            gndAlt: [0, 0],
            flags: [0, 0],
            extra: {},
          },
        ],
      ]),
      trackerStatus: new Map(),
      trackerErrors: new Map(),
      errors: [],
      fetchedTracker: new Set([1]),
      startFetchSec: nowSec - 5,
      endFetchSec: nowSec,
    };

    const updatedPilots = applyTrackerUpdates(state, [update1, update2], nowSec);
    expect(updatedPilots).toEqual(new Map([[1, nowSec - 80]]));
  });

  it('should drop outdated points (> 48h) for non-updated pilots', () => {
    const nowSec = 1700000000;
    const oldSec = nowSec - LiveTrackDurationSec.Max - 1000;

    const pilotTrack: protos.LiveTrack = {
      timeSec: [oldSec, nowSec - 100],
      lat: [45.0, 45.1],
      lon: [6.0, 6.1],
      alt: [1000, 1100],
      gndAlt: [500, 600],
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
    const oldSec = nowSec - LiveTrackDurationSec.Max - 1000;

    const pilotTrack: protos.LiveTrack = {
      timeSec: [oldSec, nowSec - 100],
      lat: [45.0, 45.1],
      lon: [6.0, 6.1],
      alt: [1000, 1100],
      gndAlt: [500, 600],
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
      gndAlt: [600],
      flags: [0],
      extra: {},
    };

    const updates: TrackerUpdates = {
      name: 'inreach',
      trackerDeltas: new Map([[1, delta]]),
      trackerStatus: new Map(),
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

  it('should update pilot status and attach message when status changes', () => {
    const nowSec = 1700000000;

    const pilotTrack: protos.LiveTrack = {
      // 3 points close together (interval < 5s):
      // point at nowSec - 20 would normally be simplified out if not for message!
      timeSec: [nowSec - 30, nowSec - 20, nowSec - 10],
      lat: [45.0, 45.1, 45.2],
      lon: [6.0, 6.1, 6.2],
      alt: [1000, 1010, 1020],
      gndAlt: [500, 510, 520],
      flags: [0, 0, 0],
      extra: {},
    };

    const state = protos.FetcherState.create({
      pilots: {
        1: { track: pilotTrack, status: protos.PilotStatus.UNKNOWN, statusTimeSec: 0 },
      },
    });

    const updates: TrackerUpdates = {
      name: 'ogn',
      trackerDeltas: new Map([[1, pilotTrack]]),
      trackerStatus: new Map([[1, { status: protos.PilotStatus.LANDED_OK, statusTimeSec: nowSec - 20 }]]),
      trackerErrors: new Map(),
      errors: [],
      fetchedTracker: new Set([1]),
      startFetchSec: nowSec - 5,
      endFetchSec: nowSec,
    };

    applyTrackerUpdates(state, [updates], nowSec);

    const pilot = state.pilots[1];
    expect(pilot.status).toBe(protos.PilotStatus.LANDED_OK);
    expect(pilot.statusTimeSec).toBe(nowSec - 20);

    // Message is attached at index of nowSec - 20 (index 1)
    expect(pilot.track.extra[1]?.message).toBe('Status: Landed OK');
    // Because of the message, point nowSec - 20 is preserved and not simplified out!
    expect(pilot.track.timeSec).toEqual([nowSec - 30, nowSec - 20, nowSec - 10]);
  });

  it('should ignore status updates older than current statusTimeSec', () => {
    const nowSec = 1700000000;

    const state = protos.FetcherState.create({
      pilots: {
        1: { track: protos.LiveTrack.create(), status: protos.PilotStatus.LANDED_OK, statusTimeSec: nowSec - 10 },
      },
    });

    const updates: TrackerUpdates = {
      name: 'ogn',
      trackerDeltas: new Map(),
      trackerStatus: new Map([[1, { status: protos.PilotStatus.FLYING, statusTimeSec: nowSec - 50 }]]),
      trackerErrors: new Map(),
      errors: [],
      fetchedTracker: new Set([1]),
      startFetchSec: nowSec - 5,
      endFetchSec: nowSec,
    };

    applyTrackerUpdates(state, [updates], nowSec);

    const pilot = state.pilots[1];
    expect(pilot.status).toBe(protos.PilotStatus.LANDED_OK);
    expect(pilot.statusTimeSec).toBe(nowSec - 10);
  });

  it('should not attach message when status does not change', () => {
    const nowSec = 1700000000;

    const pilotTrack: protos.LiveTrack = {
      timeSec: [nowSec - 20],
      lat: [45.0],
      lon: [6.0],
      alt: [1000],
      gndAlt: [500],
      flags: [0],
      extra: {},
    };

    const state = protos.FetcherState.create({
      pilots: {
        1: { track: pilotTrack, status: protos.PilotStatus.LANDED_OK, statusTimeSec: nowSec - 30 },
      },
    });

    const updates: TrackerUpdates = {
      name: 'ogn',
      trackerDeltas: new Map([[1, pilotTrack]]),
      trackerStatus: new Map([[1, { status: protos.PilotStatus.LANDED_OK, statusTimeSec: nowSec - 20 }]]),
      trackerErrors: new Map(),
      errors: [],
      fetchedTracker: new Set([1]),
      startFetchSec: nowSec - 5,
      endFetchSec: nowSec,
    };

    applyTrackerUpdates(state, [updates], nowSec);

    const pilot = state.pilots[1];
    expect(pilot.status).toBe(protos.PilotStatus.LANDED_OK);
    expect(pilot.statusTimeSec).toBe(nowSec - 20);
    // No message attached because status did not change
    expect(pilot.track.extra[0]?.message).toBeUndefined();
  });

  it('should resolve latest status across trackers first to avoid spurious transitions', () => {
    const nowSec = 1700000000;

    const pilotTrack: protos.LiveTrack = {
      timeSec: [nowSec - 30, nowSec - 10],
      lat: [45.0, 45.1],
      lon: [6.0, 6.1],
      alt: [1000, 1010],
      gndAlt: [500, 510],
      flags: [0, 0],
      extra: {},
    };

    // Pilot is currently FLYING (A)
    const state = protos.FetcherState.create({
      pilots: {
        1: { track: pilotTrack, status: protos.PilotStatus.FLYING, statusTimeSec: nowSec - 50 },
      },
    });

    // Tracker 1 reports LANDED_OK (B) at nowSec - 30
    const tracker1Updates: TrackerUpdates = {
      name: 'ogn',
      trackerDeltas: new Map([[1, pilotTrack]]),
      trackerStatus: new Map([[1, { status: protos.PilotStatus.LANDED_OK, statusTimeSec: nowSec - 30 }]]),
      trackerErrors: new Map(),
      errors: [],
      fetchedTracker: new Set([1]),
      startFetchSec: nowSec - 5,
      endFetchSec: nowSec,
    };

    // Tracker 2 reports FLYING (A) at newer timestamp nowSec - 10
    const tracker2Updates: TrackerUpdates = {
      name: 'inreach',
      trackerDeltas: new Map(),
      trackerStatus: new Map([[1, { status: protos.PilotStatus.FLYING, statusTimeSec: nowSec - 10 }]]),
      trackerErrors: new Map(),
      errors: [],
      fetchedTracker: new Set([1]),
      startFetchSec: nowSec - 5,
      endFetchSec: nowSec,
    };

    // Passing tracker1 (B) first, then tracker2 (A)
    applyTrackerUpdates(state, [tracker1Updates, tracker2Updates], nowSec);

    const pilot = state.pilots[1];
    // Resolved latest status across trackers is FLYING at nowSec - 10
    expect(pilot.status).toBe(protos.PilotStatus.FLYING);
    expect(pilot.statusTimeSec).toBe(nowSec - 10);
    // No spurious messages attached because resolved latest status did not differ from pilot status
    expect(pilot.track.extra[0]?.message).toBeUndefined();
    expect(pilot.track.extra[1]?.message).toBeUndefined();
  });

  it('should append status message to existing message if present', () => {
    const nowSec = 1700000000;

    const pilotTrack: protos.LiveTrack = {
      timeSec: [nowSec - 20],
      lat: [45.0],
      lon: [6.0],
      alt: [1000],
      gndAlt: [500],
      flags: [0],
      extra: { 0: { message: 'Existing message' } },
    };

    const state = protos.FetcherState.create({
      pilots: {
        1: { track: pilotTrack, status: protos.PilotStatus.FLYING, statusTimeSec: nowSec - 50 },
      },
    });

    const updates: TrackerUpdates = {
      name: 'ogn',
      trackerDeltas: new Map([[1, pilotTrack]]),
      trackerStatus: new Map([[1, { status: protos.PilotStatus.LANDED_OK, statusTimeSec: nowSec - 20 }]]),
      trackerErrors: new Map(),
      errors: [],
      fetchedTracker: new Set([1]),
      startFetchSec: nowSec - 5,
      endFetchSec: nowSec,
    };

    applyTrackerUpdates(state, [updates], nowSec);

    const pilot = state.pilots[1];
    expect(pilot.status).toBe(protos.PilotStatus.LANDED_OK);
    expect(pilot.track.extra[0]?.message).toBe('Existing message - Status: Landed OK');
  });

  it('should not mark pilot for elevation patching when only status changes without track deltas', () => {
    const nowSec = 1700000000;

    const pilotTrack: protos.LiveTrack = {
      timeSec: [nowSec - 20],
      lat: [45.0],
      lon: [6.0],
      alt: [1000],
      gndAlt: [500],
      flags: [0],
      extra: {},
    };

    const state = protos.FetcherState.create({
      pilots: {
        1: { track: pilotTrack, status: protos.PilotStatus.FLYING, statusTimeSec: nowSec - 50 },
      },
    });

    const updates: TrackerUpdates = {
      name: 'ogn',
      trackerDeltas: new Map(),
      trackerStatus: new Map([[1, { status: protos.PilotStatus.LANDED_OK, statusTimeSec: nowSec - 20 }]]),
      trackerErrors: new Map(),
      errors: [],
      fetchedTracker: new Set([1]),
      startFetchSec: nowSec - 5,
      endFetchSec: nowSec,
    };

    const updatedPilots = applyTrackerUpdates(state, [updates], nowSec);

    expect(updatedPilots.size).toBe(0);
    expect(state.pilots[1].status).toBe(protos.PilotStatus.LANDED_OK);
    expect(state.pilots[1].track.extra[0]?.message).toBe('Status: Landed OK');
  });
});
