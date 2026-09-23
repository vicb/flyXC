import type { protos, RuntimeTrack } from '@flyxc/common';
import { NO_GROUND_ALTITUDE } from '@flyxc/common';
import { describe, expect, it, vi } from 'vitest';

import { ChartYAxis } from '../components/chart-element';
import { updateAppTime } from './app-slice';
import { setCurrentLiveId } from './live-track-slice';
import * as sel from './selectors';
import { store } from './store';
import { addTrackEntities, removeTracksByGroupIds, selectNextTrack, setCurrentTrackId } from './track-slice';

/**
 * Creates a mock RuntimeTrack object with populated coordinates and statistics.
 *
 * @param id - Unique track identifier.
 * @param timeSec - Array of timestamps in seconds.
 * @param alt - Array of GPS altitude values.
 * @returns A fully populated mock RuntimeTrack.
 */
function createMockRuntimeTrack(id: string, timeSec: number[], alt: number[]): RuntimeTrack {
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

/**
 * Creates a mock protos.LiveTrack object.
 *
 * @param id - Pilot ID.
 * @param timeSec - Array of fix timestamps in seconds.
 * @param alt - Array of altitude values.
 * @param gndAlt - Optional array of ground altitude values.
 * @returns A mock LiveTrack.
 */
function createMockLiveTrack(id: number, timeSec: number[], alt: number[], gndAlt?: number[]): protos.LiveTrack {
  return {
    id,
    name: `Live Pilot ${id}`,
    lat: timeSec.map(() => 45.5),
    lon: timeSec.map(() => 6.5),
    alt,
    gndAlt: gndAlt ?? alt.map((a) => a - 150),
    timeSec,
    flags: timeSec.map(() => 0),
    extra: {},
  };
}

describe('chart selectors', () => {
  const rtTrack = createMockRuntimeTrack('1-0', [1000, 1100, 1200], [1500, 1800, 1600]);
  const liveTrack = createMockLiveTrack(42, [2000, 2100, 2200], [2200, 2500, 2300], [1000, NO_GROUND_ALTITUDE, 1200]);

  const baseState: any = {
    track: {
      tracks: {
        ids: [rtTrack.id],
        entities: { [rtTrack.id]: rtTrack },
      },
      currentTrackId: rtTrack.id,
      fetching: false,
    },
    liveTrack: {
      tracks: {
        ids: ['42'],
        entities: { '42': liveTrack },
      },
      currentLiveId: undefined,
      fetchMillis: 0,
      geojson: {},
      refreshTimer: null,
      displayLabels: true,
      centerOnLocation: false,
      historySec: 3600,
    },
    app: {
      chartYAxis: ChartYAxis.Altitude,
      timeSec: 1100,
      loadingApi: false,
    },
    units: {
      altitude: 0,
      speed: 0,
      vario: 0,
      distance: 0,
    },
    airspace: {
      showClasses: [],
      showTypes: [],
    },
  };

  it('selects runtime tracks when no live track is selected', () => {
    const tracks = sel.chartTracks(baseState);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].id).toBe('1-0');
    expect(tracks[0].alt).toEqual([1500, 1800, 1600]);
    expect(tracks[0].vx).toBeDefined();

    expect(sel.chartAvailableYAxes(baseState)).toEqual([ChartYAxis.Altitude, ChartYAxis.Speed, ChartYAxis.Vario]);
    expect(sel.chartMinTimeSec(baseState)).toBe(1000);
    expect(sel.chartMaxTimeSec(baseState)).toBe(1200);
  });

  it('switches to live track when currentLiveId is set', () => {
    const stateWithLive = {
      ...baseState,
      liveTrack: {
        ...baseState.liveTrack,
        currentLiveId: '42',
      },
    };

    expect(sel.isLiveTrackSelected(stateWithLive)).toBe(true);
    expect(sel.hasChartTrack(stateWithLive)).toBe(true);

    const tracks = sel.chartTracks(stateWithLive);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].id).toBe('42');
    expect(tracks[0].name).toBe('Live Pilot 42');
    expect(tracks[0].alt).toEqual([2200, 2500, 2300]);
    expect(tracks[0].vx).toBeUndefined();
    expect(tracks[0].vz).toBeUndefined();
    expect(tracks[0].airspaces).toBeUndefined();

    // Invalid ground altitude (NO_GROUND_ALTITUDE = 9999) should be sanitized to alt
    expect(tracks[0].gndAlt).toEqual([1000, 2500, 1200]);

    // Available Y-axes for live track must only be Altitude
    expect(sel.chartAvailableYAxes(stateWithLive)).toEqual([ChartYAxis.Altitude]);

    // Chart time range should match live track
    expect(sel.chartMinTimeSec(stateWithLive)).toBe(2000);
    expect(sel.chartMaxTimeSec(stateWithLive)).toBe(2200);

    // Chart active track id
    expect(sel.chartActiveTrackId(stateWithLive)).toBe('42');

    // Sampling lat/lon/alt should sample from live track
    const coords = sel.getTrackLatLonAlt(stateWithLive)(2100);
    expect(coords).toEqual({
      lat: 45.5,
      lon: 6.5,
      alt: 2500,
    });
  });

  it('sanitizes live ground altitude correctly using getSanitizedLiveGroundAltitude', () => {
    const sanitized = sel.getSanitizedLiveGroundAltitude(liveTrack);
    expect(sanitized).toEqual([1000, 2500, 1200]);

    // Returns undefined if gndAlt is missing or mismatched length
    const noGnd: protos.LiveTrack = { ...liveTrack, gndAlt: undefined as any };
    expect(sel.getSanitizedLiveGroundAltitude(noGnd)).toBeUndefined();

    const mismatched: protos.LiveTrack = { ...liveTrack, gndAlt: [1000] };
    expect(sel.getSanitizedLiveGroundAltitude(mismatched)).toBeUndefined();
  });

  it('shows chart when only live track exists and no runtime tracks are loaded', () => {
    const stateOnlyLive = {
      ...baseState,
      track: {
        tracks: { ids: [], entities: {} },
        currentTrackId: undefined,
        fetching: false,
      },
      liveTrack: {
        ...baseState.liveTrack,
        currentLiveId: '42',
      },
    };

    expect(sel.numTracks(stateOnlyLive)).toBe(0);
    expect(sel.hasChartTrack(stateOnlyLive)).toBe(true);
    expect(sel.chartTracks(stateOnlyLive)).toHaveLength(1);
    expect(sel.chartTracks(stateOnlyLive)[0].id).toBe('42');
  });

  it('hides chart when no runtime tracks and no live track is selected', () => {
    const stateEmpty = {
      ...baseState,
      track: {
        tracks: { ids: [], entities: {} },
        currentTrackId: undefined,
        fetching: false,
      },
      liveTrack: {
        ...baseState.liveTrack,
        currentLiveId: undefined,
      },
    };

    expect(sel.hasChartTrack(stateEmpty)).toBe(false);
    expect(sel.chartTracks(stateEmpty)).toHaveLength(0);
  });

  describe('active track and dashboard selectors', () => {
    it('returns runtime track name, color, and dashboard data when runtime track is active', () => {
      expect(sel.hasActiveTrack(baseState)).toBe(true);
      expect(sel.isLiveTrackSelected(baseState)).toBe(false);
      expect(sel.activePilotName(baseState)).toBe('Pilot 1-0');
      expect(sel.activePilotColor(baseState)).toBe('#FF0000');

      // Sampled at timeSec = 1100 (halfway between 1000 and 1200)
      const data = sel.activeDashboardData(baseState);
      expect(data.hasTrack).toBe(true);
      expect(data.alt).toBe(1800);
      expect(data.gndAlt).toBe(1600);
      expect(data.vz).toBe(1);
      expect(data.vx).toBe(10);
      expect(data.timeSec).toBe(1100);
    });

    it('returns live track name, color, and dashboard data when live track is selected', () => {
      const stateWithLive = {
        ...baseState,
        app: {
          ...baseState.app,
          timeSec: 2000,
        },
        liveTrack: {
          ...baseState.liveTrack,
          currentLiveId: '42',
        },
      };

      expect(sel.hasActiveTrack(stateWithLive)).toBe(true);
      expect(sel.isLiveTrackSelected(stateWithLive)).toBe(true);
      expect(sel.activePilotName(stateWithLive)).toBe('Live Pilot 42');
      expect(sel.activePilotColor(stateWithLive)).toBeDefined();

      const data = sel.activeDashboardData(stateWithLive);
      expect(data.hasTrack).toBe(true);
      expect(data.alt).toBe(2200);
      expect(data.gndAlt).toBe(1000); // valid ground altitude at timeSec = 2000
      expect(data.vz).toBeUndefined(); // Live tracks do not have vz
      expect(data.vx).toBeUndefined(); // Live tracks do not have vx
      expect(data.timeSec).toBe(2000);
    });

    it('sanitizes NO_GROUND_ALTITUDE by falling back to alt and avoids blending with 9999', () => {
      // At timeSec = 2050 (between valid 1000 at 2000 and NO_GROUND_ALTITUDE at 2100, where alt is 2500),
      // the sanitized ground altitude is (1000 + 2500) / 2 = 1750, NOT (1000 + 9999) / 2 = 5499.5.
      const stateMidpoint = {
        ...baseState,
        app: {
          ...baseState.app,
          timeSec: 2050,
        },
        liveTrack: {
          ...baseState.liveTrack,
          currentLiveId: '42',
        },
      };

      const dataMid = sel.activeDashboardData(stateMidpoint);
      expect(dataMid.hasTrack).toBe(true);
      expect(dataMid.alt).toBe(2350); // midpoint of 2200 and 2500
      expect(dataMid.gndAlt).toBe(1750); // midpoint of 1000 and 2500 (sanitized from 9999)

      // At timeSec = 2100, gndAlt falls back to alt = 2500 (AGL = 0)
      const stateAtInvalid = {
        ...baseState,
        app: {
          ...baseState.app,
          timeSec: 2100,
        },
        liveTrack: {
          ...baseState.liveTrack,
          currentLiveId: '42',
        },
      };
      const dataAtInvalid = sel.activeDashboardData(stateAtInvalid);
      expect(dataAtInvalid.gndAlt).toBe(2500);

      // getGndAlt selector also uses sanitized values
      expect(sel.getGndAlt(stateMidpoint)(2050)).toBe(1750);
      expect(sel.getGndAlt(stateAtInvalid)(2100)).toBe(2500);
    });

    it('omits gndAlt when live track does not have ground altitudes', () => {
      const liveTrackNoGnd = createMockLiveTrack(99, [2000, 2100], [2200, 2500]);
      delete (liveTrackNoGnd as any).gndAlt;

      const stateNoGnd = {
        ...baseState,
        app: {
          ...baseState.app,
          timeSec: 2000,
        },
        liveTrack: {
          ...baseState.liveTrack,
          tracks: {
            ids: ['99'],
            entities: {
              '99': liveTrackNoGnd,
            },
          },
          currentLiveId: '99',
        },
      };

      const data = sel.activeDashboardData(stateNoGnd);
      expect(data.hasTrack).toBe(true);
      expect(data.alt).toBe(2200);
      expect(data.gndAlt).toBeUndefined();
      expect(sel.getGndAlt(stateNoGnd)(2000)).toBeUndefined();
    });

    it('returns hasTrack: false when neither live nor runtime track is active', () => {
      const stateEmpty = {
        ...baseState,
        track: {
          tracks: { ids: [], entities: {} },
          currentTrackId: undefined,
          fetching: false,
        },
        liveTrack: {
          ...baseState.liveTrack,
          currentLiveId: undefined,
        },
      };

      expect(sel.hasActiveTrack(stateEmpty)).toBe(false);
      expect(sel.activePilotName(stateEmpty)).toBeUndefined();
      const data = sel.activeDashboardData(stateEmpty);
      expect(data.hasTrack).toBe(false);
      expect(sel.getGndAlt(stateEmpty)(2000)).toBe(0);
    });
  });

  describe('getGndAlt selector', () => {
    const stateEmpty = {
      ...baseState,
      track: {
        tracks: { ids: [], entities: {} },
        currentTrackId: undefined,
        fetching: false,
      },
      liveTrack: {
        ...baseState.liveTrack,
        currentLiveId: undefined,
      },
    };

    it('returns 0 when there is no active or provided track', () => {
      expect(sel.getGndAlt(stateEmpty)(1000)).toBe(0);
    });

    it('returns 0 for runtime track without gndAlt', () => {
      const trackNoGnd = createMockRuntimeTrack('t-no-gnd', [1000, 1200], [1500, 1700]);
      delete (trackNoGnd as any).gndAlt;
      expect(sel.getGndAlt(stateEmpty)(1100, trackNoGnd)).toBe(0);
    });

    it('returns sampled ground altitude for runtime track with gndAlt', () => {
      const trackWithGnd = createMockRuntimeTrack('t-gnd', [1000, 1200], [1500, 1700]);
      // alt is 1500..1700, gndAlt is 1300..1500, sampled at 1100 -> 1400
      expect(sel.getGndAlt(stateEmpty)(1100, trackWithGnd)).toBe(1400);
    });

    it('returns undefined for live track without gndAlt', () => {
      const liveNoGnd = createMockLiveTrack(99, [2000, 2100], [2200, 2500]);
      delete (liveNoGnd as any).gndAlt;
      expect(sel.getGndAlt(stateEmpty)(2050, liveNoGnd)).toBeUndefined();
    });

    it('returns sampled ground altitude for live track with gndAlt', () => {
      const liveWithGnd = createMockLiveTrack(99, [2000, 2100], [2200, 2500], [1000, 1200]);
      expect(sel.getGndAlt(stateEmpty)(2050, liveWithGnd)).toBe(1100);
    });

    it('defaults to active live track or current runtime track from state', () => {
      // With baseState, currentTrack is track-1-0 with alt [1600, 2000] and gndAlt [1400, 1800]
      expect(sel.getGndAlt(baseState)(1100)).toBe(1600);

      // With active live track
      const stateWithLive = {
        ...baseState,
        liveTrack: {
          ...baseState.liveTrack,
          currentLiveId: '42',
        },
      };
      // Live track 42 has timeSec [2000, 2100], alt [2200, 2500], gndAlt [1000, NO_GROUND_ALTITUDE (sanitized to 2500)]
      expect(sel.getGndAlt(stateWithLive)(2050)).toBe(1750);
    });
  });

  describe('track selection mutual exclusion in store', () => {
    it('unselects currentTrackId when setCurrentLiveId is dispatched with a live id', () => {
      store.dispatch(setCurrentTrackId('track-1'));
      expect(store.getState().track.currentTrackId).toBe('track-1');

      store.dispatch(setCurrentLiveId('live-42'));
      expect(store.getState().liveTrack.currentLiveId).toBe('live-42');
      expect(store.getState().track.currentTrackId).toBeUndefined();
    });

    it('unselects currentLiveId when setCurrentTrackId is dispatched with a track id', () => {
      store.dispatch(setCurrentLiveId('live-42'));
      expect(store.getState().liveTrack.currentLiveId).toBe('live-42');

      store.dispatch(setCurrentTrackId('track-2'));
      expect(store.getState().track.currentTrackId).toBe('track-2');
      expect(store.getState().liveTrack.currentLiveId).toBeUndefined();
    });

    it('does not unselect currentLiveId when selectNextTrack is dispatched and no runtime tracks exist', () => {
      // Remove any runtime tracks from store
      store.dispatch(removeTracksByGroupIds([1, 2]));
      store.dispatch(setCurrentLiveId('live-42'));
      expect(store.getState().liveTrack.currentLiveId).toBe('live-42');

      store.dispatch(selectNextTrack());
      // When no runtime tracks exist, selectNextTrack does not change track selection or unselect live track
      expect(store.getState().liveTrack.currentLiveId).toBe('live-42');
      expect(store.getState().track.currentTrackId).toBeUndefined();
    });

    it('unselects currentLiveId when selectNextTrack successfully selects a runtime track', () => {
      // Add a runtime track to store
      store.dispatch(addTrackEntities([rtTrack]));
      store.dispatch(setCurrentLiveId('live-42'));
      expect(store.getState().liveTrack.currentLiveId).toBe('live-42');

      store.dispatch(selectNextTrack());
      expect(store.getState().track.currentTrackId).toBe(rtTrack.id);
      expect(store.getState().liveTrack.currentLiveId).toBeUndefined();
    });
  });

  describe('multiple runtime tracks and time offsets', () => {
    const trackDay1 = createMockRuntimeTrack('d1', [1000, 2000, 4000], [1000, 1500, 1200]);
    // 24 hours later
    const trackDay2 = createMockRuntimeTrack('d2', [100000, 102000, 105000], [1100, 1600, 1300]);

    it('handles single-day multiple runtime tracks with zero offsets', () => {
      const track1 = createMockRuntimeTrack('t1', [1000, 2000, 3000], [1000, 1500, 1200]);
      const track2 = createMockRuntimeTrack('t2', [1500, 2500, 3500], [1100, 1600, 1300]);
      const state: any = {
        ...baseState,
        track: {
          ...baseState.track,
          currentTrackId: 't1',
          tracks: {
            ids: ['t1', 't2'],
            entities: { t1: track1, t2: track2 },
          },
        },
      };

      expect(sel.isMultiDay(state)).toBe(false);
      const offsets = sel.offsetSeconds(state);
      expect(offsets).toEqual({ t1: 0, t2: 0 });
      expect(sel.minTimeSec(state)).toBe(1000);
      expect(sel.maxTimeSec(state)).toBe(3500);

      const cTracks = sel.chartTracks(state);
      expect(cTracks).toHaveLength(2);
      expect(cTracks[0].offsetSeconds).toBe(0);
      expect(cTracks[1].offsetSeconds).toBe(0);
    });

    it('computes correct offsets when first track is selected in multi-day scenario', () => {
      const state: any = {
        ...baseState,
        track: {
          ...baseState.track,
          currentTrackId: 'd1',
          tracks: {
            ids: ['d1', 'd2'],
            entities: { d1: trackDay1, d2: trackDay2 },
          },
        },
      };

      expect(sel.isMultiDay(state)).toBe(true);
      const offsets = sel.offsetSeconds(state);
      expect(offsets.d1).toBe(0);
      expect(offsets.d2).toBe(99000); // 100000 - 1000

      expect(sel.minTimeSec(state)).toBe(1000);
      // d1 max: 4000 - 0 = 4000; d2 max: 105000 - 99000 = 6000
      expect(sel.maxTimeSec(state)).toBe(6000);
      expect(Number.isNaN(sel.minTimeSec(state))).toBe(false);
      expect(Number.isNaN(sel.maxTimeSec(state))).toBe(false);

      const cTracks = sel.chartTracks(state);
      expect(cTracks).toHaveLength(2);
      expect(cTracks[0].offsetSeconds).toBe(0);
      expect(cTracks[1].offsetSeconds).toBe(99000);
    });

    it('recomputes offsets relative to second track when switched', () => {
      const state: any = {
        ...baseState,
        track: {
          ...baseState.track,
          currentTrackId: 'd2',
          tracks: {
            ids: ['d1', 'd2'],
            entities: { d1: trackDay1, d2: trackDay2 },
          },
        },
      };

      expect(sel.isMultiDay(state)).toBe(true);
      const offsets = sel.offsetSeconds(state);
      expect(offsets.d1).toBe(-99000); // 1000 - 100000
      expect(offsets.d2).toBe(0);

      expect(sel.minTimeSec(state)).toBe(100000);
      // d1 max: 4000 - (-99000) = 103000; d2 max: 105000 - 0 = 105000
      expect(sel.maxTimeSec(state)).toBe(105000);
      expect(Number.isNaN(sel.minTimeSec(state))).toBe(false);
      expect(Number.isNaN(sel.maxTimeSec(state))).toBe(false);

      const cTracks = sel.chartTracks(state);
      expect(cTracks[0].offsetSeconds).toBe(-99000);
      expect(cTracks[1].offsetSeconds).toBe(0);
    });

    it('does not produce NaN when currentTrackId is null/undefined', () => {
      const state: any = {
        ...baseState,
        track: {
          ...baseState.track,
          currentTrackId: undefined,
          tracks: {
            ids: ['d1', 'd2'],
            entities: { d1: trackDay1, d2: trackDay2 },
          },
        },
      };

      expect(sel.isMultiDay(state)).toBe(true);
      // Should fall back to tracks[0] as reference track
      const offsets = sel.offsetSeconds(state);
      expect(offsets.d1).toBe(0);
      expect(offsets.d2).toBe(99000);

      expect(sel.minTimeSec(state)).toBe(1000);
      expect(sel.maxTimeSec(state)).toBe(6000);
      expect(Number.isNaN(sel.minTimeSec(state))).toBe(false);
      expect(Number.isNaN(sel.maxTimeSec(state))).toBe(false);
      expect(Number.isNaN(sel.chartMinTimeSec(state))).toBe(false);
      expect(Number.isNaN(sel.chartMaxTimeSec(state))).toBe(false);
    });

    it('keeps runtime track offsets valid when a live track is selected', () => {
      const state: any = {
        ...baseState,
        track: {
          ...baseState.track,
          currentTrackId: undefined,
          tracks: {
            ids: ['d1', 'd2'],
            entities: { d1: trackDay1, d2: trackDay2 },
          },
        },
        liveTrack: {
          ...baseState.liveTrack,
          currentLiveId: '42',
        },
      };

      // Live track is rendered on chart
      const cTracks = sel.chartTracks(state);
      expect(cTracks).toHaveLength(1);
      expect(cTracks[0].isLive).toBe(true);
      expect(sel.chartMinTimeSec(state)).toBe(2000);
      expect(sel.chartMaxTimeSec(state)).toBe(2200);

      // Runtime track offsets remain valid for 2D/3D map markers
      const offsets = sel.offsetSeconds(state);
      expect(offsets.d1).toBe(0);
      expect(offsets.d2).toBe(99000);
      expect(Number.isNaN(offsets.d1)).toBe(false);
      expect(Number.isNaN(offsets.d2)).toBe(false);
    });

    it('renders only the last segment of a live track on the chart when there are gaps', () => {
      // Live track with 2 segments separated by a 2-hour gap (> TRACK_GAP_MIN = 60min)
      const liveTrackWithGap = createMockLiveTrack(
        99,
        [1000, 1100, 10000, 10100], // gap: 10000 - 1100 = 8900s (> 3600s)
        [500, 600, 1500, 1600],
        [400, 500, 1200, 1300],
      );

      const state: any = {
        ...baseState,
        liveTrack: {
          ...baseState.liveTrack,
          currentLiveId: '99',
          tracks: {
            ids: ['99'],
            entities: { '99': liveTrackWithGap },
          },
        },
        app: {
          ...baseState.app,
          timeSec: 10050,
        },
      };

      // activeLiveTrack should only have the points of the last segment
      const active = sel.activeLiveTrack(state);
      expect(active).toBeDefined();
      expect(active?.timeSec).toEqual([10000, 10100]);
      expect(active?.alt).toEqual([1500, 1600]);
      expect(active?.gndAlt).toEqual([1200, 1300]);

      // chartTracks should only have the last segment
      const cTracks = sel.chartTracks(state);
      expect(cTracks).toHaveLength(1);
      expect(cTracks[0].timeSec).toEqual([10000, 10100]);
      expect(cTracks[0].alt).toEqual([1500, 1600]);
      expect(cTracks[0].minTimeSec).toBe(10000);
      expect(cTracks[0].maxTimeSec).toBe(10100);

      // chart min/max time should reflect only the last segment
      expect(sel.chartMinTimeSec(state)).toBe(10000);
      expect(sel.chartMaxTimeSec(state)).toBe(10100);

      // dashboard should sample on the active segment
      const dash = sel.activeDashboardData(state);
      expect(dash.hasTrack).toBe(true);
      expect(dash.alt).toBe(1550);
      expect(dash.gndAlt).toBe(1250);
    });
  });

  describe('chart bounds and time synchronization', () => {
    it('computes chartMinY with sanitized ground altitudes for live tracks', () => {
      const liveTrack = createMockLiveTrack(42, [2000, 2100], [2200, 2500], [1000, NO_GROUND_ALTITUDE]);
      const stateWithLive: any = {
        ...baseState,
        liveTrack: {
          ...baseState.liveTrack,
          currentLiveId: '42',
          tracks: {
            ids: ['42'],
            entities: { '42': liveTrack },
          },
        },
      };

      // Altitudes are 2200 and 2500, ground altitudes are 1000 and sanitized 2500 -> min should be 1000
      expect(sel.chartMinY(stateWithLive)).toBe(1000);
      expect(sel.chartMaxY(stateWithLive)).toBe(2500);
    });

    it('does not overwrite app time when a live track is selected', () => {
      const testStore: any = {
        getState: () => ({
          track: { tracks: { ids: [] } },
          liveTrack: { currentLiveId: 'live-42' },
          app: { timeSec: 12345 },
        }),
        dispatch: vi.fn(),
      };

      updateAppTime(testStore);
      expect(testStore.dispatch).not.toHaveBeenCalled();
    });

    it('updates app time to current clock time when no runtime and no live tracks are selected', () => {
      const testStore: any = {
        getState: () => ({
          track: { tracks: { ids: [] } },
          liveTrack: { currentLiveId: undefined },
          app: { timeSec: 12345 },
        }),
        dispatch: vi.fn(),
      };

      updateAppTime(testStore);
      expect(testStore.dispatch).toHaveBeenCalled();
    });
  });
});
