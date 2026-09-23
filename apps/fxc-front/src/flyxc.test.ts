import type { RuntimeTrack } from '@flyxc/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as app from './app/redux/app-slice';
import { store } from './app/redux/store';
import { MapsElement } from './flyxc';

/**
 * Creates a mock RuntimeTrack.
 *
 * @param id - Track ID.
 * @param timeSec - Array of timestamps in seconds.
 * @param alt - Array of altitude values.
 * @returns Mock RuntimeTrack.
 */
function createMockTrack(id: string, timeSec: number[], alt: number[]): RuntimeTrack {
  return {
    id,
    name: `Pilot ${id}`,
    isPostProcessed: true,
    lat: timeSec.map(() => 45.0),
    lon: timeSec.map(() => 6.0),
    lookAtLat: timeSec.map(() => 45.0),
    lookAtLon: timeSec.map(() => 6.0),
    alt,
    gndAlt: alt.map((a) => a - 200),
    vx: timeSec.map(() => 10),
    vz: timeSec.map(() => 1),
    timeSec,
    heading: timeSec.map(() => 0),
    minAlt: Math.min(...alt),
    maxAlt: Math.max(...alt),
    minTimeSec: timeSec[0],
    maxTimeSec: timeSec[timeSec.length - 1],
    minLat: 45.0,
    maxLat: 45.0,
    minLon: 6.0,
    maxLon: 6.0,
    minVx: 10,
    maxVx: 10,
    minVz: 1,
    maxVz: 1,
    maxDistance: 100,
  };
}

describe('MapsElement stateChanged multi-day track switching', () => {
  // Day 1: 1000..4000
  const trackDay1 = createMockTrack('d1', [1000, 2000, 4000], [1000, 1500, 1200]);
  // Day 2: 100000..105000 (starts 99000s > 12h later)
  const trackDay2 = createMockTrack('d2', [100000, 102000, 105000], [1100, 1600, 1300]);

  let el: MapsElement;

  beforeEach(() => {
    el = new MapsElement();
  });

  it('adjusts time by track-start delta when switching tracks without pre-set time', () => {
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    // Simulate el having previously selected d1
    (el as any).lastSelectedTrackId = 'd1';

    const state: any = {
      app: {
        timeSec: 2500, // On Day 1 (1500s into Day 1 track)
        loadingApi: false,
        chartYAxis: 0,
      },
      track: {
        currentTrackId: 'd2', // Switching to Day 2 track
        tracks: {
          ids: ['d1', 'd2'],
          entities: { d1: trackDay1, d2: trackDay2 },
        },
        fetching: false,
      },
      liveTrack: {
        currentLiveId: undefined,
        tracks: { ids: [], entities: {} },
      },
      units: {},
      airspace: { showClasses: [], showTypes: [] },
      planner: { enabled: false },
    };

    el.stateChanged(state);

    // Delta is 100000 - 1000 = 99000. Target time: 2500 + 99000 = 101500
    expect(dispatchSpy).toHaveBeenCalledWith(app.setTimeSec(101500));

    dispatchSpy.mockRestore();
  });

  it('does not add delta when time was already pre-set on the selected track', () => {
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    // Simulate el having previously selected d1
    (el as any).lastSelectedTrackId = 'd1';

    const state: any = {
      app: {
        timeSec: 102500, // Caller already set timeSec on Day 2 track!
        loadingApi: false,
        chartYAxis: 0,
      },
      track: {
        currentTrackId: 'd2', // Switching to Day 2 track
        tracks: {
          ids: ['d1', 'd2'],
          entities: { d1: trackDay1, d2: trackDay2 },
        },
        fetching: false,
      },
      liveTrack: {
        currentLiveId: undefined,
        tracks: { ids: [], entities: {} },
      },
      units: {},
      airspace: { showClasses: [], showTypes: [] },
      planner: { enabled: false },
    };

    el.stateChanged(state);

    // Because 102500 is within d2's [100000, 105000], no extra delta should be added
    expect(dispatchSpy).not.toHaveBeenCalledWith(app.setTimeSec(102500 + 99000));
    // And since 102500 is already within min/max, no setTimeSec dispatch is needed
    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: app.setTimeSec.type }));

    dispatchSpy.mockRestore();
  });
});
