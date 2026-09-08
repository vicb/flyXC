import { LiveTrack } from '../protos/live-track';
import {
  differentialDecodeLiveTrack,
  differentialEncodeLiveTrack,
  getLastMessage,
  isEmergencyTrack,
  IsSimplifiableFix,
  LiveTrackFlag,
  mergeLiveTracks,
  NO_GROUND_ALTITUDE,
  removeBeforeFromLiveTrack,
  removeDeviceFromLiveTrack,
  simplifyLiveTrack,
  trackerIdByName,
} from './live-track';

describe('removeBeforeFromLiveTrack', () => {
  let track: LiveTrack;
  beforeAll(() => {
    track = {
      timeSec: [10, 20, 30, 40],
      lat: [11, 21, 31, 41],
      lon: [12, 22, 32, 42],
      alt: [13, 23, 33, 43],
      gndAlt: [15, 25, 35, 45],
      flags: [14, 24, 34, 44],
      extra: { 1: { speed: 10 }, 2: { message: 'hello' } },
    };
  });

  it('should keep the track unchanged if deleting strictly before the first fix', () => {
    expect(removeBeforeFromLiveTrack(track, 5)).toEqual({
      timeSec: [10, 20, 30, 40],
      lat: [11, 21, 31, 41],
      lon: [12, 22, 32, 42],
      alt: [13, 23, 33, 43],
      gndAlt: [15, 25, 35, 45],
      flags: [14, 24, 34, 44],
      extra: { 1: { speed: 10 }, 2: { message: 'hello' } },
    });
  });

  it('should keep the track unchanged if deleting the first fix time', () => {
    expect(removeBeforeFromLiveTrack(track, 10)).toEqual({
      timeSec: [10, 20, 30, 40],
      lat: [11, 21, 31, 41],
      lon: [12, 22, 32, 42],
      alt: [13, 23, 33, 43],
      gndAlt: [15, 25, 35, 45],
      flags: [14, 24, 34, 44],
      extra: { 1: { speed: 10 }, 2: { message: 'hello' } },
    });
  });

  it('should delete from a time in the track range', () => {
    expect(removeBeforeFromLiveTrack(track, 25)).toEqual({
      timeSec: [30, 40],
      lat: [31, 41],
      lon: [32, 42],
      alt: [33, 43],
      gndAlt: [35, 45],
      flags: [34, 44],
      extra: { 0: { message: 'hello' } },
    });
  });

  it('should delete from a time in the track range with a fix', () => {
    expect(removeBeforeFromLiveTrack(track, 30)).toEqual({
      timeSec: [30, 40],
      lat: [31, 41],
      lon: [32, 42],
      alt: [33, 43],
      gndAlt: [35, 45],
      flags: [34, 44],
      extra: { 0: { message: 'hello' } },
    });
  });

  it('should delete from the last fix time', () => {
    expect(removeBeforeFromLiveTrack(track, 40)).toEqual({
      timeSec: [40],
      lat: [41],
      lon: [42],
      alt: [43],
      gndAlt: [45],
      flags: [44],
      extra: {},
    });
  });

  it('should return an empty track if the start is after the track', () => {
    expect(removeBeforeFromLiveTrack(track, 45)).toEqual(LiveTrack.create());
  });

  it('should accept an empty track', () => {
    const track = LiveTrack.create();
    expect(removeBeforeFromLiveTrack(track, 45)).toEqual(LiveTrack.create());
  });

  it('should normalize missing gndAlt when removing before', () => {
    const track = {
      timeSec: [10, 20],
      lat: [1, 2],
      lon: [3, 4],
      alt: [5, 6],
      flags: [0, 0],
      extra: {},
    } as any;
    const result = removeBeforeFromLiveTrack(track, 15);
    expect(result.gndAlt).toEqual([NO_GROUND_ALTITUDE]);
  });

  it('should handle single-point tracks correctly', () => {
    const singleTrack: LiveTrack = {
      name: 'pilot1',
      id: 123,
      timeSec: [100],
      lat: [45],
      lon: [6],
      alt: [1000],
      gndAlt: [500],
      flags: [0],
      extra: { 0: { speed: 25 } },
    };

    // Before fix: kept
    expect(removeBeforeFromLiveTrack(singleTrack, 90)).toEqual(singleTrack);
    // At fix: kept
    expect(removeBeforeFromLiveTrack(singleTrack, 100)).toEqual(singleTrack);
    // After fix: dropped
    expect(removeBeforeFromLiveTrack(singleTrack, 101)).toEqual(LiveTrack.create({ name: 'pilot1', id: 123 }));
  });

  it('should preserve track metadata (name and id) across all branches', () => {
    const namedTrack: LiveTrack = {
      name: 'Pilot John',
      id: 42,
      timeSec: [10, 20, 30],
      lat: [1, 2, 3],
      lon: [4, 5, 6],
      alt: [7, 8, 9],
      gndAlt: [10, 11, 12],
      flags: [0, 0, 0],
      extra: {},
    };

    // Branch 1: timeSec <= firstFix (nothing deleted)
    const res1 = removeBeforeFromLiveTrack(namedTrack, 5);
    expect(res1.name).toBe('Pilot John');
    expect(res1.id).toBe(42);

    // Branch 2: in-between (partially deleted)
    const res2 = removeBeforeFromLiveTrack(namedTrack, 20);
    expect(res2.name).toBe('Pilot John');
    expect(res2.id).toBe(42);
    expect(res2.timeSec).toEqual([20, 30]);

    // Branch 3: timeSec > lastFix (all deleted)
    const res3 = removeBeforeFromLiveTrack(namedTrack, 50);
    expect(res3.name).toBe('Pilot John');
    expect(res3.id).toBe(42);
    expect(res3.timeSec).toEqual([]);

    // Branch 4: empty track with metadata
    const emptyNamedTrack = LiveTrack.create({ name: 'Pilot Jane', id: 99 });
    const res4 = removeBeforeFromLiveTrack(emptyNamedTrack, 50);
    expect(res4.name).toBe('Pilot Jane');
    expect(res4.id).toBe(99);
    expect(res4.timeSec).toEqual([]);
  });

  it('should ensure immutability: modifying returned track arrays and extra objects does not affect input track', () => {
    const originalTrack: LiveTrack = {
      timeSec: [10, 20, 30],
      lat: [1, 2, 3],
      lon: [4, 5, 6],
      alt: [7, 8, 9],
      gndAlt: [10, 11, 12],
      flags: [0, 0, 0],
      extra: { 0: { speed: 10, message: 'orig' } },
    };

    // Case 1: when 0 points are removed (timeSec <= firstFix), original track is returned directly
    const returned1 = removeBeforeFromLiveTrack(originalTrack, 5);
    expect(returned1).toBe(originalTrack);

    // Case 2: when points are pruned (timeSec > firstFix)
    const originalTrack2: LiveTrack = {
      timeSec: [10, 20, 30],
      lat: [1, 2, 3],
      lon: [4, 5, 6],
      alt: [7, 8, 9],
      gndAlt: [10, 11, 12],
      flags: [0, 0, 0],
      extra: { 1: { speed: 100 } },
    };

    const returned2 = removeBeforeFromLiveTrack(originalTrack2, 20);
    returned2.extra[0].speed = 555;

    expect(originalTrack2.extra[1].speed).toBe(100);
  });

  it('should remap and filter extra metadata indexes correctly', () => {
    const trackWithExtra: LiveTrack = {
      timeSec: [10, 20, 30, 40, 50],
      lat: [1, 2, 3, 4, 5],
      lon: [1, 2, 3, 4, 5],
      alt: [1, 2, 3, 4, 5],
      gndAlt: [10, 20, 30, 40, 50],
      flags: [0, 0, 0, 0, 0],
      extra: {
        0: { message: 'start' },
        2: { speed: 30 },
        4: { message: 'end' },
      },
    };

    // Delete fixes before 30 (deletes index 0 and index 1 -> numToDelete = 2)
    const pruned = removeBeforeFromLiveTrack(trackWithExtra, 30);
    expect(pruned.timeSec).toEqual([30, 40, 50]);
    // Index 0 was before numToDelete, so dropped
    // Index 2 is remapped to 2 - 2 = 0
    // Index 4 is remapped to 4 - 2 = 2
    expect(pruned.extra).toEqual({
      0: { speed: 30 },
      2: { message: 'end' },
    });
  });
});

describe('removeDeviceFromLiveTrack', () => {
  let track: LiveTrack;
  beforeAll(() => {
    track = {
      timeSec: [10, 20, 30, 40],
      lat: [11, 21, 31, 41],
      lon: [12, 22, 32, 42],
      alt: [13, 23, 33, 43],
      gndAlt: [15, 25, 35, 45],
      flags: [trackerIdByName.inreach, trackerIdByName.inreach, trackerIdByName.flyme, trackerIdByName.flyme],
      extra: { 1: { speed: 10 }, 2: { message: 'hello' } },
    };
  });

  it('should accept an empty track', () => {
    const emptyTrack = LiveTrack.create({});
    expect(removeDeviceFromLiveTrack(emptyTrack, 'flyme')).toEqual(emptyTrack);
  });

  it('should remove the passed device', () => {
    expect(removeDeviceFromLiveTrack(track, 'flyme')).toEqual({
      timeSec: [10, 20],
      lat: [11, 21],
      lon: [12, 22],
      alt: [13, 23],
      gndAlt: [15, 25],
      flags: [trackerIdByName.inreach, trackerIdByName.inreach],
      extra: { 1: { speed: 10 } },
    });

    expect(removeDeviceFromLiveTrack(track, 'inreach')).toEqual({
      timeSec: [30, 40],
      lat: [31, 41],
      lon: [32, 42],
      alt: [33, 43],
      gndAlt: [35, 45],
      flags: [trackerIdByName.flyme, trackerIdByName.flyme],
      extra: { 0: { message: 'hello' } },
    });
  });

  it('should leave the track unchanged if devices is not used', () => {
    expect(removeDeviceFromLiveTrack(track, 'spot')).toEqual({
      timeSec: [10, 20, 30, 40],
      lat: [11, 21, 31, 41],
      lon: [12, 22, 32, 42],
      alt: [13, 23, 33, 43],
      gndAlt: [15, 25, 35, 45],
      flags: [trackerIdByName.inreach, trackerIdByName.inreach, trackerIdByName.flyme, trackerIdByName.flyme],
      extra: { 1: { speed: 10 }, 2: { message: 'hello' } },
    });
  });

  it('should normalize missing gndAlt when removing device', () => {
    const track = {
      timeSec: [10, 20],
      lat: [1, 2],
      lon: [3, 4],
      alt: [5, 6],
      flags: [trackerIdByName.inreach, trackerIdByName.flyme],
      extra: {},
    } as any;
    const result = removeDeviceFromLiveTrack(track, 'flyme');
    expect(result.gndAlt).toEqual([NO_GROUND_ALTITUDE]);
  });
});

describe('simplifyLiveTrack', () => {
  it('should simplify a track', () => {
    const track: LiveTrack = {
      timeSec: [1, 10, 20, 25, 30, 35, 40, 45],
      lat: [2, 11, 21, 26, 31, 36, 41, 46],
      lon: [3, 12, 22, 27, 32, 37, 42, 47],
      alt: [4, 13, 23, 28, 33, 38, 43, 48],
      gndAlt: [5, 14, 24, 29, 34, 39, 44, 49],
      flags: [0, 0, 0, 0, 0, 0, 0, 0],
      extra: {},
    };

    simplifyLiveTrack(track, 10);

    expect(track).toEqual({
      timeSec: [1, 20, 30, 40, 45],
      lat: [2, 21, 31, 41, 46],
      lon: [3, 22, 32, 42, 47],
      alt: [4, 23, 33, 43, 48],
      gndAlt: [5, 24, 34, 44, 49],
      flags: [0, 0, 0, 0, 0],
      extra: {},
    });
  });

  it('should preserve the track when nothing to do', () => {
    const track: LiveTrack = {
      timeSec: [1, 10, 20, 25, 30, 35, 40, 45],
      lat: [2, 11, 21, 26, 31, 36, 41, 46],
      lon: [3, 12, 22, 27, 32, 37, 42, 47],
      alt: [4, 13, 23, 28, 33, 38, 43, 48],
      gndAlt: [5, 14, 24, 29, 34, 39, 44, 49],
      flags: [0, 0, 0, 0, 0, 0, 0, 0],
      extra: { 3: { message: 'hello' } },
    };

    simplifyLiveTrack(track, 1);

    expect(track).toEqual({
      timeSec: [1, 10, 20, 25, 30, 35, 40, 45],
      lat: [2, 11, 21, 26, 31, 36, 41, 46],
      lon: [3, 12, 22, 27, 32, 37, 42, 47],
      alt: [4, 13, 23, 28, 33, 38, 43, 48],
      gndAlt: [5, 14, 24, 29, 34, 39, 44, 49],
      flags: [0, 0, 0, 0, 0, 0, 0, 0],
      extra: { 3: { message: 'hello' } },
    });
  });

  it('should adjust extra indexes', () => {
    const track: LiveTrack = {
      timeSec: [10, 15, 20, 25, 30],
      lat: [0, 0, 0, 0, 0],
      lon: [0, 0, 0, 0, 0],
      alt: [0, 0, 0, 0, 0],
      gndAlt: [0, 0, 0, 0, 0],
      flags: [0, 0, 0, 0, 0],
      extra: {
        2: { message: 'hello' },
        4: { speed: 10 },
      },
    };

    simplifyLiveTrack(track, 10);

    expect(track).toMatchObject({
      timeSec: [10, 20, 30],
      extra: {
        1: { message: 'hello' },
        2: { speed: 10 },
      },
    });
  });

  it('should not simplify messages', () => {
    const track: LiveTrack = {
      timeSec: [10, 12, 14, 20],
      lat: [0, 0, 0, 0],
      lon: [0, 0, 0, 0],
      alt: [0, 0, 0, 0],
      gndAlt: [0, 0, 0, 0],
      flags: [0, 0, 0, 0],
      extra: {
        1: { speed: 10 },
        2: { message: 'hello' },
      },
    };

    simplifyLiveTrack(track, 10);

    expect(track).toMatchObject({
      timeSec: [10, 14, 20],
      extra: {
        1: { message: 'hello' },
      },
    });
  });
  it('should not simplify emergency', () => {
    const track: LiveTrack = {
      timeSec: [10, 12, 14, 20],
      lat: [0, 0, 0, 0],
      lon: [0, 0, 0, 0],
      alt: [0, 0, 0, 0],
      gndAlt: [0, 0, 0, 0],
      flags: [0, LiveTrackFlag.Emergency, LiveTrackFlag.Emergency, 0],
      extra: {
        1: { message: 'hello' },
        2: { speed: 10 },
      },
    };

    simplifyLiveTrack(track, 10);

    expect(track).toMatchObject({
      timeSec: [10, 12, 14, 20],
    });
  });

  it('simplify lowbat and speed', () => {
    const track: LiveTrack = {
      timeSec: [10, 12, 14, 20, 25],
      lat: [0, 0, 0, 0, 0],
      lon: [0, 0, 0, 0, 0],
      alt: [0, 0, 0, 0, 0],
      gndAlt: [0, 0, 0, 0, 0],
      flags: [0, 0, LiveTrackFlag.LowBat, 0, 0],
      extra: {
        1: { message: 'hello' },
        3: { speed: 10 },
      },
    };

    simplifyLiveTrack(track, 10);

    expect(track).toMatchObject({
      timeSec: [10, 12, 25],
    });
  });

  it('should simplify from fromSec', () => {
    const track: LiveTrack = {
      timeSec: [1, 10, 20, 25, 30, 35, 40, 45],
      lat: [2, 11, 21, 26, 31, 36, 41, 46],
      lon: [3, 12, 22, 27, 32, 37, 42, 47],
      alt: [4, 13, 23, 28, 33, 38, 43, 48],
      gndAlt: [5, 14, 24, 29, 34, 39, 44, 49],
      flags: [0, 0, 0, 0, 0, 0, 0, 0],
      extra: { 4: { message: 'hello' } },
    };

    simplifyLiveTrack(track, 10, { fromSec: 26 });

    expect(track).toEqual({
      timeSec: [1, 10, 20, 25, 30, 40, 45],
      lat: [2, 11, 21, 26, 31, 41, 46],
      lon: [3, 12, 22, 27, 32, 42, 47],
      alt: [4, 13, 23, 28, 33, 43, 48],
      gndAlt: [5, 14, 24, 29, 34, 44, 49],
      flags: [0, 0, 0, 0, 0, 0, 0],
      extra: { 4: { message: 'hello' } },
    });
  });

  it('should simplify from fromSec with an empty track', () => {
    const track: LiveTrack = {
      timeSec: [],
      lat: [],
      lon: [],
      alt: [],
      gndAlt: [],
      flags: [],
      extra: {},
    };

    simplifyLiveTrack(track, 10, { fromSec: 26 });

    expect(track).toEqual({
      timeSec: [],
      lat: [],
      lon: [],
      alt: [],
      gndAlt: [],
      flags: [],
      extra: {},
    });
  });

  it('should return unchanged track if the start time is after the track', () => {
    const track: LiveTrack = {
      timeSec: [1, 10, 20, 25, 30, 35, 40, 45],
      lat: [2, 11, 21, 26, 31, 36, 41, 46],
      lon: [3, 12, 22, 27, 32, 37, 42, 47],
      alt: [4, 13, 23, 28, 33, 38, 43, 48],
      gndAlt: [5, 14, 24, 29, 34, 39, 44, 49],
      flags: [0, 0, 0, 0, 0, 0, 0, 0],
      extra: { 4: { message: 'hello' } },
    };

    simplifyLiveTrack(track, 10, { fromSec: 50 });

    expect(track).toEqual({
      timeSec: [1, 10, 20, 25, 30, 35, 40, 45],
      lat: [2, 11, 21, 26, 31, 36, 41, 46],
      lon: [3, 12, 22, 27, 32, 37, 42, 47],
      alt: [4, 13, 23, 28, 33, 38, 43, 48],
      gndAlt: [5, 14, 24, 29, 34, 39, 44, 49],
      flags: [0, 0, 0, 0, 0, 0, 0, 0],
      extra: { 4: { message: 'hello' } },
    });
  });

  it('should simplify up to toSec', () => {
    const track: LiveTrack = {
      timeSec: [1, 10, 20, 25, 30, 35, 40, 45],
      lat: [2, 11, 21, 26, 31, 36, 41, 46],
      lon: [3, 12, 22, 27, 32, 37, 42, 47],
      alt: [4, 13, 23, 28, 33, 38, 43, 48],
      gndAlt: [5, 14, 24, 29, 34, 39, 44, 49],
      flags: [0, 0, 0, 0, 0, 0, 0, 0],
      extra: { 4: { message: 'hello' } },
    };

    simplifyLiveTrack(track, 10, { toSec: 25 });

    expect(track).toEqual({
      timeSec: [1, 20, 30, 35, 40, 45],
      lat: [2, 21, 31, 36, 41, 46],
      lon: [3, 22, 32, 37, 42, 47],
      alt: [4, 23, 33, 38, 43, 48],
      gndAlt: [5, 24, 34, 39, 44, 49],
      flags: [0, 0, 0, 0, 0, 0],
      extra: { 2: { message: 'hello' } },
    });
  });

  it('should simplify up to toSec with an empty track', () => {
    const track: LiveTrack = {
      timeSec: [],
      lat: [],
      lon: [],
      alt: [],
      gndAlt: [],
      flags: [],
      extra: {},
    };

    simplifyLiveTrack(track, 10, { toSec: 26 });

    expect(track).toEqual({
      timeSec: [],
      lat: [],
      lon: [],
      alt: [],
      gndAlt: [],
      flags: [],
      extra: {},
    });
  });

  it('should return unchanged track if the end time is before the track', () => {
    const track: LiveTrack = {
      timeSec: [51, 52, 53, 54, 55, 56, 57, 58],
      lat: [2, 11, 21, 26, 31, 36, 41, 46],
      lon: [3, 12, 22, 27, 32, 37, 42, 47],
      alt: [4, 13, 23, 28, 33, 38, 43, 48],
      gndAlt: [5, 14, 24, 29, 34, 39, 44, 49],
      flags: [0, 0, 0, 0, 0, 0, 0, 0],
      extra: { 4: { message: 'hello' } },
    };

    simplifyLiveTrack(track, 10, { toSec: 50 });

    expect(track).toEqual({
      timeSec: [51, 52, 53, 54, 55, 56, 57, 58],
      lat: [2, 11, 21, 26, 31, 36, 41, 46],
      lon: [3, 12, 22, 27, 32, 37, 42, 47],
      alt: [4, 13, 23, 28, 33, 38, 43, 48],
      gndAlt: [5, 14, 24, 29, 34, 39, 44, 49],
      flags: [0, 0, 0, 0, 0, 0, 0, 0],
      extra: { 4: { message: 'hello' } },
    });
  });

  it('should simplify between fromSec and toSec', () => {
    const track: LiveTrack = {
      timeSec: [51, 52, 53, 54, 55, 56, 57, 58],
      lat: [2, 11, 21, 26, 31, 36, 41, 46],
      lon: [3, 12, 22, 27, 32, 37, 42, 47],
      alt: [4, 13, 23, 28, 33, 38, 43, 48],
      gndAlt: [5, 14, 24, 29, 34, 39, 44, 49],
      flags: [0, 0, 0, 0, 0, 0, 0, 0],
      extra: { 4: { message: 'hello' } },
    };

    simplifyLiveTrack(track, 10, { fromSec: 53, toSec: 57 });

    expect(track).toEqual({
      timeSec: [51, 52, 53, 55, 58],
      lat: [2, 11, 21, 31, 46],
      lon: [3, 12, 22, 32, 47],
      alt: [4, 13, 23, 33, 48],
      gndAlt: [5, 14, 24, 34, 49],
      flags: [0, 0, 0, 0, 0],
      extra: { 3: { message: 'hello' } },
    });
  });

  it('should handle a track with a single fix without modification', () => {
    const track: LiveTrack = {
      timeSec: [100],
      lat: [45],
      lon: [6],
      alt: [1000],
      gndAlt: [500],
      flags: [0],
      extra: { 0: { speed: 20 } },
    };

    simplifyLiveTrack(track, 10);

    expect(track).toEqual({
      timeSec: [100],
      lat: [45],
      lon: [6],
      alt: [1000],
      gndAlt: [500],
      flags: [0],
      extra: { 0: { speed: 20 } },
    });
  });

  it('should return unchanged when fromSec is greater than toSec', () => {
    const track: LiveTrack = {
      timeSec: [10, 15, 20, 25, 30],
      lat: [1, 2, 3, 4, 5],
      lon: [1, 2, 3, 4, 5],
      alt: [1, 2, 3, 4, 5],
      gndAlt: [1, 2, 3, 4, 5],
      flags: [0, 0, 0, 0, 0],
      extra: {},
    };

    simplifyLiveTrack(track, 10, { fromSec: 25, toSec: 15 });

    expect(track.timeSec).toEqual([10, 15, 20, 25, 30]);
  });

  it('should return unchanged when startIndex is the last point', () => {
    const track: LiveTrack = {
      timeSec: [10, 15, 20, 25, 30],
      lat: [1, 2, 3, 4, 5],
      lon: [1, 2, 3, 4, 5],
      alt: [1, 2, 3, 4, 5],
      gndAlt: [1, 2, 3, 4, 5],
      flags: [0, 0, 0, 0, 0],
      extra: {},
    };

    simplifyLiveTrack(track, 10, { fromSec: 30 });

    expect(track.timeSec).toEqual([10, 15, 20, 25, 30]);
  });

  it('should simplify UFO points at index 0 but preserve UFO points at the last index', () => {
    const track: LiveTrack = {
      timeSec: [10, 15, 20, 25],
      lat: [1, 2, 3, 4],
      lon: [1, 2, 3, 4],
      alt: [1, 2, 3, 4],
      gndAlt: [1, 2, 3, 4],
      flags: [LiveTrackFlag.IsUfo, 0, 0, LiveTrackFlag.IsUfo],
      extra: {},
    };

    // With previousTimeSec initialized to timeSec[0] - 2 * interval = 10 - 20 = -10,
    // index 0 has timeSec - previous = 20 >= 10, so index 0 is kept.
    // However, if fromSec is 15, index 1 is checked with previous 15 - 20 = -5.
    // Let's test simplifying UFO at index 0 when it is within interval of start.
    simplifyLiveTrack(track, 10);

    // index 0 (10) kept. index 1 (15 - 10 = 5 < 10) simplified.
    // index 2 (20 - 10 = 10 >= 10) kept.
    // index 3 (25 - 20 = 5 < 10): last point is never simplifiable (even if UFO).
    expect(track.timeSec).toEqual([10, 20, 25]);
    expect(track.flags).toEqual([LiveTrackFlag.IsUfo, 0, LiveTrackFlag.IsUfo]);
  });

  it('should normalize missing gndAlt when simplifying', () => {
    const track = {
      timeSec: [10, 20],
      lat: [1, 2],
      lon: [3, 4],
      alt: [5, 6],
      flags: [0, 0],
      extra: {},
    } as any;
    simplifyLiveTrack(track, 10);
    expect(track.gndAlt).toEqual([NO_GROUND_ALTITUDE, NO_GROUND_ALTITUDE]);
  });
});

describe('IsSimplifiableFix', () => {
  const baseTrack: LiveTrack = {
    timeSec: [10, 20, 30, 40],
    lat: [1, 2, 3, 4],
    lon: [1, 2, 3, 4],
    alt: [1, 2, 3, 4],
    gndAlt: [1, 2, 3, 4],
    flags: [0, 0, 0, 0],
    extra: {},
  };

  it('should not allow simplifying the start point for non-UFO', () => {
    expect(IsSimplifiableFix(baseTrack, 0)).toBe(false);
  });

  it('should allow simplifying the start point for UFO', () => {
    const ufoTrack: LiveTrack = {
      ...baseTrack,
      flags: [LiveTrackFlag.IsUfo, 0, 0, 0],
    };
    expect(IsSimplifiableFix(ufoTrack, 0)).toBe(true);
  });

  it('should never allow simplifying the last point', () => {
    expect(IsSimplifiableFix(baseTrack, 3)).toBe(false);

    const ufoTrack: LiveTrack = {
      ...baseTrack,
      flags: [0, 0, 0, LiveTrackFlag.IsUfo],
    };
    expect(IsSimplifiableFix(ufoTrack, 3)).toBe(false);
  });

  it('should not allow simplifying emergency fixes', () => {
    const emergencyTrack: LiveTrack = {
      ...baseTrack,
      flags: [0, LiveTrackFlag.Emergency, 0, 0],
    };
    expect(IsSimplifiableFix(emergencyTrack, 1)).toBe(false);
  });

  it('should not allow simplifying fixes with extra messages', () => {
    const msgTrack: LiveTrack = {
      ...baseTrack,
      extra: { 1: { message: 'SOS' } },
    };
    expect(IsSimplifiableFix(msgTrack, 1)).toBe(false);
  });

  it('should allow simplifying standard internal fixes with non-message extras', () => {
    const speedTrack: LiveTrack = {
      ...baseTrack,
      extra: { 1: { speed: 45 } },
    };
    expect(IsSimplifiableFix(speedTrack, 1)).toBe(true);
    expect(IsSimplifiableFix(baseTrack, 2)).toBe(true);
  });
});

describe('mergeLiveTracks', () => {
  it('should merge 2 empty tracks', () => {
    const track = LiveTrack.create();
    expect(mergeLiveTracks(track, track)).toEqual(track);
  });

  it('should use the track that is not empty', () => {
    const track: LiveTrack = {
      timeSec: [1, 2, 3],
      lat: [11, 12, 13],
      lon: [21, 22, 23],
      alt: [31, 32, 33],
      gndAlt: [51, 52, 53],
      flags: [41, 42, 43],
      extra: {
        0: { message: 'hello' },
        2: { speed: 10 },
      },
    };

    const emptyTrack = LiveTrack.create();

    expect(mergeLiveTracks(track, emptyTrack)).toEqual(track);
    expect(mergeLiveTracks(emptyTrack, track)).toEqual(track);
  });

  it('should merge gndAlt picking valid over sentinel', () => {
    const track1: LiveTrack = {
      timeSec: [10, 20],
      lat: [11, 12],
      lon: [21, 22],
      alt: [31, 32],
      gndAlt: [100, NO_GROUND_ALTITUDE],
      flags: [trackerIdByName.inreach, trackerIdByName.inreach],
      extra: {},
    };

    const track2: LiveTrack = {
      timeSec: [20, 30],
      lat: [12, 13],
      lon: [22, 23],
      alt: [32, 33],
      gndAlt: [250, 350],
      flags: [trackerIdByName.spot | LiveTrackFlag.Valid, trackerIdByName.spot | LiveTrackFlag.Valid],
      extra: {},
    };

    const merged = mergeLiveTracks(track1, track2);
    expect(merged.timeSec).toEqual([10, 20, 30]);
    expect(merged.gndAlt).toEqual([100, 250, 350]);
  });

  it('should populate gndAlt with sentinel if tracks have missing gndAlt', () => {
    const track1 = {
      timeSec: [10],
      lat: [11],
      lon: [21],
      alt: [31],
      flags: [1],
      extra: {},
    } as any;
    const track2 = {
      timeSec: [20],
      lat: [12],
      lon: [22],
      alt: [32],
      flags: [1],
      extra: {},
    } as any;
    const merged = mergeLiveTracks(track1, track2);
    expect(merged.gndAlt).toEqual([NO_GROUND_ALTITUDE, NO_GROUND_ALTITUDE]);
  });

  it('should merge non-overlapping tracks', () => {
    const track1: LiveTrack = {
      timeSec: [1, 2, 3],
      lat: [11, 12, 13],
      lon: [21, 22, 23],
      alt: [31, 32, 33],
      gndAlt: [51, 52, 53],
      flags: [41, 42, 43],
      extra: {
        0: { message: 'hello' },
        2: { speed: 10 },
      },
    };

    const track2: LiveTrack = {
      timeSec: [4, 5, 6],
      lat: [14, 15, 16],
      lon: [24, 25, 26],
      alt: [34, 35, 36],
      gndAlt: [54, 55, 56],
      flags: [44, 45, 46],
      extra: {
        0: { message: 'olleh' },
        2: { speed: 20 },
      },
    };

    expect(mergeLiveTracks(track1, track2)).toEqual(mergeLiveTracks(track2, track1));
    expect(mergeLiveTracks(track1, track2)).toEqual({
      timeSec: [1, 2, 3, 4, 5, 6],
      lat: [11, 12, 13, 14, 15, 16],
      lon: [21, 22, 23, 24, 25, 26],
      alt: [31, 32, 33, 34, 35, 36],
      gndAlt: [51, 52, 53, 54, 55, 56],
      flags: [41, 42, 43, 44, 45, 46],
      extra: {
        0: { message: 'hello' },
        2: { speed: 10 },
        3: { message: 'olleh' },
        5: { speed: 20 },
      },
    });
  });

  it('should merge overlapping tracks', () => {
    const track1: LiveTrack = {
      timeSec: [10, 20, 30],
      lat: [11, 12, 13],
      lon: [21, 22, 23],
      alt: [31, 32, 33],
      gndAlt: [51, 52, 53],
      flags: [41, 42, 43],
      extra: {
        0: { message: 'hello' },
        2: { speed: 10 },
      },
    };

    const track2: LiveTrack = {
      timeSec: [15, 25, 35],
      lat: [14, 15, 16],
      lon: [24, 25, 26],
      alt: [34, 35, 36],
      gndAlt: [54, 55, 56],
      flags: [44, 45, 46],
      extra: {
        0: { message: 'olleh' },
        2: { speed: 20 },
      },
    };

    expect(mergeLiveTracks(track1, track2)).toEqual(mergeLiveTracks(track2, track1));

    expect(mergeLiveTracks(track1, track2)).toEqual({
      timeSec: [10, 15, 20, 25, 30, 35],
      lat: [11, 14, 12, 15, 13, 16],
      lon: [21, 24, 22, 25, 23, 26],
      alt: [31, 34, 32, 35, 33, 36],
      gndAlt: [51, 54, 52, 55, 53, 56],
      flags: [41, 44, 42, 45, 43, 46],
      extra: {
        0: { message: 'hello' },
        4: { speed: 10 },
        1: { message: 'olleh' },
        5: { speed: 20 },
      },
    });
  });
  describe('track with common fixes', () => {
    it('should merge emergency', () => {
      const track1: LiveTrack = {
        timeSec: [10, 20, 30],
        lat: [11, 12, 13],
        lon: [21, 22, 23],
        alt: [31, 32, 33],
        gndAlt: [51, 52, 53],
        flags: [trackerIdByName.inreach, trackerIdByName.inreach, trackerIdByName.inreach],
        extra: {
          0: { message: 'hello' },
          2: { speed: 10 },
        },
      };

      const track2: LiveTrack = {
        timeSec: [20],
        lat: [0],
        lon: [0],
        alt: [0],
        gndAlt: [0],
        flags: [trackerIdByName.spot | LiveTrackFlag.Emergency],
        extra: {
          0: { message: 'world' },
        },
      };

      expect(mergeLiveTracks(track1, track2)).toEqual({
        timeSec: [10, 20, 30],
        lat: [11, 12, 13],
        lon: [21, 22, 23],
        alt: [31, 32, 33],
        gndAlt: [51, 52, 53],
        flags: [trackerIdByName.inreach, trackerIdByName.inreach | LiveTrackFlag.Emergency, trackerIdByName.inreach],
        extra: {
          0: { message: 'hello' },
          2: { speed: 10 },
          1: { message: 'world' },
        },
      });
    });

    it('should merge low battery', () => {
      const track1: LiveTrack = {
        timeSec: [10, 20, 30],
        lat: [11, 12, 13],
        lon: [21, 22, 23],
        alt: [31, 32, 33],
        gndAlt: [51, 52, 53],
        flags: [trackerIdByName.inreach, trackerIdByName.inreach, trackerIdByName.inreach],
        extra: {
          0: { message: 'hello' },
          2: { speed: 10 },
        },
      };

      const track2: LiveTrack = {
        timeSec: [20],
        lat: [0],
        lon: [0],
        alt: [0],
        gndAlt: [0],
        flags: [trackerIdByName.spot | LiveTrackFlag.LowBat],
        extra: {
          0: { message: 'world' },
        },
      };

      expect(mergeLiveTracks(track1, track2)).toEqual({
        timeSec: [10, 20, 30],
        lat: [11, 12, 13],
        lon: [21, 22, 23],
        alt: [31, 32, 33],
        gndAlt: [51, 52, 53],
        flags: [trackerIdByName.inreach, trackerIdByName.inreach | LiveTrackFlag.LowBat, trackerIdByName.inreach],
        extra: {
          0: { message: 'hello' },
          2: { speed: 10 },
          1: { message: 'world' },
        },
      });
    });

    it('should merge valid fixes first', () => {
      const track1: LiveTrack = {
        timeSec: [10, 20, 30],
        lat: [11, 0, 13],
        lon: [21, 0, 23],
        alt: [31, 0, 33],
        gndAlt: [51, NO_GROUND_ALTITUDE, 53],
        flags: [trackerIdByName.inreach, trackerIdByName.inreach, trackerIdByName.inreach],
        extra: {
          0: { message: 'hello' },
          2: { speed: 10 },
        },
      };

      const track2: LiveTrack = {
        timeSec: [20],
        lat: [12],
        lon: [22],
        alt: [32],
        gndAlt: [52],
        flags: [trackerIdByName.spot | LiveTrackFlag.Valid],
        extra: {
          0: { message: 'world' },
        },
      };

      expect(mergeLiveTracks(track1, track2)).toEqual({
        timeSec: [10, 20, 30],
        lat: [11, 12, 13],
        lon: [21, 22, 23],
        alt: [31, 32, 33],
        gndAlt: [51, 52, 53],
        flags: [trackerIdByName.inreach, trackerIdByName.spot | LiveTrackFlag.Valid, trackerIdByName.inreach],
        extra: {
          0: { message: 'hello' },
          2: { speed: 10 },
          1: { message: 'world' },
        },
      });
    });

    it('should merge extras', () => {
      const track1: LiveTrack = {
        timeSec: [10, 20, 30, 40, 50],
        lat: [11, 12, 13, 14, 15],
        lon: [21, 22, 23, 24, 25],
        alt: [31, 32, 33, 34, 35],
        gndAlt: [51, 52, 53, 54, 55],
        flags: [
          trackerIdByName.spot | LiveTrackFlag.Valid,
          trackerIdByName.spot | LiveTrackFlag.Valid,
          trackerIdByName.spot | LiveTrackFlag.Valid,
          trackerIdByName.spot | LiveTrackFlag.Valid,
          trackerIdByName.spot | LiveTrackFlag.Valid,
        ],
        extra: {
          0: { message: 'hello' },
          1: { speed: 1 },
          2: { message: '1', speed: 1 },
        },
      };

      const track2: LiveTrack = {
        timeSec: [10, 20, 30, 40],
        lat: [11, 12, 13, 14],
        lon: [21, 22, 23, 24],
        alt: [31, 32, 33, 34],
        gndAlt: [51, 52, 53, 54],
        flags: [
          trackerIdByName.spot | LiveTrackFlag.Valid,
          trackerIdByName.spot | LiveTrackFlag.Valid,
          trackerIdByName.spot | LiveTrackFlag.Valid,
          trackerIdByName.spot | LiveTrackFlag.Valid,
        ],
        extra: {
          0: { speed: 2 },
          1: { message: 'olleh' },
          3: { message: '2', speed: 2 },
        },
      };

      expect(mergeLiveTracks(track1, track2)).toEqual({
        timeSec: [10, 20, 30, 40, 50],
        lat: [11, 12, 13, 14, 15],
        lon: [21, 22, 23, 24, 25],
        alt: [31, 32, 33, 34, 35],
        gndAlt: [51, 52, 53, 54, 55],
        flags: [
          trackerIdByName.spot | LiveTrackFlag.Valid,
          trackerIdByName.spot | LiveTrackFlag.Valid,
          trackerIdByName.spot | LiveTrackFlag.Valid,
          trackerIdByName.spot | LiveTrackFlag.Valid,
          trackerIdByName.spot | LiveTrackFlag.Valid,
        ],
        extra: {
          0: { message: 'hello', speed: 2 },
          1: { message: 'olleh', speed: 1 },
          2: { message: '1', speed: 1 },
          3: { message: '2', speed: 2 },
        },
      });
    });

    it('should merge the name', () => {
      const track1 = LiveTrack.create({ name: 'me' });
      const track2 = LiveTrack.create({});

      expect(mergeLiveTracks(track1, track2)).toMatchObject({
        name: 'me',
      });
      expect(mergeLiveTracks(track2, track1)).toMatchObject({
        name: 'me',
      });
    });

    it('should merge the id', () => {
      const track1 = LiveTrack.create({ id: 123 });
      const track2 = LiveTrack.create({});

      expect(mergeLiveTracks(track1, track2)).toMatchObject({
        id: 123,
      });
      expect(mergeLiveTracks(track2, track1)).toMatchObject({
        id: 123,
      });
    });

    it('should pick the valid ground altitude when merging fixes with the same timestamp', () => {
      const track1 = LiveTrack.create({
        lat: [10],
        lon: [20],
        alt: [1000],
        timeSec: [100],
        flags: [0],
        gndAlt: [NO_GROUND_ALTITUDE],
        extra: {},
      });
      const track2 = LiveTrack.create({
        lat: [10],
        lon: [20],
        alt: [1000],
        timeSec: [100],
        flags: [0],
        gndAlt: [450],
        extra: {},
      });

      expect(mergeLiveTracks(track1, track2).gndAlt[0]).toBe(450);
      expect(mergeLiveTracks(track2, track1).gndAlt[0]).toBe(450);
    });

    it('should preserve ground altitude when merging update', () => {
      const initialTrack = LiveTrack.create({
        lat: [45.0, 45.1, 45.2],
        lon: [6.0, 6.1, 6.2],
        alt: [1000, 1100, 1200],
        timeSec: [100, 200, 300],
        flags: [0, 0, 0],
        gndAlt: [NO_GROUND_ALTITUDE, NO_GROUND_ALTITUDE, NO_GROUND_ALTITUDE],
        extra: {},
      });
      const updateTrack = LiveTrack.create({
        lat: [45.3, 45.4],
        lon: [6.3, 6.4],
        alt: [1300, 1400],
        timeSec: [400, 500],
        flags: [0, 0],
        gndAlt: [550, 560],
        extra: {},
      });

      const merged = mergeLiveTracks(initialTrack, updateTrack);
      expect(merged.gndAlt[0]).toBe(NO_GROUND_ALTITUDE);
      expect(merged.gndAlt[3]).toBe(550);
      expect(merged.gndAlt[4]).toBe(560);
    });

    it('should preserve existing valid ground altitude when incoming is NO_GROUND_ALTITUDE', () => {
      const trackWithValid = LiveTrack.create({
        lat: [10],
        lon: [20],
        alt: [1000],
        timeSec: [100],
        flags: [0],
        gndAlt: [450],
        extra: {},
      });
      const trackWithSentinel = LiveTrack.create({
        lat: [10],
        lon: [20],
        alt: [1000],
        timeSec: [100],
        flags: [0],
        gndAlt: [NO_GROUND_ALTITUDE],
        extra: {},
      });

      expect(mergeLiveTracks(trackWithValid, trackWithSentinel).gndAlt[0]).toBe(450);
      expect(mergeLiveTracks(trackWithSentinel, trackWithValid).gndAlt[0]).toBe(450);
    });

    it('should not mutate input tracks when merging equal-timestamp fixes with extras', () => {
      const track1 = LiveTrack.create({
        lat: [10],
        lon: [20],
        alt: [1000],
        timeSec: [100],
        flags: [0],
        extra: { 0: { speed: 10, message: 'm1' } },
      });
      const track2 = LiveTrack.create({
        lat: [10],
        lon: [20],
        alt: [1000],
        timeSec: [100],
        flags: [0],
        extra: { 0: { speed: 20, message: 'm2' } },
      });

      const merged = mergeLiveTracks(track1, track2);
      expect(merged.extra[0]).toEqual({ speed: 20, message: 'm2' });
      expect(track1.extra[0]).toEqual({ speed: 10, message: 'm1' });
      expect(track2.extra[0]).toEqual({ speed: 20, message: 'm2' });
    });
  });
});

describe('differential', () => {
  it('should encode', () => {
    const track: LiveTrack = {
      lat: [10.00001, 10.0000234, 10.00012, 10.00112],
      lon: [10.00001, 10.00001, 10.00001, 10.00001],
      alt: [100, 200, 300, 1300],
      gndAlt: [50, 150, 250, 1250],
      timeSec: [1, 2, 12, 112],
      flags: [1, 2, 10, 20],
      extra: {
        1: { message: 'hello', speed: 100 },
      },
    };

    expect(differentialEncodeLiveTrack(track, 321, 'name')).toEqual({
      alt: [100, 100, 100, 1000],
      gndAlt: [50, 100, 100, 1000],
      extra: {
        '1': {
          message: 'hello',
          speed: 100,
        },
      },
      id: 321,
      lat: [1000001, 1, 10, 100],
      lon: [1000001, 0, 0, 0],
      name: 'name',
      flags: [1, 2, 10, 20],
      timeSec: [1, 1, 10, 100],
    });
  });

  it('should decode', () => {
    const diffTrack = {
      alt: [100, 100, 100, 1000],
      gndAlt: [50, 100, 100, 1000],
      extra: {
        '1': {
          message: 'hello',
          speed: 100,
        },
      },
      id: 321,
      lat: [1000001, 1, 10, 100],
      lon: [1000001, 0, 0, 0],
      name: 'name',
      flags: [1, 2, 10, 20],
      timeSec: [1, 1, 10, 100],
    };

    expect(differentialDecodeLiveTrack(diffTrack)).toEqual({
      name: 'name',
      id: 321,
      lat: [10.00001, 10.00002, 10.00012, 10.00112],
      lon: [10.00001, 10.00001, 10.00001, 10.00001],
      alt: [100, 200, 300, 1300],
      gndAlt: [50, 150, 250, 1250],
      timeSec: [1, 2, 12, 112],
      flags: [1, 2, 10, 20],
      extra: {
        1: { message: 'hello', speed: 100 },
      },
    });
  });

  it('should fill gndAlt with sentinel if missing in diffTrack', () => {
    const diffTrack = {
      alt: [100, 100],
      extra: {},
      id: 321,
      lat: [1000001, 1],
      lon: [1000001, 0],
      name: 'name',
      flags: [1, 2],
      timeSec: [1, 1],
    };

    const decoded = differentialDecodeLiveTrack(diffTrack as any);
    expect(decoded.gndAlt).toEqual([NO_GROUND_ALTITUDE, NO_GROUND_ALTITUDE]);
  });
});

describe('isEmergencyTrack', () => {
  it('should return true if any fix is an emergency', () => {
    const track: LiveTrack = {
      timeSec: [10, 20, 30],
      lat: [11, 12, 13],
      lon: [21, 22, 23],
      alt: [31, 32, 33],
      gndAlt: [21, 22, 23],
      flags: [trackerIdByName.inreach, trackerIdByName.inreach | LiveTrackFlag.Emergency, trackerIdByName.inreach],
      extra: {
        0: { message: 'hello' },
        2: { speed: 10 },
      },
    };

    expect(isEmergencyTrack(track)).toEqual(true);
  });

  it('should return false if no fix is an emergency', () => {
    const track: LiveTrack = {
      timeSec: [10, 20, 30],
      lat: [11, 12, 13],
      lon: [21, 22, 23],
      alt: [31, 32, 33],
      gndAlt: [21, 22, 23],
      flags: [trackerIdByName.inreach, trackerIdByName.inreach, trackerIdByName.inreach],
      extra: {
        0: { message: 'hello' },
        2: { speed: 10 },
      },
    };

    expect(isEmergencyTrack(track)).toEqual(false);
  });
});

describe('getLastMessage', () => {
  it('should return undefined if no message', () => {
    const track: LiveTrack = {
      timeSec: [10, 20, 30],
      lat: [11, 12, 13],
      lon: [21, 22, 23],
      alt: [31, 32, 33],
      gndAlt: [21, 22, 23],
      flags: [trackerIdByName.inreach, trackerIdByName.inreach, trackerIdByName.inreach],
      extra: {
        0: { speed: 5 },
        2: { speed: 10 },
      },
    };

    expect(getLastMessage(track)).toBe(undefined);
  });

  it('should return a message', () => {
    const track: LiveTrack = {
      timeSec: [10, 20, 30],
      lat: [11, 12, 13],
      lon: [21, 22, 23],
      alt: [31, 32, 33],
      gndAlt: [21, 22, 23],
      flags: [trackerIdByName.inreach, trackerIdByName.inreach, trackerIdByName.inreach],
      extra: {
        0: { message: 'hello' },
        2: { speed: 10 },
      },
    };

    expect(getLastMessage(track)).toEqual({ text: 'hello', timeSec: 10 });
  });

  it('should return the last message', () => {
    const track: LiveTrack = {
      timeSec: [10, 20, 30],
      lat: [11, 12, 13],
      lon: [21, 22, 23],
      alt: [31, 32, 33],
      gndAlt: [21, 22, 23],
      flags: [trackerIdByName.inreach, trackerIdByName.inreach, trackerIdByName.inreach],
      extra: {
        0: { message: 'first' },
        2: { speed: 10, message: 'last' },
      },
    };

    expect(getLastMessage(track)).toEqual({ text: 'last', timeSec: 30 });
  });
});
