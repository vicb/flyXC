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
    expect(result.timeSec).toEqual([]);
    expect(result.lastOutlierFixSec).toBeUndefined();
  });

  it('keeps fixes tentative when track has fewer than 5 fixes', () => {
    // 3 fixes with an outlier: Punjab (t=0), Bir (t=60), Bir (t=120)
    const track = createTestTrack([
      [PUNJAB_LAT, PUNJAB_LON, 0],
      [BIR_LAT, BIR_LON, 60],
      [BIR_LAT + 0.001, BIR_LON + 0.001, 120],
    ]);

    const result = filterLiveTrackOutliers(track);
    expect(result.timeSec).toEqual([0, 60, 120]);
    expect(result.lastOutlierFixSec).toBeUndefined();
  });

  it('keeps 5 clean fixes unchanged', () => {
    const track = createTestTrack([
      [BIR_LAT, BIR_LON, 0],
      [BIR_LAT + 0.001, BIR_LON, 60],
      [BIR_LAT + 0.002, BIR_LON, 120],
      [BIR_LAT + 0.003, BIR_LON, 180],
      [BIR_LAT + 0.004, BIR_LON, 240],
    ]);

    const result = filterLiveTrackOutliers(track);
    expect(result).toBe(track);
    expect(result.timeSec.length).toBe(5);
    expect(result.lastOutlierFixSec).toBeUndefined();
  });

  it('handles stationary pilot on takeoff (0 distance movement)', () => {
    const track = createTestTrack([
      [BIR_LAT, BIR_LON, 0],
      [BIR_LAT, BIR_LON, 60],
      [BIR_LAT, BIR_LON, 120],
      [BIR_LAT, BIR_LON, 180],
      [BIR_LAT, BIR_LON, 240],
    ]);

    const result = filterLiveTrackOutliers(track);
    expect(result.timeSec.length).toBe(5);
    expect(result.lastOutlierFixSec).toBeUndefined();
  });

  it('prunes cold-start outlier at fix 1 once 5 valid fixes arrive', () => {
    const track = createTestTrack([
      [PUNJAB_LAT, PUNJAB_LON, 0],
      [BIR_LAT, BIR_LON, 60],
      [BIR_LAT + 0.001, BIR_LON, 120],
      [BIR_LAT + 0.002, BIR_LON, 180],
      [BIR_LAT + 0.003, BIR_LON, 240],
      [BIR_LAT + 0.004, BIR_LON, 300],
    ]);

    const result = filterLiveTrackOutliers(track);
    expect(result.lastOutlierFixSec).toBe(0);
    expect(result.timeSec).toEqual([60, 120, 180, 240, 300]);
    expect(result.lat[0]).toBeCloseTo(BIR_LAT);
  });

  it('prunes multi-fix cold-start outlier cluster once 3x valid fixes arrive', () => {
    // 2 Punjab fixes at start: requires 3 * 2 = 6 Bir fixes to reach 3x confidence ratio
    const points: [number, number, number][] = [
      [PUNJAB_LAT, PUNJAB_LON, 0],
      [PUNJAB_LAT + 0.001, PUNJAB_LON, 60],
    ];
    for (let i = 0; i < 5; i++) {
      points.push([BIR_LAT + i * 0.001, BIR_LON, 120 + i * 60]);
    }
    // 5 vs 2 (< 3x): still tentative
    const tentative = filterLiveTrackOutliers(createTestTrack(points));
    expect(tentative.timeSec.length).toBe(7);
    expect(tentative.lastOutlierFixSec).toBeUndefined();

    // 6th Bir fix (6 >= 3 * 2): prunes the 2 Punjab fixes
    points.push([BIR_LAT + 0.005, BIR_LON, 420]);
    const result = filterLiveTrackOutliers(createTestTrack(points));
    expect(result.lastOutlierFixSec).toBe(60);
    expect(result.timeSec).toEqual([120, 180, 240, 300, 360, 420]);
  });

  it('handles alternating outliers at start of track', () => {
    const track = createTestTrack([
      [BIR_LAT, BIR_LON, 0],
      [PUNJAB_LAT, PUNJAB_LON, 30],
      [BIR_LAT + 0.001, BIR_LON, 60],
      [BIR_LAT + 0.002, BIR_LON, 120],
      [BIR_LAT + 0.003, BIR_LON, 180],
      [BIR_LAT + 0.004, BIR_LON, 240],
    ]);

    const result = filterLiveTrackOutliers(track);
    expect(result.lastOutlierFixSec).toBe(30);
    expect(result.timeSec).toEqual([0, 60, 120, 180, 240]);
  });

  it('correctly reindexes extra metadata when outliers are pruned', () => {
    const extra: { [key: number]: protos.LiveExtra } = {
      0: protos.LiveExtra.create({ speed: 123 }),
      2: protos.LiveExtra.create({ message: 'Good fix msg' }),
    };

    const track = createTestTrack(
      [
        [PUNJAB_LAT, PUNJAB_LON, 0], // idx 0: dropped
        [BIR_LAT, BIR_LON, 60], // idx 1 -> 0
        [BIR_LAT + 0.001, BIR_LON, 120], // idx 2 -> 1
        [BIR_LAT + 0.002, BIR_LON, 180], // idx 3 -> 2
        [BIR_LAT + 0.003, BIR_LON, 240], // idx 4 -> 3
        [BIR_LAT + 0.004, BIR_LON, 300], // idx 5 -> 4
      ],
      extra,
    );

    const result = filterLiveTrackOutliers(track);
    expect(result.extra?.[1]?.message).toBe('Good fix msg');
    expect(result.extra?.[0]).toBeUndefined();
  });

  it('drops mid-flight multi-point outlier cluster (RohitK pattern)', () => {
    const points: [number, number, number][] = [
      [BIR_LAT, BIR_LON, 0],
      [BIR_LAT + 0.001, BIR_LON, 60],
      [BIR_LAT + 0.002, BIR_LON, 120],
      [BIR_LAT + 0.003, BIR_LON, 180],
      [BIR_LAT + 0.004, BIR_LON, 240],
      // 3 bad fixes in Punjab (150km away) arriving mid-flight
      [PUNJAB_LAT, PUNJAB_LON, 300],
      [PUNJAB_LAT + 0.001, PUNJAB_LON, 360],
      [PUNJAB_LAT, PUNJAB_LON, 420],
      // Followed by 1 valid Bir fix
      [BIR_LAT + 0.005, BIR_LON, 480],
    ];

    const result = filterLiveTrackOutliers(createTestTrack(points));
    expect(result.lastOutlierFixSec).toBe(420);
    expect(result.timeSec).toEqual([0, 60, 120, 180, 240, 480]);
  });

  it('starts a new session on time gap > 1h allowing relocation', () => {
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

    // Only 2 points at Dharamshala so far: kept tentative
    points.push([DHARAMSHALA_LAT, DHARAMSHALA_LON, tStart2]);
    points.push([DHARAMSHALA_LAT + 0.001, DHARAMSHALA_LON, tStart2 + 60]);

    const result1 = filterLiveTrackOutliers(createTestTrack(points));
    expect(result1.timeSec.length).toBe(7);

    // Once 5 Dharamshala points accumulate, new session is confirmed
    points.push([DHARAMSHALA_LAT + 0.002, DHARAMSHALA_LON, tStart2 + 120]);
    points.push([DHARAMSHALA_LAT + 0.003, DHARAMSHALA_LON, tStart2 + 180]);
    points.push([DHARAMSHALA_LAT + 0.004, DHARAMSHALA_LON, tStart2 + 240]);

    const result2 = filterLiveTrackOutliers(createTestTrack(points));
    expect(result2.timeSec.length).toBe(10);
  });

  it('prunes cold-start glitch at start of new session after a gap', () => {
    const points: [number, number, number][] = [
      [BIR_LAT, BIR_LON, 0],
      [BIR_LAT + 0.001, BIR_LON, 60],
      [BIR_LAT + 0.002, BIR_LON, 120],
      [BIR_LAT + 0.003, BIR_LON, 180],
      [BIR_LAT + 0.004, BIR_LON, 240],
    ];

    const tStart2 = 240 + 7200;
    const DHARAMSHALA_LAT = 32.22;
    const DHARAMSHALA_LON = 76.32;

    points.push([PUNJAB_LAT, PUNJAB_LON, tStart2]); // glitch at new sessionStart
    points.push([DHARAMSHALA_LAT, DHARAMSHALA_LON, tStart2 + 60]);
    points.push([DHARAMSHALA_LAT + 0.001, DHARAMSHALA_LON, tStart2 + 120]);
    points.push([DHARAMSHALA_LAT + 0.002, DHARAMSHALA_LON, tStart2 + 180]);
    points.push([DHARAMSHALA_LAT + 0.003, DHARAMSHALA_LON, tStart2 + 240]);
    points.push([DHARAMSHALA_LAT + 0.004, DHARAMSHALA_LON, tStart2 + 300]);

    const result = filterLiveTrackOutliers(createTestTrack(points));
    expect(result.lastOutlierFixSec).toBe(tStart2);
    expect(result.timeSec.length).toBe(10);
    expect(result.timeSec[5]).toBe(tStart2 + 60);
  });

  it('establishes confidence across antimeridian / dateline crossings', () => {
    const points: [number, number, number][] = [
      [0.0, 179.98, 0],
      [0.0, 179.99, 60],
      [0.0, -179.99, 120],
      [0.0, -179.98, 180],
      [0.0, -179.97, 240],
    ];
    const result = filterLiveTrackOutliers(createTestTrack(points));
    expect(result.timeSec).toEqual([0, 60, 120, 180, 240]);
  });

  it('excludes invalid fixes from consensus chain and prunes them', () => {
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

    const result = filterLiveTrackOutliers(createTestTrack(points, undefined, flags));
    expect(result.timeSec).toEqual([0, 60, 180, 240, 300]);
    expect(result.lastOutlierFixSec).toBe(120);
  });

  it('preserves existing lastOutlierFixSec when pruned fix timestamp <= existing marker', () => {
    const points: [number, number, number][] = [
      [BIR_LAT, BIR_LON, 0],
      [BIR_LAT + 0.001, BIR_LON, 60],
      [BIR_LAT + 0.002, BIR_LON, 120],
      [BIR_LAT + 0.003, BIR_LON, 180],
      [BIR_LAT + 0.004, BIR_LON, 240],
      [PUNJAB_LAT, PUNJAB_LON, 300], // outlier fix <= 500
    ];
    const track = createTestTrack(points);
    track.lastOutlierFixSec = 500;

    const result = filterLiveTrackOutliers(track);
    expect(result.timeSec).toEqual([0, 60, 120, 180, 240]);
    expect(result.lastOutlierFixSec).toBe(500);
  });

  it('keeps track tentative on competing clusters until genuine cluster reaches 3x ratio', () => {
    // 5 consistent wrong fixes at Punjab followed by genuine fixes at Bir
    const points: [number, number, number][] = [
      [PUNJAB_LAT, PUNJAB_LON, 0],
      [PUNJAB_LAT + 0.001, PUNJAB_LON, 60],
      [PUNJAB_LAT + 0.002, PUNJAB_LON, 120],
      [PUNJAB_LAT + 0.003, PUNJAB_LON, 180],
      [PUNJAB_LAT + 0.004, PUNJAB_LON, 240],
    ];
    for (let i = 0; i < 6; i++) {
      points.push([BIR_LAT + i * 0.001, BIR_LON, 300 + i * 60]);
    }

    // 6 vs 5 (< 3 * 5 = 15): keeps all 11 fixes tentative without dropping either cluster
    const tentativeResult = filterLiveTrackOutliers(createTestTrack(points));
    expect(tentativeResult.timeSec.length).toBe(11);
    expect(tentativeResult.lastOutlierFixSec).toBeUndefined();

    // Once 15 genuine fixes at Bir accumulate (15 >= 3 * 5), the 5 wrong Punjab fixes are pruned
    for (let i = 6; i < 15; i++) {
      points.push([BIR_LAT + i * 0.001, BIR_LON, 300 + i * 60]);
    }
    const resolvedResult = filterLiveTrackOutliers(createTestTrack(points));
    expect(resolvedResult.timeSec.length).toBe(15);
    expect(resolvedResult.timeSec[0]).toBe(300);
    expect(resolvedResult.lastOutlierFixSec).toBe(240);
  });

  it('evaluates only the current tick delta when the beginning of the session has no outliers', () => {
    const points: [number, number, number][] = [
      [BIR_LAT, BIR_LON, 0],
      [BIR_LAT + 0.001, BIR_LON, 60],
      [BIR_LAT + 0.002, BIR_LON, 120],
      [BIR_LAT + 0.003, BIR_LON, 180],
      [BIR_LAT + 0.004, BIR_LON, 240],
      [BIR_LAT + 0.005, BIR_LON, 300],
      // New delta on current tick: 1 outlier at 360 and 1 valid fix at 420
      [PUNJAB_LAT, PUNJAB_LON, 360],
      [BIR_LAT + 0.006, BIR_LON, 420],
    ];

    const result = filterLiveTrackOutliers(createTestTrack(points), { filterFromSec: 360 });
    expect(result.timeSec).toEqual([0, 60, 120, 180, 240, 300, 420]);
    expect(result.lastOutlierFixSec).toBe(360);
  });

  it('correctly anchors delta fast-path on long non-linear tracks', () => {
    // 10 fixes without any gap > 1h
    const points: [number, number, number][] = [
      [BIR_LAT, BIR_LON, 0],
      [BIR_LAT + 0.001, BIR_LON, 60],
      [BIR_LAT + 0.002, BIR_LON, 120],
      [BIR_LAT + 0.003, BIR_LON, 180],
      [BIR_LAT + 0.004, BIR_LON, 240],
      [BIR_LAT + 0.005, BIR_LON, 300],
      [BIR_LAT + 0.006, BIR_LON, 360],
      [BIR_LAT + 0.007, BIR_LON, 420],
      // Delta: 1 outlier at 480 and 1 valid fix at 540
      [PUNJAB_LAT, PUNJAB_LON, 480],
      [BIR_LAT + 0.008, BIR_LON, 540],
    ];

    const result = filterLiveTrackOutliers(createTestTrack(points), { filterFromSec: 480 });
    expect(result.timeSec).toEqual([0, 60, 120, 180, 240, 300, 360, 420, 540]);
    expect(result.lastOutlierFixSec).toBe(480);
  });

  it('keeps same-second and close-in-time fixes within MIN_OUTLIER_DIST_M (500m) for multi-tracker merges', () => {
    // 0.003 deg latitude is ~333m (< 500m, even though 333m in 0s or 1s exceeds 300 km/h)
    const points: [number, number, number][] = [
      [BIR_LAT, BIR_LON, 0],
      [BIR_LAT, BIR_LON, 0], // exact duplicate timestamp (e.g. InReach message + track point)
      [BIR_LAT + 0.001, BIR_LON, 60],
      [BIR_LAT + 0.004, BIR_LON, 61], // ~333m in 1s (~1200 km/h, but within 500m floor)
      [BIR_LAT + 0.005, BIR_LON, 120],
      [BIR_LAT + 0.006, BIR_LON, 180],
    ];

    const result = filterLiveTrackOutliers(createTestTrack(points));
    expect(result).toBeDefined();
    expect(result.timeSec).toEqual([0, 0, 60, 61, 120, 180]);
    expect(result.lastOutlierFixSec).toBeUndefined();
  });

  it('prunes same-second outlier when distance exceeds MIN_OUTLIER_DIST_M', () => {
    const points: [number, number, number][] = [
      [BIR_LAT, BIR_LON, 0],
      [BIR_LAT + 0.001, BIR_LON, 60],
      [BIR_LAT + 0.002, BIR_LON, 120],
      [BIR_LAT + 0.003, BIR_LON, 180],
      [BIR_LAT + 0.004, BIR_LON, 240],
      [PUNJAB_LAT, PUNJAB_LON, 240], // dt = 0s, 150km away (> 500m)
    ];

    const result = filterLiveTrackOutliers(createTestTrack(points));
    expect(result.timeSec).toEqual([0, 60, 120, 180, 240]);
    expect(result.lastOutlierFixSec).toBe(240);
  });

  it('never prunes outliers carrying a message, and keeps their message', () => {
    const points: [number, number, number][] = [
      [BIR_LAT, BIR_LON, 0],
      [BIR_LAT + 0.001, BIR_LON, 60],
      [BIR_LAT + 0.002, BIR_LON, 120],
      [BIR_LAT + 0.003, BIR_LON, 180],
      [BIR_LAT + 0.004, BIR_LON, 240],
      [PUNJAB_LAT, PUNJAB_LON, 300], // outlier with a message: kept
      [PUNJAB_LAT, PUNJAB_LON, 360], // outlier without a message: pruned
      [BIR_LAT + 0.005, BIR_LON, 420],
    ];
    const extra = { 5: protos.LiveExtra.create({ message: "I'm OK" }) };

    const result = filterLiveTrackOutliers(createTestTrack(points, extra));
    expect(result.timeSec).toEqual([0, 60, 120, 180, 240, 300, 420]);
    expect(result.extra?.[5]?.message).toBe("I'm OK");
    expect(result.lastOutlierFixSec).toBe(360);
  });

  it('never prunes emergency outliers (including invalid emergency fixes)', () => {
    const points: [number, number, number][] = [
      [BIR_LAT, BIR_LON, 0],
      [BIR_LAT + 0.001, BIR_LON, 60],
      [BIR_LAT + 0.002, BIR_LON, 120],
      [BIR_LAT + 0.003, BIR_LON, 180],
      [BIR_LAT + 0.004, BIR_LON, 240],
      [PUNJAB_LAT, PUNJAB_LON, 300], // valid emergency outlier
      [BIR_LAT + 0.005, BIR_LON, 360], // invalid emergency fix
      [BIR_LAT + 0.006, BIR_LON, 420],
    ];
    const flags = points.map(() => LiveTrackFlag.Valid);
    flags[5] |= LiveTrackFlag.Emergency;
    flags[6] = LiveTrackFlag.Emergency;

    const track = createTestTrack(points, undefined, flags);
    const result = filterLiveTrackOutliers(track);
    expect(result).toBe(track);
    expect(result.timeSec.length).toBe(8);
    expect(result.lastOutlierFixSec).toBeUndefined();
  });

  it('prunes outliers in-place preserving array instances', () => {
    const points: [number, number, number][] = [
      [BIR_LAT, BIR_LON, 0],
      [BIR_LAT + 0.001, BIR_LON, 60],
      [BIR_LAT + 0.002, BIR_LON, 120],
      [BIR_LAT + 0.003, BIR_LON, 180],
      [BIR_LAT + 0.004, BIR_LON, 240],
      [PUNJAB_LAT, PUNJAB_LON, 300], // outlier
      [BIR_LAT + 0.005, BIR_LON, 360],
    ];
    const track = createTestTrack(points);
    const originalTimeSec = track.timeSec;
    const originalLat = track.lat;
    const originalLon = track.lon;

    const result = filterLiveTrackOutliers(track);

    expect(result).toBe(track);
    expect(result.timeSec).toBe(originalTimeSec);
    expect(result.lat).toBe(originalLat);
    expect(result.lon).toBe(originalLon);
    expect(result.timeSec).toEqual([0, 60, 120, 180, 240, 360]);
    expect(result.lastOutlierFixSec).toBe(300);
  });
});
