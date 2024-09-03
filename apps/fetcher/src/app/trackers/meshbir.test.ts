import { protos } from '@flyxc/common';

import { parse } from './meshbir';

describe('parse', () => {
  describe('position', () => {
    it('should translate message to points', () => {
      expect(
        parse(
          [
            {
              altitude: 1778.12,
              ground_speed: 30,
              latitude: 32.1927,
              longitude: 76.4506,
              time: 123460,
              type: 'position',
              user_id: '12345678-1234-1234-1234-123456789012',
            },
            {
              altitude: 1778.12,
              ground_speed: 30,
              latitude: 32.1927,
              longitude: 76.4506,
              time: 123450,
              type: 'position',
              user_id: '12345678-1234-1234-1234-123456789012',
            },
          ],
          new Map(),
          {},
          10,
        ),
      ).toMatchInlineSnapshot(`
        Map {
          "12345678-1234-1234-1234-123456789012" => [
            {
              "alt": 1778.12,
              "lat": 32.1927,
              "lon": 76.4506,
              "name": "meshbir",
              "speed": 30,
              "timeMs": 123460,
            },
            {
              "alt": 1778.12,
              "lat": 32.1927,
              "lon": 76.4506,
              "name": "meshbir",
              "speed": 30,
              "timeMs": 123450,
            },
          ],
        }
      `);
    });
  });

  describe('position and messages', () => {
    it('associates message with the position at the same time', () => {
      expect(
        parse(
          [
            {
              altitude: 1778.12,
              ground_speed: 30,
              latitude: 32.1927,
              longitude: 76.4506,
              time: 123450,
              type: 'position',
              user_id: '12345678-1234-1234-1234-123456789012',
            },
            {
              altitude: 1778.12,
              ground_speed: 30,
              latitude: 32.1927,
              longitude: 76.4506,
              time: 123460,
              type: 'position',
              user_id: '12345678-1234-1234-1234-123456789012',
            },
            {
              altitude: 1778.12,
              ground_speed: 30,
              latitude: 32.1927,
              longitude: 76.4506,
              time: 123470,
              type: 'position',
              user_id: '12345678-1234-1234-1234-123456789012',
            },
            {
              time: 123460,
              type: 'message',
              user_id: '12345678-1234-1234-1234-123456789012',
              message: 'message',
            },
          ],

          new Map(),
          {},
          10,
        ),
      ).toMatchInlineSnapshot(`
        Map {
          "12345678-1234-1234-1234-123456789012" => [
            {
              "alt": 1778.12,
              "lat": 32.1927,
              "lon": 76.4506,
              "name": "meshbir",
              "speed": 30,
              "timeMs": 123450,
            },
            {
              "alt": 1778.12,
              "lat": 32.1927,
              "lon": 76.4506,
              "message": "message",
              "name": "meshbir",
              "speed": 30,
              "timeMs": 123460,
            },
            {
              "alt": 1778.12,
              "lat": 32.1927,
              "lon": 76.4506,
              "name": "meshbir",
              "speed": 30,
              "timeMs": 123470,
            },
          ],
        }
      `);
    });

    it('associates message with the last position', () => {
      expect(
        parse(
          [
            {
              altitude: 1778.12,
              ground_speed: 30,
              latitude: 32.1927,
              longitude: 76.4506,
              time: 123450,
              type: 'position',
              user_id: '12345678-1234-1234-1234-123456789012',
            },
            {
              altitude: 1778.12,
              ground_speed: 30,
              latitude: 32.1927,
              longitude: 76.4506,
              time: 123460,
              type: 'position',
              user_id: '12345678-1234-1234-1234-123456789012',
            },
            {
              altitude: 1778.12,
              ground_speed: 30,
              latitude: 32.1927,
              longitude: 76.4506,
              time: 123470,
              type: 'position',
              user_id: '12345678-1234-1234-1234-123456789012',
            },
            {
              time: 123480,
              type: 'message',
              user_id: '12345678-1234-1234-1234-123456789012',
              message: 'message',
            },
          ],

          new Map(),
          {},
          10,
        ),
      ).toMatchInlineSnapshot(`
        Map {
          "12345678-1234-1234-1234-123456789012" => [
            {
              "alt": 1778.12,
              "lat": 32.1927,
              "lon": 76.4506,
              "name": "meshbir",
              "speed": 30,
              "timeMs": 123450,
            },
            {
              "alt": 1778.12,
              "lat": 32.1927,
              "lon": 76.4506,
              "name": "meshbir",
              "speed": 30,
              "timeMs": 123460,
            },
            {
              "alt": 1778.12,
              "lat": 32.1927,
              "lon": 76.4506,
              "message": "message",
              "name": "meshbir",
              "speed": 30,
              "timeMs": 123470,
            },
          ],
        }
      `);
    });

    it('associates message with the first position', () => {
      expect(
        parse(
          [
            {
              altitude: 1778.12,
              ground_speed: 30,
              latitude: 32.1927,
              longitude: 76.4506,
              time: 123450,
              type: 'position',
              user_id: '12345678-1234-1234-1234-123456789012',
            },
            {
              altitude: 1778.12,
              ground_speed: 30,
              latitude: 32.1927,
              longitude: 76.4506,
              time: 123460,
              type: 'position',
              user_id: '12345678-1234-1234-1234-123456789012',
            },
            {
              altitude: 1778.12,
              ground_speed: 30,
              latitude: 32.1927,
              longitude: 76.4506,
              time: 123470,
              type: 'position',
              user_id: '12345678-1234-1234-1234-123456789012',
            },
            {
              time: 123440,
              type: 'message',
              user_id: '12345678-1234-1234-1234-123456789012',
              message: 'message',
            },
          ],

          new Map(),
          {},
          10,
        ),
      ).toMatchInlineSnapshot(`
        Map {
          "12345678-1234-1234-1234-123456789012" => [
            {
              "alt": 1778.12,
              "lat": 32.1927,
              "lon": 76.4506,
              "message": "message",
              "name": "meshbir",
              "speed": 30,
              "timeMs": 123450,
            },
            {
              "alt": 1778.12,
              "lat": 32.1927,
              "lon": 76.4506,
              "name": "meshbir",
              "speed": 30,
              "timeMs": 123460,
            },
            {
              "alt": 1778.12,
              "lat": 32.1927,
              "lon": 76.4506,
              "name": "meshbir",
              "speed": 30,
              "timeMs": 123470,
            },
          ],
        }
      `);
    });

    it('associates message with the last known position when recent', () => {
      jest.useFakeTimers({ now: 123500 });
      expect(
        parse(
          [
            {
              time: 123440,
              type: 'message',
              user_id: '12345678-1234-1234-1234-123456789012',
              message: 'message',
            },
          ],

          new Map([['12345678-1234-1234-1234-123456789012', 10]]),
          {
            '10': protos.Pilot.create({
              track: protos.LiveTrack.create({
                alt: [1],
                lat: [2],
                lon: [3],
                timeSec: [123],
              }),
            }),
          },
          1,
        ),
      ).toMatchInlineSnapshot(`
        Map {
          "12345678-1234-1234-1234-123456789012" => [
            {
              "alt": 1,
              "lat": 2,
              "lon": 3,
              "message": "message",
              "name": "meshbir",
              "timeMs": 123500,
            },
          ],
        }
      `);
    });

    it("doesn't associates message with the last known position when too old", () => {
      jest.useFakeTimers({ now: 123500 });
      expect(
        parse(
          [
            {
              time: 123440,
              type: 'message',
              user_id: '12345678-1234-1234-1234-123456789012',
              message: 'message',
            },
          ],

          new Map([['12345678-1234-1234-1234-123456789012', 10]]),
          {
            '10': protos.Pilot.create({
              track: protos.LiveTrack.create({
                alt: [1],
                lat: [2],
                lon: [3],
                timeSec: [123 - 70],
              }),
            }),
          },
          1,
        ),
      ).toMatchInlineSnapshot(`Map {}`);
    });
  });
});
