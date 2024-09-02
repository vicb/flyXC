import { parse } from './meshbir';

describe('parse', () => {
  describe('position', () => {
    it('should translate message to points', () => {
      expect(
        parse([
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
        ]),
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

  describe('test', () => {
    it('should silently ignore messages', () => {
      expect(
        parse([
          {
            type: 'message',
            user_id: '12345678-1234-1234-1234-123456789012',
            time: 123456,
            message: 'hello Meshtastic',
          },
        ]),
      ).toEqual(new Map());
    });
  });
});
