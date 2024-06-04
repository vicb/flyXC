import { differentialEncodeLiveTrack, LiveTrackFlag, protos, trackerIdByName } from '@flyxc/common';

import { FixType, trackToFeatures, updateLiveTracks } from './live-track';

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

    it('should add points for the last few points', () => {
      const track: protos.LiveTrack = {
        idStr: 'str-123',
        timeSec: [1, 1000, 2000, 3000, 4000, 5000, 6000],
        lon: [11, 110, 120, 130, 140, 150, 160],
        lat: [21, 210, 220, 230, 240, 250, 260],
        alt: [31, 310, 320, 330, 340, 350, 360],
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

      const features = trackToFeatures(track, 1000);

      expect(features).toContainEqual({
        geometry: {
          coordinates: [150, 250, 350],
          type: 'Point',
        },
        properties: {
          alt: 350,
          fixType: FixType.dot,
          gndAlt: undefined,
          id: 'str-123-5',
          index: 5,
          isUfo: false,
          name: undefined,
          pilotId: 'str-123',
          timeSec: 5000,
        },
        type: 'Feature',
      });

      expect(features).toContainEqual({
        geometry: {
          coordinates: [140, 240, 340],
          type: 'Point',
        },
        properties: {
          alt: 340,
          fixType: FixType.dot,
          gndAlt: undefined,
          id: 'str-123-4',
          index: 4,
          isUfo: false,
          name: undefined,
          pilotId: 'str-123',
          timeSec: 4000,
        },
        type: 'Feature',
      });

      expect(features).toContainEqual({
        geometry: {
          coordinates: [130, 230, 330],
          type: 'Point',
        },
        properties: {
          alt: 330,
          fixType: FixType.dot,
          gndAlt: undefined,
          id: 'str-123-3',
          index: 3,
          isUfo: false,
          name: undefined,
          pilotId: 'str-123',
          timeSec: 3000,
        },
        type: 'Feature',
      });
    });

    it('should add points for messages', () => {
      const track: protos.LiveTrack = {
        id: 123,
        timeSec: [1, 10, 20, 30, 40, 50, 60],
        lon: [11, 110, 120, 130, 140, 150, 160],
        lat: [21, 210, 220, 230, 240, 250, 260],
        alt: [31, 310, 320, 330, 340, 350, 360],
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
        flags: [1, 1, 1],
        extra: {},
      };

      const update: protos.LiveTrack = {
        timeSec: [10, 20, 30],
        lat: [11, 21, 31],
        lon: [12, 22, 32],
        alt: [13, 23, 33],
        flags: [1, 1, 1],
        extra: {},
      };

      const updates = protos.LiveDifferentialTrackGroup.create({
        tracks: [differentialEncodeLiveTrack(update, 2, 'update')],
        incremental: false,
      });

      expect(updateLiveTracks({ 1: current }, updates)).toEqual([{ ...update, id: 2, name: 'update' }]);
    });
  });

  describe('Only incremental updates', () => {
    it('should merge updates', () => {
      const update1: protos.LiveTrack = {
        timeSec: [10, 20, 30],
        lat: [11, 21, 31],
        lon: [12, 22, 32],
        alt: [13, 23, 33],
        flags: [1, 1, 1],
        extra: {},
      };

      const update2: protos.LiveTrack = {
        timeSec: [110, 120, 130],
        lat: [111, 121, 132],
        lon: [112, 122, 132],
        alt: [113, 123, 133],
        flags: [2, 2, 2],
        extra: {},
      };

      const updates = protos.LiveDifferentialTrackGroup.create({
        tracks: [
          differentialEncodeLiveTrack(update1, 1, 'update1'),
          differentialEncodeLiveTrack(update2, 2, 'update2'),
        ],
        incremental: true,
      });

      expect(updateLiveTracks({}, updates)).toEqual([
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
        flags: [1, 1, 1],
        extra: {},
      };

      const update1: protos.LiveTrack = {
        timeSec: [250, 350, 450],
        lat: [110, 210, 310],
        lon: [120, 220, 320],
        alt: [130, 230, 330],
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
        flags: [1, 1, 1],
        extra: {},
      };

      const update3: protos.LiveTrack = {
        timeSec: [110, 120, 130],
        lat: [111, 121, 132],
        lon: [112, 122, 132],
        alt: [113, 123, 133],
        flags: [2, 2, 2],
        extra: {},
      };

      const updates = protos.LiveDifferentialTrackGroup.create({
        tracks: [differentialEncodeLiveTrack(update1, 1, 'track1'), differentialEncodeLiveTrack(update3, 3, 'track3')],
        incremental: true,
      });

      expect(updateLiveTracks({ 1: current1, 2: current2 }, updates)).toEqual([
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
  });
});
