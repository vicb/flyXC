import {
  differentialEncodeLiveTrack,
  LiveTrackDurationSec,
  LiveTrackFlag,
  NO_GROUND_ALTITUDE,
  protos,
  trackerIdByName,
} from '@flyxc/common';

import {
  FixType,
  getActiveTrackSegment,
  getFetchParameters,
  getLastSegmentStartIndex,
  trackToFeatures,
  updateLiveTracks,
} from './live-track';

describe('Create GeoJSON features', () => {
  it('should support an empty track', () => {
    expect(trackToFeatures(protos.LiveTrack.create(), 10)).toEqual([]);
  });

  describe('Single segment', () => {
    it('should work with a single point', () => {
      const track: protos.LiveTrack = {
        id: 123,
        timeSec: [10],
        lon: [11],
        lat: [21],
        alt: [31],
        gndAlt: [NO_GROUND_ALTITUDE],
        flags: [trackerIdByName.flyme],
        extra: {},
      };

      expect(trackToFeatures(track, 10)).toMatchInlineSnapshot(`
        [
          {
            "geometry": {
              "coordinates": [
                11,
                21,
                31,
              ],
              "type": "Point",
            },
            "properties": {
              "alt": 31,
              "fixType": 1,
              "gndAlt": undefined,
              "heading": 0,
              "id": "123-0",
              "index": 0,
              "isUfo": false,
              "name": undefined,
              "pilotId": "123",
              "timeSec": 10,
            },
            "type": "Feature",
          },
        ]
      `);
    });

    it('should add points for start, end', () => {
      const track: protos.LiveTrack = {
        id: 123,
        timeSec: [1, 10, 20, 30, 40, 50, 60],
        lon: [11, 110, 120, 130, 140, 150, 160],
        lat: [21, 210, 220, 230, 240, 250, 260],
        alt: [31, 310, 320, 330, 340, 350, 360],
        gndAlt: Array(7).fill(NO_GROUND_ALTITUDE),
        flags: [
          trackerIdByName.flyme,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
        ],
        extra: {},
      };

      expect(trackToFeatures(track, 10)).toMatchInlineSnapshot(`
        [
          {
            "geometry": {
              "coordinates": [
                [
                  11,
                  21,
                  31,
                ],
                [
                  110,
                  210,
                  310,
                ],
                [
                  120,
                  220,
                  320,
                ],
                [
                  130,
                  230,
                  330,
                ],
                [
                  140,
                  240,
                  340,
                ],
                [
                  150,
                  250,
                  350,
                ],
                [
                  160,
                  260,
                  360,
                ],
              ],
              "type": "LineString",
            },
            "properties": {
              "firstIndex": 0,
              "id": "123",
              "isEmergency": false,
              "isUfo": false,
              "last": true,
              "lastIndex": 6,
              "lastTimeSec": 60,
            },
            "type": "Feature",
          },
          {
            "geometry": {
              "coordinates": [
                11,
                21,
                31,
              ],
              "type": "Point",
            },
            "properties": {
              "alt": 31,
              "fixType": 0,
              "gndAlt": undefined,
              "id": "123-0",
              "index": 0,
              "isUfo": false,
              "name": undefined,
              "pilotId": "123",
              "timeSec": 1,
            },
            "type": "Feature",
          },
          {
            "geometry": {
              "coordinates": [
                160,
                260,
                360,
              ],
              "type": "Point",
            },
            "properties": {
              "alt": 360,
              "fixType": 1,
              "gndAlt": undefined,
              "heading": 166,
              "id": "123-6",
              "index": 6,
              "isUfo": false,
              "name": undefined,
              "pilotId": "123",
              "timeSec": 60,
            },
            "type": "Feature",
          },
        ]
      `);
    });

    it('should use gndAlt from LiveTrack when available', () => {
      const track: protos.LiveTrack = {
        id: 123,
        timeSec: [1, 10, 20],
        lon: [11, 12, 13],
        lat: [21, 22, 23],
        alt: [31, 32, 33],
        gndAlt: [99, 200, 300],
        flags: [trackerIdByName.flyme, trackerIdByName.flyme, trackerIdByName.flyme],
        extra: {
          1: { message: 'p1' },
        },
      };

      const features = trackToFeatures(track, 10).filter((f) => f.geometry.type === 'Point');
      expect(features).toHaveLength(3);
      expect(features[0].properties.gndAlt).toBe(99);
      expect(features[1].properties.gndAlt).toBe(200);
      expect(features[2].properties.gndAlt).toBe(300);
    });

    it('should add points for messages', () => {
      const track: protos.LiveTrack = {
        id: 123,
        timeSec: [1, 10, 20, 30, 40, 50, 60],
        lon: [11, 110, 120, 130, 140, 150, 160],
        lat: [21, 210, 220, 230, 240, 250, 260],
        alt: [31, 310, 320, 330, 340, 350, 360],
        gndAlt: Array(7).fill(NO_GROUND_ALTITUDE),
        flags: [
          trackerIdByName.flyme,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
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
          alt: 310,
          fixType: FixType.message,
          gndAlt: undefined,
          id: '123-1',
          index: 1,
          isUfo: false,
          msg: 'test',
          name: undefined,
          pilotId: '123',
          timeSec: 10,
        },
        type: 'Feature',
      });
    });

    it('should add points for emergency', () => {
      const track: protos.LiveTrack = {
        id: 123,
        timeSec: [1, 10, 20, 30, 40, 50, 60],
        lon: [11, 110, 120, 130, 140, 150, 160],
        lat: [21, 210, 220, 230, 240, 250, 260],
        alt: [31, 310, 320, 330, 340, 350, 360],
        gndAlt: Array(7).fill(NO_GROUND_ALTITUDE),
        flags: [
          trackerIdByName.flyme,
          trackerIdByName.flyme | LiveTrackFlag.Emergency,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
        ],
        extra: {},
      };

      expect(trackToFeatures(track, 10)).toContainEqual({
        geometry: {
          coordinates: [110, 210, 310],
          type: 'Point',
        },
        properties: {
          alt: 310,
          fixType: FixType.emergency,
          gndAlt: undefined,
          id: '123-1',
          index: 1,
          isUfo: false,
          name: undefined,
          pilotId: '123',
          timeSec: 10,
        },
        type: 'Feature',
      });
    });
  });

  describe('Multiple segments', () => {
    it('should split segments', () => {
      const track: protos.LiveTrack = {
        id: 123,
        timeSec: [1, 10, 20, 100, 140, 150, 160],
        lon: [11, 110, 120, 130, 140, 150, 160],
        lat: [21, 210, 220, 230, 240, 250, 260],
        alt: [31, 310, 320, 330, 340, 350, 360],
        gndAlt: Array(7).fill(NO_GROUND_ALTITUDE),
        flags: [
          trackerIdByName.flyme,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
          trackerIdByName.flyme,
        ],
        extra: {},
      };

      expect(trackToFeatures(track, 1)).toMatchInlineSnapshot(`
        [
          {
            "geometry": {
              "coordinates": [
                [
                  11,
                  21,
                  31,
                ],
                [
                  110,
                  210,
                  310,
                ],
                [
                  120,
                  220,
                  320,
                ],
              ],
              "type": "LineString",
            },
            "properties": {
              "firstIndex": 0,
              "id": "123",
              "isEmergency": false,
              "isUfo": false,
              "last": false,
              "lastIndex": 2,
              "lastTimeSec": 20,
            },
            "type": "Feature",
          },
          {
            "geometry": {
              "coordinates": [
                [
                  130,
                  230,
                  330,
                ],
                [
                  140,
                  240,
                  340,
                ],
                [
                  150,
                  250,
                  350,
                ],
                [
                  160,
                  260,
                  360,
                ],
              ],
              "type": "LineString",
            },
            "properties": {
              "firstIndex": 3,
              "id": "123",
              "isEmergency": false,
              "isUfo": false,
              "last": true,
              "lastIndex": 6,
              "lastTimeSec": 160,
            },
            "type": "Feature",
          },
          {
            "geometry": {
              "coordinates": [
                11,
                21,
                31,
              ],
              "type": "Point",
            },
            "properties": {
              "alt": 31,
              "fixType": 0,
              "gndAlt": undefined,
              "id": "123-0",
              "index": 0,
              "isUfo": false,
              "name": undefined,
              "pilotId": "123",
              "timeSec": 1,
            },
            "type": "Feature",
          },
          {
            "geometry": {
              "coordinates": [
                120,
                220,
                320,
              ],
              "type": "Point",
            },
            "properties": {
              "alt": 320,
              "fixType": 0,
              "gndAlt": undefined,
              "id": "123-2",
              "index": 2,
              "isUfo": false,
              "name": undefined,
              "pilotId": "123",
              "timeSec": 20,
            },
            "type": "Feature",
          },
          {
            "geometry": {
              "coordinates": [
                130,
                230,
                330,
              ],
              "type": "Point",
            },
            "properties": {
              "alt": 330,
              "fixType": 0,
              "gndAlt": undefined,
              "id": "123-3",
              "index": 3,
              "isUfo": false,
              "name": undefined,
              "pilotId": "123",
              "timeSec": 100,
            },
            "type": "Feature",
          },
          {
            "geometry": {
              "coordinates": [
                160,
                260,
                360,
              ],
              "type": "Point",
            },
            "properties": {
              "alt": 360,
              "fixType": 1,
              "gndAlt": undefined,
              "heading": 166,
              "id": "123-6",
              "index": 6,
              "isUfo": false,
              "name": undefined,
              "pilotId": "123",
              "timeSec": 160,
            },
            "type": "Feature",
          },
        ]
      `);
    });
  });
});

describe('Update live tracks', () => {
  describe('Only current tracks', () => {
    it('should replace current tracks', () => {
      const current: protos.LiveTrack = {
        id: 1,
        name: 'current',
        timeSec: [10, 20, 30],
        lat: [11, 21, 31],
        lon: [12, 22, 32],
        alt: [13, 23, 33],
        gndAlt: [0, 0, 0],
        flags: [1, 1, 1],
        extra: {},
      };

      const update: protos.LiveTrack = {
        timeSec: [10, 20, 30],
        lat: [11, 21, 31],
        lon: [12, 22, 32],
        alt: [13, 23, 33],
        gndAlt: [0, 0, 0],
        flags: [1, 1, 1],
        extra: {},
      };

      const updates = protos.LiveDifferentialTrackGroup.create({
        tracks: [differentialEncodeLiveTrack(update, 2, 'update')],
      });

      expect(updateLiveTracks({ 1: current }, updates, false)).toEqual([{ ...update, id: 2, name: 'update' }]);
    });
  });

  describe('Only incremental updates', () => {
    it('should merge updates', () => {
      const update1: protos.LiveTrack = {
        timeSec: [10, 20, 30],
        lat: [11, 21, 31],
        lon: [12, 22, 32],
        alt: [13, 23, 33],
        gndAlt: [0, 0, 0],
        flags: [1, 1, 1],
        extra: {},
      };

      const update2: protos.LiveTrack = {
        timeSec: [110, 120, 130],
        lat: [111, 121, 132],
        lon: [112, 122, 132],
        alt: [113, 123, 133],
        gndAlt: [0, 0, 0],
        flags: [2, 2, 2],
        extra: {},
      };

      const updates = protos.LiveDifferentialTrackGroup.create({
        tracks: [
          differentialEncodeLiveTrack(update1, 1, 'update1'),
          differentialEncodeLiveTrack(update2, 2, 'update2'),
        ],
      });

      expect(updateLiveTracks({}, updates, true)).toEqual([
        { ...update1, id: 1, name: 'update1' },
        { ...update2, id: 2, name: 'update2' },
      ]);
    });
  });

  describe('Current and incremental tracks', () => {
    it('should merge updates', () => {
      const current1: protos.LiveTrack = {
        id: 1,
        name: 'track1',
        timeSec: [100, 200, 300],
        lat: [11, 21, 31],
        lon: [12, 22, 32],
        alt: [13, 23, 33],
        gndAlt: [0, 0, 0],
        flags: [1, 1, 1],
        extra: {},
      };

      const update1: protos.LiveTrack = {
        timeSec: [250, 350, 450],
        lat: [110, 210, 310],
        lon: [120, 220, 320],
        alt: [130, 230, 330],
        gndAlt: [0, 0, 0],
        flags: [2, 2, 2],
        extra: { 0: { message: 'test' } },
      };

      const current2: protos.LiveTrack = {
        id: 2,
        name: 'track2',
        timeSec: [10, 20, 30],
        lat: [11, 21, 32],
        lon: [12, 22, 32],
        alt: [13, 23, 33],
        gndAlt: [0, 0, 0],
        flags: [1, 1, 1],
        extra: {},
      };

      const update3: protos.LiveTrack = {
        timeSec: [110, 120, 130],
        lat: [111, 121, 132],
        lon: [112, 122, 132],
        alt: [113, 123, 133],
        gndAlt: [0, 0, 0],
        flags: [2, 2, 2],
        extra: {},
      };

      const updates = protos.LiveDifferentialTrackGroup.create({
        tracks: [differentialEncodeLiveTrack(update1, 1, 'track1'), differentialEncodeLiveTrack(update3, 3, 'track3')],
      });

      expect(updateLiveTracks({ 1: current1, 2: current2 }, updates, true)).toEqual([
        {
          id: 1,
          name: 'track1',
          timeSec: [100, 200, 250, 300, 350, 450],
          lat: [11, 21, 110, 31, 210, 310],
          lon: [12, 22, 120, 32, 220, 320],
          alt: [13, 23, 130, 33, 230, 330],
          gndAlt: [0, 0, 0, 0, 0, 0],
          flags: [1, 1, 2, 1, 2, 2],
          extra: { 2: { message: 'test' } },
        },
        current2,
        { ...update3, id: 3, name: 'track3' },
      ]);
    });
  });

  describe('getFetchParameters', () => {
    it('should return incremental M5 when lastFetchAgeSec <= M5', () => {
      expect(getFetchParameters(100, LiveTrackDurationSec.H12)).toEqual({
        isIncremental: true,
        fetchSec: LiveTrackDurationSec.M5,
      });
      expect(getFetchParameters(LiveTrackDurationSec.M5, LiveTrackDurationSec.H12)).toEqual({
        isIncremental: true,
        fetchSec: LiveTrackDurationSec.M5,
      });
    });

    it('should return incremental M20 when lastFetchAgeSec <= M20 and > M5', () => {
      expect(getFetchParameters(600, LiveTrackDurationSec.H12)).toEqual({
        isIncremental: true,
        fetchSec: LiveTrackDurationSec.M20,
      });
      expect(getFetchParameters(LiveTrackDurationSec.M20, LiveTrackDurationSec.H12)).toEqual({
        isIncremental: true,
        fetchSec: LiveTrackDurationSec.M20,
      });
    });

    it('should return full H12 when historySec <= H12 and last fetch is old', () => {
      expect(getFetchParameters(3600, LiveTrackDurationSec.H12)).toEqual({
        isIncremental: false,
        fetchSec: LiveTrackDurationSec.H12,
      });
      expect(getFetchParameters(3600, 40 * 60)).toEqual({
        isIncremental: false,
        fetchSec: LiveTrackDurationSec.H12,
      });
    });

    it('should return full H24 when historySec <= H24 and > H12 and last fetch is old', () => {
      expect(getFetchParameters(3600, LiveTrackDurationSec.H24)).toEqual({
        isIncremental: false,
        fetchSec: LiveTrackDurationSec.H24,
      });
    });

    it('should return full H48 when historySec > H24 and last fetch is old', () => {
      expect(getFetchParameters(3600, LiveTrackDurationSec.H48)).toEqual({
        isIncremental: false,
        fetchSec: LiveTrackDurationSec.H48,
      });
    });
  });

  describe('Active track segment extraction', () => {
    it('returns index 0 when there are no gaps', () => {
      expect(getLastSegmentStartIndex([])).toBe(0);
      expect(getLastSegmentStartIndex([100])).toBe(0);
      expect(getLastSegmentStartIndex([100, 200, 300, 400])).toBe(0);
    });

    it('identifies the start index of the last segment when gaps exist', () => {
      // 100, 200 (gap 5000s > 3600s), 5200, 5300
      expect(getLastSegmentStartIndex([100, 200, 5200, 5300], 60)).toBe(2);
      // multiple gaps: 100 -> gap -> 5000 -> gap -> 10000, 10100
      expect(getLastSegmentStartIndex([100, 5000, 10000, 10100], 60)).toBe(2);
    });

    it('returns the same track when there are no gaps', () => {
      const track: protos.LiveTrack = {
        id: 1,
        timeSec: [100, 200, 300],
        alt: [1000, 1100, 1200],
        gndAlt: [800, 900, 1000],
        lat: [45.1, 45.2, 45.3],
        lon: [6.1, 6.2, 6.3],
        flags: [0, 0, 0],
        extra: {},
      };
      expect(getActiveTrackSegment(track)).toBe(track);
    });

    it('slices only the last segment when a gap exists', () => {
      const track: protos.LiveTrack = {
        id: 1,
        timeSec: [100, 200, 5000, 5100],
        alt: [1000, 1100, 1200, 1300],
        gndAlt: [800, 900, 1000, 1100],
        lat: [45.1, 45.2, 45.3, 45.4],
        lon: [6.1, 6.2, 6.3, 6.4],
        flags: [1, 2, 3, 4],
        extra: {
          0: { message: 'dropped fix message' },
          1: { speed: 20 },
          2: { speed: 30, message: 'reindexed fix 0' },
          3: { speed: 45 },
        },
      };
      const active = getActiveTrackSegment(track, 60);
      expect(active.timeSec).toEqual([5000, 5100]);
      expect(active.alt).toEqual([1200, 1300]);
      expect(active.gndAlt).toEqual([1000, 1100]);
      expect(active.lat).toEqual([45.3, 45.4]);
      expect(active.lon).toEqual([6.3, 6.4]);
      expect(active.flags).toEqual([3, 4]);
      expect(active.extra).toEqual({
        0: { speed: 30, message: 'reindexed fix 0' },
        1: { speed: 45 },
      });
    });
  });
});
