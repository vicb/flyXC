import { describe, expect, it } from 'vitest';

import * as protos from '../protos';
import { LiveTrackFlag } from './live-track';
import { filterLiveTrackOutliers } from './live-track-filter';

// Helper to create a LiveTrack from array of [lat, lon, timeSec]
function createTestTrack(
  points: [number, number, number][],
  extra?: { [key: number]: protos.LiveExtra },
  flags?: number[],
): protos.LiveTrack {
  return protos.LiveTrack.create({
    lat: points.map((p) => p[0]),
    lon: points.map((p) => p[1]),
    timeSec: points.map((p) => p[2]),
    alt: points.map(() => 1500),
    flags: flags ?? points.map(() => LiveTrackFlag.Valid),
    extra: extra ?? {},
  });
}

// Bir Billing coordinates ~ (32.05, 76.7)
const BIR_LAT = 32.05;
const BIR_LON = 76.7;

// Punjab outlier coordinates ~ (31.5, 75.1) (~150 km west)
const PUNJAB_LAT = 31.5;
const PUNJAB_LON = 75.1;

describe('filterLiveTrackOutliers', () => {
  it('returns empty track unchanged', () => {
    const track = createTestTrack([]);
    const result = filterLiveTrackOutliers(track);
    expect(result.track.timeSec).toEqual([]);
    expect(result.locationConfidence).toBe(protos.TrackLocationConfidence.UNKNOWN);
  });

  it('keeps fixes tentative when track has fewer than 5 fixes', () => {
    // 3 fixes with an outlier: Punjab (t=0), Bir (t=60), Bir (t=120)
    const track = createTestTrack([
      [PUNJAB_LAT, PUNJAB_LON, 0],
      [BIR_LAT, BIR_LON, 60],
      [BIR_LAT + 0.001, BIR_LON + 0.001, 120],
    ]);

    const result = filterLiveTrackOutliers(track);
    // Not enough fixes to establish confidence: keeps all 3 fixes tentatively
    expect(result.track.timeSec.length).toBe(3);
    expect(result.locationConfidence).toBe(protos.TrackLocationConfidence.UNCONFIRMED);
    expect(result.lastOutlierFixSec).toBeUndefined();
  });

  it('establishes confidence for 5 clean fixes', () => {
    const track = createTestTrack([
      [BIR_LAT, BIR_LON, 0],
      [BIR_LAT + 0.001, BIR_LON, 60],
      [BIR_LAT + 0.002, BIR_LON, 120],
      [BIR_LAT + 0.003, BIR_LON, 180],
      [BIR_LAT + 0.004, BIR_LON, 240],
    ]);

    const result = filterLiveTrackOutliers(track);
    expect(result.track.timeSec.length).toBe(5);
    expect(result.locationConfidence).toBe(protos.TrackLocationConfidence.KNOWN);
    expect(result.lastOutlierFixSec).toBeUndefined();
  });

  it('establishes confidence for stationary pilot on takeoff (0 distance movement)', () => {
    const track = createTestTrack([
      [BIR_LAT, BIR_LON, 0],
      [BIR_LAT, BIR_LON, 60],
      [BIR_LAT, BIR_LON, 120],
      [BIR_LAT, BIR_LON, 180],
      [BIR_LAT, BIR_LON, 240],
    ]);

    const result = filterLiveTrackOutliers(track);
    expect(result.track.timeSec.length).toBe(5);
    expect(result.locationConfidence).toBe(protos.TrackLocationConfidence.KNOWN);
  });

  it('prunes cold start outlier at fix 1 once confidence is reached', () => {
    // Fix 1 at Punjab, followed by 5 fixes at Bir
    const track = createTestTrack([
      [PUNJAB_LAT, PUNJAB_LON, 0],
      [BIR_LAT, BIR_LON, 60],
      [BIR_LAT + 0.001, BIR_LON, 120],
      [BIR_LAT + 0.002, BIR_LON, 180],
      [BIR_LAT + 0.003, BIR_LON, 240],
      [BIR_LAT + 0.004, BIR_LON, 300],
    ]);

    const result = filterLiveTrackOutliers(track);
    expect(result.locationConfidence).toBe(protos.TrackLocationConfidence.KNOWN);
    expect(result.lastOutlierFixSec).toBe(0);
    // Punjab fix pruned; 5 Bir fixes remain
    expect(result.track.timeSec).toEqual([60, 120, 180, 240, 300]);
    expect(result.track.lat[0]).toBeCloseTo(BIR_LAT);
  });

  it('keeps track tentative when clusters cannot reach consensus ratio', () => {
    // 5 fixes in Punjab, 5 fixes in Bir -> Neither cluster reaches 5:1 ratio (needs >= 9 out of 10)
    const points: [number, number, number][] = [];
    for (let i = 0; i < 5; i++) {
      points.push([PUNJAB_LAT + i * 0.001, PUNJAB_LON, i * 60]);
    }
    for (let i = 0; i < 5; i++) {
      points.push([BIR_LAT + i * 0.001, BIR_LON, 300 + i * 60]);
    }
    const track = createTestTrack(points);

    const result = filterLiveTrackOutliers(track);
    expect(result.locationConfidence).toBe(protos.TrackLocationConfidence.UNCONFIRMED);
    expect(result.track.timeSec.length).toBe(10);
    expect(result.lastOutlierFixSec).toBeUndefined();
  });

  it('prunes multi-fix cold start cluster when consensus is reached', () => {
    // 2 Punjab fixes at start, followed by 10 Bir fixes (10 >= 5 * 2)
    const points: [number, number, number][] = [
      [PUNJAB_LAT, PUNJAB_LON, 0],
      [PUNJAB_LAT + 0.001, PUNJAB_LON, 60],
    ];
    for (let i = 0; i < 10; i++) {
      points.push([BIR_LAT + i * 0.001, BIR_LON, 120 + i * 60]);
    }
    const track = createTestTrack(points);

    const result = filterLiveTrackOutliers(track);
    expect(result.locationConfidence).toBe(protos.TrackLocationConfidence.KNOWN);
    expect(result.lastOutlierFixSec).toBe(60);
    expect(result.track.timeSec.length).toBe(10);
    expect(result.track.timeSec[0]).toBe(120);
  });

  it('handles alternating outliers at start of track', () => {
    // Bir at 0, 60, 120, 180, 240 (5 fixes)
    // Punjab at 30 (1 fix)
    const track = createTestTrack([
      [BIR_LAT, BIR_LON, 0],
      [PUNJAB_LAT, PUNJAB_LON, 30],
      [BIR_LAT + 0.001, BIR_LON, 60],
      [BIR_LAT + 0.002, BIR_LON, 120],
      [BIR_LAT + 0.003, BIR_LON, 180],
      [BIR_LAT + 0.004, BIR_LON, 240],
    ]);

    const result = filterLiveTrackOutliers(track);
    expect(result.locationConfidence).toBe(protos.TrackLocationConfidence.KNOWN);
    expect(result.lastOutlierFixSec).toBe(30);
    expect(result.track.timeSec).toEqual([0, 60, 120, 180, 240]);
  });

  it('correctly reindexes extra metadata when outliers are pruned', () => {
    const extra: { [key: number]: protos.LiveExtra } = {
      0: protos.LiveExtra.create({ message: 'Bad fix msg' }),
      2: protos.LiveExtra.create({ message: 'Good fix msg' }),
    };

    const track = createTestTrack(
      [
        [PUNJAB_LAT, PUNJAB_LON, 0], // idx 0: will be dropped
        [BIR_LAT, BIR_LON, 60], // idx 1: will become new idx 0
        [BIR_LAT + 0.001, BIR_LON, 120], // idx 2: will become new idx 1
        [BIR_LAT + 0.002, BIR_LON, 180], // idx 3: new idx 2
        [BIR_LAT + 0.003, BIR_LON, 240], // idx 4: new idx 3
        [BIR_LAT + 0.004, BIR_LON, 300], // idx 5: new idx 4
      ],
      extra,
    );

    const result = filterLiveTrackOutliers(track);
    expect(result.track.extra?.[1]?.message).toBe('Good fix msg');
    expect(result.track.extra?.[0]).toBeUndefined();
  });

  it('drops mid-flight multi-point outlier cluster (RohitK pattern) in confident mode', () => {
    // 5 initial clean fixes at Bir establishing confidence
    const points: [number, number, number][] = [
      [BIR_LAT, BIR_LON, 0],
      [BIR_LAT + 0.001, BIR_LON, 60],
      [BIR_LAT + 0.002, BIR_LON, 120],
      [BIR_LAT + 0.003, BIR_LON, 180],
      [BIR_LAT + 0.004, BIR_LON, 240],
    ];

    // Followed by 3 bad fixes in Punjab (150km away) arriving mid-flight
    points.push([PUNJAB_LAT, PUNJAB_LON, 300], [PUNJAB_LAT + 0.001, PUNJAB_LON, 360], [PUNJAB_LAT, PUNJAB_LON, 420]);

    // Followed by 1 valid Bir fix
    points.push([BIR_LAT + 0.005, BIR_LON, 480]);

    const track = createTestTrack(points);

    // Running with state where confidence was already established
    const result = filterLiveTrackOutliers(track, {
      locationConfidence: protos.TrackLocationConfidence.KNOWN,
    });

    expect(result.locationConfidence).toBe(protos.TrackLocationConfidence.KNOWN);
    expect(result.lastOutlierFixSec).toBe(420);
    // All 3 Punjab fixes dropped; 6 Bir fixes kept
    expect(result.track.timeSec).toEqual([0, 60, 120, 180, 240, 480]);
  });

  it('resets confidence on time gap > 1h allowing relocation', () => {
    // Flight 1 at Bir (5 points)
    const points: [number, number, number][] = [
      [BIR_LAT, BIR_LON, 0],
      [BIR_LAT + 0.001, BIR_LON, 60],
      [BIR_LAT + 0.002, BIR_LON, 120],
      [BIR_LAT + 0.003, BIR_LON, 180],
      [BIR_LAT + 0.004, BIR_LON, 240],
    ];

    // Gap of 2 hours (> LIVE_GAP_RESET_SEC = 3600s), pilot moved 50km to Dharamshala
    const DHARAMSHALA_LAT = 32.22;
    const DHARAMSHALA_LON = 76.32;
    const tStart2 = 240 + 7200;

    // Only 2 points at Dharamshala so far
    points.push([DHARAMSHALA_LAT, DHARAMSHALA_LON, tStart2]);
    points.push([DHARAMSHALA_LAT + 0.001, DHARAMSHALA_LON, tStart2 + 60]);

    const track = createTestTrack(points);

    // State previously had confidence from Flight 1 (session started at 0)
    const result = filterLiveTrackOutliers(track, {
      locationConfidence: protos.TrackLocationConfidence.KNOWN,
      lastSessionStartSec: 0,
    });

    // Gap > 1h resets confidence for the new session (< 5 fixes)
    expect(result.locationConfidence).toBe(protos.TrackLocationConfidence.UNCONFIRMED);
    // Dharamshala points are preserved tentatively
    expect(result.track.timeSec.length).toBe(7);

    // Once 5 Dharamshala points accumulate:
    points.push([DHARAMSHALA_LAT + 0.002, DHARAMSHALA_LON, tStart2 + 120]);
    points.push([DHARAMSHALA_LAT + 0.003, DHARAMSHALA_LON, tStart2 + 180]);
    points.push([DHARAMSHALA_LAT + 0.004, DHARAMSHALA_LON, tStart2 + 240]);

    const fullTrack = createTestTrack(points);
    const result2 = filterLiveTrackOutliers(fullTrack, {
      locationConfidence: protos.TrackLocationConfidence.UNCONFIRMED,
      lastSessionStartSec: 0,
    });

    // New session now reaches confidence!
    expect(result2.locationConfidence).toBe(protos.TrackLocationConfidence.KNOWN);
    expect(result2.lastSessionStartSec).toBe(tStart2);
    expect(result2.track.timeSec.length).toBe(10);

    // Subsequent cycle in the same session stays KNOWN (Phase 2)
    points.push([DHARAMSHALA_LAT + 0.005, DHARAMSHALA_LON, tStart2 + 300]);
    const trackWithNext = createTestTrack(points);
    const result3 = filterLiveTrackOutliers(trackWithNext, {
      locationConfidence: result2.locationConfidence,
      lastSessionStartSec: result2.lastSessionStartSec,
    });
    expect(result3.locationConfidence).toBe(protos.TrackLocationConfidence.KNOWN);
    expect(result3.lastSessionStartSec).toBe(tStart2);
    expect(result3.track.timeSec.length).toBe(11);
  });

  it('re-validates new session after a gap when backlog arrives with >= 5 fixes and first fix is a glitch', () => {
    // Flight 1 at Bir (5 points)
    const points: [number, number, number][] = [
      [BIR_LAT, BIR_LON, 0],
      [BIR_LAT + 0.001, BIR_LON, 60],
      [BIR_LAT + 0.002, BIR_LON, 120],
      [BIR_LAT + 0.003, BIR_LON, 180],
      [BIR_LAT + 0.004, BIR_LON, 240],
    ];

    // Tracker offline for 2 hours, then delivers backlog of 6 points at Dharamshala:
    // First fix is a cold-lock GPS glitch in Punjab!
    const tStart2 = 240 + 7200;
    const DHARAMSHALA_LAT = 32.22;
    const DHARAMSHALA_LON = 76.32;

    points.push([PUNJAB_LAT, PUNJAB_LON, tStart2]); // glitch at sessionStart!
    points.push([DHARAMSHALA_LAT, DHARAMSHALA_LON, tStart2 + 60]);
    points.push([DHARAMSHALA_LAT + 0.001, DHARAMSHALA_LON, tStart2 + 120]);
    points.push([DHARAMSHALA_LAT + 0.002, DHARAMSHALA_LON, tStart2 + 180]);
    points.push([DHARAMSHALA_LAT + 0.003, DHARAMSHALA_LON, tStart2 + 240]);
    points.push([DHARAMSHALA_LAT + 0.004, DHARAMSHALA_LON, tStart2 + 300]);

    const track = createTestTrack(points);

    // Filter runs with state carrying confidence from Flight 1
    const result = filterLiveTrackOutliers(track, {
      locationConfidence: protos.TrackLocationConfidence.KNOWN,
      lastSessionStartSec: 0,
    });

    // New session start timestamp (tStart2) differs from lastSessionStartSec (0),
    // so confidence resets to UNCONFIRMED, Phase 1 detects consensus on fixes 1..5,
    // prunes the Punjab glitch at sessionStart, and transitions to KNOWN!
    expect(result.locationConfidence).toBe(protos.TrackLocationConfidence.KNOWN);
    expect(result.lastOutlierFixSec).toBe(tStart2);
    // Punjab fix pruned: 5 Bir + 5 Dharamshala = 10 fixes
    expect(result.track.timeSec.length).toBe(10);
    // Valid session start timestamp is recorded as tStart2 + 60
    expect(result.lastSessionStartSec).toBe(tStart2 + 60);

    // Subsequent cycle: new Dharamshala point arrives
    points.push([DHARAMSHALA_LAT + 0.005, DHARAMSHALA_LON, tStart2 + 360]);
    const nextTrack = createTestTrack(points);
    const result2 = filterLiveTrackOutliers(nextTrack, {
      locationConfidence: result.locationConfidence,
      lastSessionStartSec: result.lastSessionStartSec,
      lastOutlierFixSec: result.lastOutlierFixSec,
    });

    // Stays in KNOWN mode, Phase 2 checks new point against valid anchor
    expect(result2.locationConfidence).toBe(protos.TrackLocationConfidence.KNOWN);
    expect(result2.track.timeSec.length).toBe(11);
  });

  describe('filterFromSec option', () => {
    it('skips already validated fixes and checks new fixes against preceding anchor in Phase 2', () => {
      // 5 valid fixes
      const points: [number, number, number][] = [
        [45.0, 6.0, 0],
        [45.001, 6.0, 60],
        [45.002, 6.0, 120],
        [45.003, 6.0, 180],
        [45.004, 6.0, 240],
        // New outlier jump added at t=300
        [46.0, 6.0, 300],
      ];
      const track = createTestTrack(points);

      const result = filterLiveTrackOutliers(track, {
        locationConfidence: protos.TrackLocationConfidence.KNOWN,
        lastSessionStartSec: 0,
        filterFromSec: 300,
      });

      expect(result.locationConfidence).toBe(protos.TrackLocationConfidence.KNOWN);
      expect(result.track.timeSec).toEqual([0, 60, 120, 180, 240]);
      expect(result.lastOutlierFixSec).toBe(300);
    });

    it('keeps valid new fixes when filterFromSec is used', () => {
      const points: [number, number, number][] = [
        [45.0, 6.0, 0],
        [45.001, 6.0, 60],
        [45.002, 6.0, 120],
        [45.003, 6.0, 180],
        [45.004, 6.0, 240],
        // Valid new fix added at t=300
        [45.005, 6.0, 300],
      ];
      const track = createTestTrack(points);

      const result = filterLiveTrackOutliers(track, {
        locationConfidence: protos.TrackLocationConfidence.KNOWN,
        lastSessionStartSec: 0,
        filterFromSec: 300,
      });

      expect(result.locationConfidence).toBe(protos.TrackLocationConfidence.KNOWN);
      expect(result.track.timeSec).toEqual([0, 60, 120, 180, 240, 300]);
    });

    it('falls back to sessionStart + 1 if filterFromSec is at or before sessionStartSec', () => {
      const points: [number, number, number][] = [
        [45.0, 6.0, 0],
        [46.0, 6.0, 60], // outlier
        [45.002, 6.0, 120],
      ];
      const track = createTestTrack(points);

      const result = filterLiveTrackOutliers(track, {
        locationConfidence: protos.TrackLocationConfidence.KNOWN,
        lastSessionStartSec: 0,
        filterFromSec: 0,
      });

      expect(result.locationConfidence).toBe(protos.TrackLocationConfidence.KNOWN);
      expect(result.track.timeSec).toEqual([0, 120]);
      expect(result.lastOutlierFixSec).toBe(60);
      expect(result.track.lastOutlierFixSec).toBe(60);
    });

    it('defaults lastOutlierFixSec from track.lastOutlierFixSec when not provided in options', () => {
      const points: [number, number, number][] = [
        [45.0, 6.0, 0],
        [45.001, 6.0, 60],
        [45.002, 6.0, 120],
        [45.003, 6.0, 180],
        [45.004, 6.0, 240],
      ];
      const track = createTestTrack(points);
      track.lastOutlierFixSec = 50;

      const result = filterLiveTrackOutliers(track, {
        locationConfidence: protos.TrackLocationConfidence.KNOWN,
        lastSessionStartSec: 0,
      });

      expect(result.lastOutlierFixSec).toBe(50);
      expect(result.track.lastOutlierFixSec).toBe(50);
    });

    it('prunes invalid fixes and does not let them act as anchors in Phase 2', () => {
      const points: [number, number, number][] = [
        [45.0, 6.0, 0], // valid anchor
        [45.001, 6.0, 60], // invalid fix with plausible coords
        [45.002, 6.0, 120], // valid fix
      ];
      const flags = [LiveTrackFlag.Valid, 0, LiveTrackFlag.Valid];
      const track = createTestTrack(points, undefined, flags);

      const result = filterLiveTrackOutliers(track, {
        locationConfidence: protos.TrackLocationConfidence.KNOWN,
        lastSessionStartSec: 0,
      });

      expect(result.track.timeSec).toEqual([0, 120]);
      expect(result.lastOutlierFixSec).toBe(60);
    });
  });

  describe('Edge cases and review fixes', () => {
    it('establishes confidence across antimeridian / dateline crossings', () => {
      // 5 consecutive fixes crossing longitude 180 (from 179.99 to -179.99)
      const points: [number, number, number][] = [
        [0.0, 179.98, 0],
        [0.0, 179.99, 60],
        [0.0, -179.99, 120],
        [0.0, -179.98, 180],
        [0.0, -179.97, 240],
      ];
      const track = createTestTrack(points);

      const result = filterLiveTrackOutliers(track);
      expect(result.locationConfidence).toBe(protos.TrackLocationConfidence.KNOWN);
      expect(result.track.timeSec).toEqual([0, 60, 120, 180, 240]);
    });

    it('excludes invalid fixes from consensus chain in Phase 1', () => {
      // 5 valid fixes and 1 invalid fix with valid-looking coordinates
      const points: [number, number, number][] = [
        [BIR_LAT, BIR_LON, 0],
        [BIR_LAT + 0.001, BIR_LON, 60],
        [BIR_LAT + 0.002, BIR_LON, 120], // invalid flag
        [BIR_LAT + 0.003, BIR_LON, 180],
        [BIR_LAT + 0.004, BIR_LON, 240],
        [BIR_LAT + 0.005, BIR_LON, 300],
      ];
      const flags = [
        LiveTrackFlag.Valid,
        LiveTrackFlag.Valid,
        0, // invalid GPS
        LiveTrackFlag.Valid,
        LiveTrackFlag.Valid,
        LiveTrackFlag.Valid,
      ];
      const track = createTestTrack(points, undefined, flags);

      const result = filterLiveTrackOutliers(track);
      expect(result.locationConfidence).toBe(protos.TrackLocationConfidence.KNOWN);
      // The invalid fix at t=120 must be pruned
      expect(result.track.timeSec).toEqual([0, 60, 180, 240, 300]);
    });

    it('increments lastOutlierFixSec monotonically when pruned fix timestamp <= existing marker', () => {
      // Existing marker is at 500
      const existingMarker = 500;
      // An outlier fix occurs at t=300 (before existing marker)
      const points: [number, number, number][] = [
        [BIR_LAT, BIR_LON, 0],
        [BIR_LAT + 0.001, BIR_LON, 60],
        [BIR_LAT + 0.002, BIR_LON, 120],
        [BIR_LAT + 0.003, BIR_LON, 180],
        [BIR_LAT + 0.004, BIR_LON, 240],
        [PUNJAB_LAT, PUNJAB_LON, 300], // outlier fix <= 500
      ];
      const track = createTestTrack(points);

      const result = filterLiveTrackOutliers(track, {
        locationConfidence: protos.TrackLocationConfidence.KNOWN,
        lastSessionStartSec: 0,
        lastOutlierFixSec: existingMarker,
      });

      // Outlier pruned
      expect(result.track.timeSec).toEqual([0, 60, 120, 180, 240]);
      // Marker must be strictly greater than existingMarker so the client detects the new prune event
      expect(result.lastOutlierFixSec).toBe(501);
      expect(result.track.lastOutlierFixSec).toBe(501);
    });

    it('resets confidence across retention when sessionStart is 0 but start timestamp differs', () => {
      // Track retention trimmed earlier fixes; now sessionStart === 0 at t=3600
      const points: [number, number, number][] = [
        [BIR_LAT, BIR_LON, 3600],
        [BIR_LAT + 0.001, BIR_LON, 3660],
      ];
      const track = createTestTrack(points);

      // Previously confidence was established for a session starting at t=0
      const result = filterLiveTrackOutliers(track, {
        locationConfidence: protos.TrackLocationConfidence.KNOWN,
        lastSessionStartSec: 0,
      });

      // Since lastSessionStartSec (0) !== current sessionStartSec (3600), confidence resets
      // and with only 2 fixes, the track remains UNCONFIRMED
      expect(result.locationConfidence).toBe(protos.TrackLocationConfidence.UNCONFIRMED);
    });

    it('handles noisy session with quadratic bound correctly', () => {
      // 10 valid fixes interspersed with 2 outliers (total 12 fixes)
      const points: [number, number, number][] = [
        [BIR_LAT, BIR_LON, 0],
        [BIR_LAT + 0.001, BIR_LON, 60],
        [PUNJAB_LAT, PUNJAB_LON, 120], // outlier 1
        [BIR_LAT + 0.002, BIR_LON, 180],
        [BIR_LAT + 0.003, BIR_LON, 240],
        [PUNJAB_LAT, PUNJAB_LON, 300], // outlier 2
        [BIR_LAT + 0.004, BIR_LON, 360],
        [BIR_LAT + 0.005, BIR_LON, 420],
        [BIR_LAT + 0.006, BIR_LON, 480],
        [BIR_LAT + 0.007, BIR_LON, 540],
        [BIR_LAT + 0.008, BIR_LON, 600],
        [BIR_LAT + 0.009, BIR_LON, 660],
      ];
      const track = createTestTrack(points);

      const result = filterLiveTrackOutliers(track);
      expect(result.locationConfidence).toBe(protos.TrackLocationConfidence.KNOWN);
      expect(result.track.timeSec).toEqual([0, 60, 180, 240, 360, 420, 480, 540, 600, 660]);
    });
  });
});
