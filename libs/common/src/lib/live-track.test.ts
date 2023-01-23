import {
  differentialDecodeLiveTrack,
  differentialEncodeLiveTrack,
  getLastMessage,
  isEmergencyTrack,
  LiveTrackFlag,
  mergeLiveTracks,
  removeBeforeFromLiveTrack,
  removeDeviceFromLiveTrack,
  simplifyLiveTrack,
  trackerIdByName,
} from './live-track';

import { LiveTrack } from '../protos/live-track';

describe('removeBeforeFromLiveTrack', () => {
  let track: LiveTrack;
  beforeAll(() => {
    track = {
      timeSec: [10, 20, 30, 40],
      lat: [11, 21, 31, 41],
      lon: [12, 22, 32, 42],
      alt: [13, 23, 33, 43],
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
});

describe('removeDeviceFromLiveTrack', () => {
  let track: LiveTrack;
  beforeAll(() => {
    track = {
      timeSec: [10, 20, 30, 40],
      lat: [11, 21, 31, 41],
      lon: [12, 22, 32, 42],
      alt: [13, 23, 33, 43],
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
      flags: [trackerIdByName['inreach'], trackerIdByName.inreach],
      extra: { 1: { speed: 10 } },
    });

    expect(removeDeviceFromLiveTrack(track, 'inreach')).toEqual({
      timeSec: [30, 40],
      lat: [31, 41],
      lon: [32, 42],
      alt: [33, 43],
      flags: [trackerIdByName['flyme'], trackerIdByName.flyme],
      extra: { 0: { message: 'hello' } },
    });
  });

  it('should leave the track unchanged if devices is not used', () => {
    expect(removeDeviceFromLiveTrack(track, 'spot')).toEqual({
      timeSec: [10, 20, 30, 40],
      lat: [11, 21, 31, 41],
      lon: [12, 22, 32, 42],
      alt: [13, 23, 33, 43],
      flags: [trackerIdByName.inreach, trackerIdByName.inreach, trackerIdByName.flyme, trackerIdByName.flyme],
      extra: { 1: { speed: 10 }, 2: { message: 'hello' } },
    });
  });
});

describe('simplifyLiveTrack', () => {
  it('should simplify a track', () => {
    const track: LiveTrack = {
      timeSec: [1, 10, 20, 25, 30, 35, 40, 45],
      lat: [2, 11, 21, 26, 31, 36, 41, 46],
      lon: [3, 12, 22, 27, 32, 37, 42, 47],
      alt: [4, 13, 23, 28, 33, 38, 43, 48],
      flags: [0, 0, 0, 0, 0, 0, 0, 0],
      extra: {},
    };

    simplifyLiveTrack(track, 10);

    expect(track).toEqual({
      timeSec: [1, 20, 30, 40, 45],
      lat: [2, 21, 31, 41, 46],
      lon: [3, 22, 32, 42, 47],
      alt: [4, 23, 33, 43, 48],
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
      flags: [0, 0, 0, 0, 0, 0, 0, 0],
      extra: { 3: { message: 'hello' } },
    };

    simplifyLiveTrack(track, 1);

    expect(track).toEqual({
      timeSec: [1, 10, 20, 25, 30, 35, 40, 45],
      lat: [2, 11, 21, 26, 31, 36, 41, 46],
      lon: [3, 12, 22, 27, 32, 37, 42, 47],
      alt: [4, 13, 23, 28, 33, 38, 43, 48],
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
      flags: [0, 0, 0, 0, 0, 0, 0, 0],
      extra: { 4: { message: 'hello' } },
    };

    simplifyLiveTrack(track, 10, { fromSec: 26 });

    expect(track).toEqual({
      timeSec: [1, 10, 20, 25, 30, 40, 45],
      lat: [2, 11, 21, 26, 31, 41, 46],
      lon: [3, 12, 22, 27, 32, 42, 47],
      alt: [4, 13, 23, 28, 33, 43, 48],
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
      flags: [],
      extra: {},
    };

    simplifyLiveTrack(track, 10, { fromSec: 26 });

    expect(track).toEqual({
      timeSec: [],
      lat: [],
      lon: [],
      alt: [],
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
      flags: [0, 0, 0, 0, 0, 0, 0, 0],
      extra: { 4: { message: 'hello' } },
    };

    simplifyLiveTrack(track, 10, { fromSec: 50 });

    expect(track).toEqual({
      timeSec: [1, 10, 20, 25, 30, 35, 40, 45],
      lat: [2, 11, 21, 26, 31, 36, 41, 46],
      lon: [3, 12, 22, 27, 32, 37, 42, 47],
      alt: [4, 13, 23, 28, 33, 38, 43, 48],
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
      flags: [0, 0, 0, 0, 0, 0, 0, 0],
      extra: { 4: { message: 'hello' } },
    };

    simplifyLiveTrack(track, 10, { toSec: 25 });

    expect(track).toEqual({
      timeSec: [1, 20, 30, 35, 40, 45],
      lat: [2, 21, 31, 36, 41, 46],
      lon: [3, 22, 32, 37, 42, 47],
      alt: [4, 23, 33, 38, 43, 48],
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
      flags: [],
      extra: {},
    };

    simplifyLiveTrack(track, 10, { toSec: 26 });

    expect(track).toEqual({
      timeSec: [],
      lat: [],
      lon: [],
      alt: [],
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
      flags: [0, 0, 0, 0, 0, 0, 0, 0],
      extra: { 4: { message: 'hello' } },
    };

    simplifyLiveTrack(track, 10, { toSec: 50 });

    expect(track).toEqual({
      timeSec: [51, 52, 53, 54, 55, 56, 57, 58],
      lat: [2, 11, 21, 26, 31, 36, 41, 46],
      lon: [3, 12, 22, 27, 32, 37, 42, 47],
      alt: [4, 13, 23, 28, 33, 38, 43, 48],
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
      flags: [0, 0, 0, 0, 0, 0, 0, 0],
      extra: { 4: { message: 'hello' } },
    };

    simplifyLiveTrack(track, 10, { fromSec: 53, toSec: 57 });

    expect(track).toEqual({
      timeSec: [51, 52, 53, 55, 58],
      lat: [2, 11, 21, 31, 46],
      lon: [3, 12, 22, 32, 47],
      alt: [4, 13, 23, 33, 48],
      flags: [0, 0, 0, 0, 0],
      extra: { 3: { message: 'hello' } },
    });
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

  it('should merge non-overlapping tracks', () => {
    const track1: LiveTrack = {
      timeSec: [1, 2, 3],
      lat: [11, 12, 13],
      lon: [21, 22, 23],
      alt: [31, 32, 33],
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
        flags: [trackerIdByName['inreach'], trackerIdByName.inreach, trackerIdByName.inreach],
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
        flags: [trackerIdByName['spot'] | LiveTrackFlag.Emergency],
        extra: {
          0: { message: 'world' },
        },
      };

      expect(mergeLiveTracks(track1, track2)).toEqual({
        timeSec: [10, 20, 30],
        lat: [11, 12, 13],
        lon: [21, 22, 23],
        alt: [31, 32, 33],
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
        flags: [trackerIdByName['inreach'], trackerIdByName.inreach, trackerIdByName.inreach],
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
        flags: [trackerIdByName['spot'] | LiveTrackFlag.LowBat],
        extra: {
          0: { message: 'world' },
        },
      };

      expect(mergeLiveTracks(track1, track2)).toEqual({
        timeSec: [10, 20, 30],
        lat: [11, 12, 13],
        lon: [21, 22, 23],
        alt: [31, 32, 33],
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
        flags: [trackerIdByName['inreach'], trackerIdByName.inreach, trackerIdByName.inreach],
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
        flags: [trackerIdByName['spot'] | LiveTrackFlag.Valid],
        extra: {
          0: { message: 'world' },
        },
      };

      expect(mergeLiveTracks(track1, track2)).toEqual({
        timeSec: [10, 20, 30],
        lat: [11, 12, 13],
        lon: [21, 22, 23],
        alt: [31, 32, 33],
        flags: [trackerIdByName['inreach'], trackerIdByName.spot | LiveTrackFlag.Valid, trackerIdByName.inreach],
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
        flags: [
          trackerIdByName.spot | LiveTrackFlag.Valid,
          trackerIdByName.spot | LiveTrackFlag.Valid,
          trackerIdByName.spot | LiveTrackFlag.Valid,
          trackerIdByName.spot | LiveTrackFlag.Valid,
        ],
        extra: {
          0: { speed: 2 },
          1: { message: 'olleh' },
          3: { message: '2', speed: 2, gndAlt: 100 },
        },
      };

      expect(mergeLiveTracks(track1, track2)).toEqual({
        timeSec: [10, 20, 30, 40, 50],
        lat: [11, 12, 13, 14, 15],
        lon: [21, 22, 23, 24, 25],
        alt: [31, 32, 33, 34, 35],
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
          3: { message: '2', speed: 2, gndAlt: 100 },
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
  });
});

describe('differential', () => {
  it('should encode', () => {
    const track: LiveTrack = {
      lat: [10.00001, 10.0000234, 10.00012, 10.00112],
      lon: [10.00001, 10.00001, 10.00001, 10.00001],
      alt: [100, 200, 300, 1300],
      timeSec: [1, 2, 12, 112],
      flags: [1, 2, 10, 20],
      extra: {
        1: { message: 'hello', speed: 100, gndAlt: 123 },
      },
    };

    expect(differentialEncodeLiveTrack(track, 321, 'name')).toEqual({
      alt: [100, 100, 100, 1000],
      extra: {
        '1': {
          message: 'hello',
          speed: 100,
          gndAlt: 123,
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
      extra: {
        '1': {
          message: 'hello',
          speed: 100,
          gndAlt: 321,
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
      timeSec: [1, 2, 12, 112],
      flags: [1, 2, 10, 20],
      extra: {
        1: { message: 'hello', speed: 100, gndAlt: 321 },
      },
    });
  });
});

describe('isEmergencyTrack', () => {
  it('should return true if any fix is an emergency', () => {
    const track: LiveTrack = {
      timeSec: [10, 20, 30],
      lat: [11, 12, 13],
      lon: [21, 22, 23],
      alt: [31, 32, 33],
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
      flags: [trackerIdByName['inreach'], trackerIdByName.inreach, trackerIdByName.inreach],
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
      flags: [trackerIdByName['inreach'], trackerIdByName.inreach, trackerIdByName.inreach],
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
      flags: [trackerIdByName['inreach'], trackerIdByName.inreach, trackerIdByName.inreach],
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
      flags: [trackerIdByName['inreach'], trackerIdByName.inreach, trackerIdByName.inreach],
      extra: {
        0: { message: 'first' },
        2: { speed: 10, message: 'last' },
      },
    };

    expect(getLastMessage(track)).toEqual({ text: 'last', timeSec: 30 });
  });
});
