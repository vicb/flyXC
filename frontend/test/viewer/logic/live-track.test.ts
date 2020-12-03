import { LiveDifferentialTrackGroup, LiveTrack } from 'flyxc/common/protos/live-track';
import { differentialEncodeLiveTrack, LiveTrackFlag, TrackerIds } from 'flyxc/common/src/live-track';
import { trackToFeatures, updateLiveTracks } from 'flyxc/frontend/src/viewer/logic/live-track';

describe('Create GeoJSON features', () => {
  it('should support an empty track', () => {
    expect(trackToFeatures(LiveTrack.create(), 10)).toEqual([]);
  });

  describe('Single segment', () => {
    it('should work with a single point', () => {
      const track: LiveTrack = {
        id: 123,
        timeSec: [10],
        lon: [11],
        lat: [21],
        alt: [31],
        flags: [TrackerIds.Flyme],
        extra: {},
      };

      expect(trackToFeatures(track, 10)).toEqual([
        {
          geometry: {
            coordinates: [11, 21, 31],
            type: 'Point',
          },
          properties: {
            heading: 0,
            id: 123,
            index: 0,
            isLast: true,
          },
          type: 'Feature',
        },
      ]);
    });

    it('should add points for start, end', () => {
      const track: LiveTrack = {
        id: 123,
        timeSec: [1, 10, 20, 30, 40, 50, 60],
        lon: [11, 110, 120, 130, 140, 150, 160],
        lat: [21, 210, 220, 230, 240, 250, 260],
        alt: [31, 310, 320, 330, 340, 350, 360],
        flags: [
          TrackerIds.Flyme,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
        ],
        extra: {},
      };

      expect(trackToFeatures(track, 10)).toEqual([
        {
          geometry: {
            coordinates: [
              [11, 21, 31],
              [110, 210, 310],
              [120, 220, 320],
              [130, 230, 330],
              [140, 240, 340],
              [150, 250, 350],
              [160, 260, 360],
            ],
            type: 'LineString',
          },
          properties: {
            endIndex: 6,
            id: 123,
            startIndex: 0,
            last: true,
          },
          type: 'Feature',
        },
        {
          geometry: {
            coordinates: [11, 21, 31],
            type: 'Point',
          },
          properties: {
            id: 123,
            index: 0,
          },
          type: 'Feature',
        },
        {
          geometry: {
            coordinates: [160, 260, 360],
            type: 'Point',
          },
          properties: {
            heading: 166,
            id: 123,
            index: 6,
            isLast: true,
          },
          type: 'Feature',
        },
      ]);
    });

    it('should add points for the last few points', () => {
      const track: LiveTrack = {
        id: 123,
        timeSec: [1, 1000, 2000, 3000, 4000, 5000, 6000],
        lon: [11, 110, 120, 130, 140, 150, 160],
        lat: [21, 210, 220, 230, 240, 250, 260],
        alt: [31, 310, 320, 330, 340, 350, 360],
        flags: [
          TrackerIds.Flyme,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
        ],
        extra: {},
      };

      const features = trackToFeatures(track, 1000);

      expect(features).toContainEqual({
        geometry: {
          coordinates: [150, 250, 350],
          type: 'Point',
        },
        properties: {
          id: 123,
          index: 5,
        },
        type: 'Feature',
      });

      expect(features).toContainEqual({
        geometry: {
          coordinates: [140, 240, 340],
          type: 'Point',
        },
        properties: {
          id: 123,
          index: 4,
        },
        type: 'Feature',
      });

      expect(features).toContainEqual({
        geometry: {
          coordinates: [130, 230, 330],
          type: 'Point',
        },
        properties: {
          id: 123,
          index: 3,
        },
        type: 'Feature',
      });
    });

    it('should add points for messages', () => {
      const track: LiveTrack = {
        id: 123,
        timeSec: [1, 10, 20, 30, 40, 50, 60],
        lon: [11, 110, 120, 130, 140, 150, 160],
        lat: [21, 210, 220, 230, 240, 250, 260],
        alt: [31, 310, 320, 330, 340, 350, 360],
        flags: [
          TrackerIds.Flyme,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
        ],
        extra: {
          1: { message: 'test' },
          2: { speed: 20 },
        },
      };

      expect(trackToFeatures(track, 10)).toContainEqual({
        geometry: {
          coordinates: [110, 210, 310],
          type: 'Point',
        },
        properties: {
          id: 123,
          index: 1,
        },
        type: 'Feature',
      });
    });

    it('should add points for emergency', () => {
      const track: LiveTrack = {
        id: 123,
        timeSec: [1, 10, 20, 30, 40, 50, 60],
        lon: [11, 110, 120, 130, 140, 150, 160],
        lat: [21, 210, 220, 230, 240, 250, 260],
        alt: [31, 310, 320, 330, 340, 350, 360],
        flags: [
          TrackerIds.Flyme,
          TrackerIds.Flyme | LiveTrackFlag.Emergency,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
          TrackerIds.Flyme,
        ],
        extra: {},
      };

      expect(trackToFeatures(track, 10)).toContainEqual({
        geometry: {
          coordinates: [110, 210, 310],
          type: 'Point',
        },
        properties: {
          id: 123,
          index: 1,
        },
        type: 'Feature',
      });
    });
  });

  describe('Multiple segments', () => {
    const track: LiveTrack = {
      id: 123,
      timeSec: [1, 10, 20, 100, 140, 150, 160],
      lon: [11, 110, 120, 130, 140, 150, 160],
      lat: [21, 210, 220, 230, 240, 250, 260],
      alt: [31, 310, 320, 330, 340, 350, 360],
      flags: [
        TrackerIds.Flyme,
        TrackerIds.Flyme,
        TrackerIds.Flyme,
        TrackerIds.Flyme,
        TrackerIds.Flyme,
        TrackerIds.Flyme,
        TrackerIds.Flyme,
      ],
      extra: {},
    };

    expect(trackToFeatures(track, 1)).toEqual([
      {
        geometry: {
          coordinates: [
            [11, 21, 31],
            [110, 210, 310],
            [120, 220, 320],
          ],
          type: 'LineString',
        },
        properties: {
          endIndex: 2,
          id: 123,
          startIndex: 0,
        },
        type: 'Feature',
      },
      {
        geometry: {
          coordinates: [
            [130, 230, 330],
            [140, 240, 340],
            [150, 250, 350],
            [160, 260, 360],
          ],
          type: 'LineString',
        },
        properties: {
          endIndex: 6,
          id: 123,
          startIndex: 3,
          last: true,
        },
        type: 'Feature',
      },
      {
        geometry: {
          coordinates: [11, 21, 31],
          type: 'Point',
        },
        properties: {
          id: 123,
          index: 0,
        },
        type: 'Feature',
      },
      {
        geometry: {
          coordinates: [120, 220, 320],
          type: 'Point',
        },
        properties: {
          id: 123,
          index: 2,
        },
        type: 'Feature',
      },
      {
        geometry: {
          coordinates: [130, 230, 330],
          type: 'Point',
        },
        properties: {
          id: 123,
          index: 3,
        },
        type: 'Feature',
      },
      {
        geometry: {
          coordinates: [160, 260, 360],
          type: 'Point',
        },
        properties: {
          heading: 166,
          id: 123,
          index: 6,
          isLast: true,
        },
        type: 'Feature',
      },
    ]);
  });
});

describe('Update live tracks', () => {
  describe('Only current tracks', () => {
    it('should replace current tracks', () => {
      const current: LiveTrack = {
        id: 1,
        name: 'current',
        timeSec: [10, 20, 30],
        lat: [11, 21, 31],
        lon: [12, 22, 32],
        alt: [13, 23, 33],
        flags: [1, 1, 1],
        extra: {},
      };

      const update: LiveTrack = {
        timeSec: [10, 20, 30],
        lat: [11, 21, 31],
        lon: [12, 22, 32],
        alt: [13, 23, 33],
        flags: [1, 1, 1],
        extra: {},
      };

      const updates = LiveDifferentialTrackGroup.create({
        tracks: [differentialEncodeLiveTrack(update, 2, 'update')],
        incremental: false,
      });

      expect(updateLiveTracks({ 1: current }, updates, 0)).toEqual([{ ...update, id: 2, name: 'update' }]);
    });
  });

  describe('Only incremental updates', () => {
    it('should merge updates', () => {
      const update1: LiveTrack = {
        timeSec: [10, 20, 30],
        lat: [11, 21, 31],
        lon: [12, 22, 32],
        alt: [13, 23, 33],
        flags: [1, 1, 1],
        extra: {},
      };

      const update2: LiveTrack = {
        timeSec: [110, 120, 130],
        lat: [111, 121, 132],
        lon: [112, 122, 132],
        alt: [113, 123, 133],
        flags: [2, 2, 2],
        extra: {},
      };

      const updates = LiveDifferentialTrackGroup.create({
        tracks: [
          differentialEncodeLiveTrack(update1, 1, 'update1'),
          differentialEncodeLiveTrack(update2, 2, 'update2'),
        ],
        incremental: true,
      });

      expect(updateLiveTracks({}, updates, 0)).toEqual([
        { ...update1, id: 1, name: 'update1' },
        { ...update2, id: 2, name: 'update2' },
      ]);
    });
  });

  describe('Current and incremental tracks', () => {
    it('should merge updates', () => {
      const current1: LiveTrack = {
        id: 1,
        name: 'track1',
        timeSec: [100, 200, 300],
        lat: [11, 21, 31],
        lon: [12, 22, 32],
        alt: [13, 23, 33],
        flags: [1, 1, 1],
        extra: {},
      };

      const update1: LiveTrack = {
        timeSec: [250, 350, 450],
        lat: [110, 210, 310],
        lon: [120, 220, 320],
        alt: [130, 230, 330],
        flags: [2, 2, 2],
        extra: { 0: { message: 'test' } },
      };

      const current2: LiveTrack = {
        id: 2,
        name: 'track2',
        timeSec: [10, 20, 30],
        lat: [11, 21, 32],
        lon: [12, 22, 32],
        alt: [13, 23, 33],
        flags: [1, 1, 1],
        extra: {},
      };

      const update3: LiveTrack = {
        timeSec: [110, 120, 130],
        lat: [111, 121, 132],
        lon: [112, 122, 132],
        alt: [113, 123, 133],
        flags: [2, 2, 2],
        extra: {},
      };

      const updates = LiveDifferentialTrackGroup.create({
        tracks: [differentialEncodeLiveTrack(update1, 1, 'track1'), differentialEncodeLiveTrack(update3, 3, 'track3')],
        incremental: true,
      });

      expect(updateLiveTracks({ 1: current1, 2: current2 }, updates, 0)).toEqual([
        {
          id: 1,
          name: 'track1',
          timeSec: [100, 200, 250, 300, 350, 450],
          lat: [11, 21, 110, 31, 210, 310],
          lon: [12, 22, 120, 32, 220, 320],
          alt: [13, 23, 130, 33, 230, 330],
          flags: [1, 1, 2, 1, 2, 2],
          extra: { 2: { message: 'test' } },
        },
        current2,
        { ...update3, id: 3, name: 'track3' },
      ]);
    });

    it('should drop old fixes', () => {
      const current1: LiveTrack = {
        id: 1,
        name: 'track1',
        timeSec: [100, 200, 300],
        lat: [11, 21, 31],
        lon: [12, 22, 32],
        alt: [13, 23, 33],
        flags: [1, 1, 1],
        extra: {},
      };

      const update1: LiveTrack = {
        timeSec: [250, 350, 450],
        lat: [110, 210, 310],
        lon: [120, 220, 320],
        alt: [130, 230, 330],
        flags: [2, 2, 2],
        extra: { 0: { message: 'test' } },
      };

      const updates = LiveDifferentialTrackGroup.create({
        tracks: [differentialEncodeLiveTrack(update1, 1, 'track1')],
        incremental: true,
      });

      expect(updateLiveTracks({ 1: current1 }, updates, 210)).toEqual([
        {
          id: 1,
          name: 'track1',
          timeSec: [250, 300, 350, 450],
          lat: [110, 31, 210, 310],
          lon: [120, 32, 220, 320],
          alt: [130, 33, 230, 330],
          flags: [2, 1, 2, 2],
          extra: { 0: { message: 'test' } },
        },
      ]);
    });

    it('should drop empty tracks', () => {
      const current1: LiveTrack = {
        id: 1,
        name: 'track1',
        timeSec: [100, 200, 300],
        lat: [11, 21, 31],
        lon: [12, 22, 32],
        alt: [13, 23, 33],
        flags: [1, 1, 1],
        extra: {},
      };

      const update1: LiveTrack = {
        timeSec: [250, 350, 450],
        lat: [110, 210, 310],
        lon: [120, 220, 320],
        alt: [130, 230, 330],
        flags: [2, 2, 2],
        extra: { 0: { message: 'test' } },
      };

      const current2: LiveTrack = {
        id: 2,
        name: 'track2',
        timeSec: [10, 20, 30],
        lat: [11, 21, 32],
        lon: [12, 22, 32],
        alt: [13, 23, 33],
        flags: [1, 1, 1],
        extra: {},
      };

      const updates = LiveDifferentialTrackGroup.create({
        tracks: [differentialEncodeLiveTrack(update1, 1, 'track1')],
        incremental: true,
      });

      expect(updateLiveTracks({ 1: current1, 2: current2 }, updates, 50)).toEqual([
        {
          id: 1,
          name: 'track1',
          timeSec: [100, 200, 250, 300, 350, 450],
          lat: [11, 21, 110, 31, 210, 310],
          lon: [12, 22, 120, 32, 220, 320],
          alt: [13, 23, 130, 33, 230, 330],
          flags: [1, 1, 2, 1, 2, 2],
          extra: { 2: { message: 'test' } },
        },
      ]);
    });
  });
});
