import { parseMessage } from './meshbir';

describe('parseMessage', () => {
  describe('valid messages', () => {
    it('should parse a position', () => {
      expect(
        parseMessage({
          type: 'position',
          user_id: '12345678-1234-1234-1234-123456789012',
          time: 123456,
          latitude: 32.1927,
          longitude: 76.4506,
          altitude: 1778.12,
          ground_speed: 30,
        }),
      ).toMatchInlineSnapshot(`
        {
          "altitude": 1778.12,
          "ground_speed": 30,
          "latitude": 32.1927,
          "longitude": 76.4506,
          "time": 123456,
          "type": "position",
          "user_id": "12345678-1234-1234-1234-123456789012",
        }
      `);
    });

    it('should parse a text message', () => {
      expect(
        parseMessage({
          type: 'message',
          user_id: '12345678-1234-1234-1234-123456789012',
          time: 123456,
          message: 'hello Meshtastic',
        }),
      ).toMatchInlineSnapshot(`
        {
          "message": "hello Meshtastic",
          "time": 123456,
          "type": "message",
          "user_id": "12345678-1234-1234-1234-123456789012",
        }
      `);
    });

    it('should allow extra fields', () => {
      expect(
        parseMessage({
          type: 'message',
          user_id: '12345678-1234-1234-1234-123456789012',
          time: 123456,
          message: 'hello Meshtastic',
          extra: 123,
        }),
      ).toMatchInlineSnapshot(`
        {
          "message": "hello Meshtastic",
          "time": 123456,
          "type": "message",
          "user_id": "12345678-1234-1234-1234-123456789012",
        }
      `);
    });
  });

  describe('invalid messages', () => {
    it('should throw on invalid message', () => {
      expect(() => parseMessage({ type: 'unknown' })).toThrowErrorMatchingInlineSnapshot(
        `[Error: Invalid message format]`,
      );
    });

    it('should throw on invalid values', () => {
      expect(() =>
        parseMessage({
          type: 'message',
          user_id: '12345678-1234-1234-1234-123456789012',
          time: '123456', // should be a number
          message: 'hello Meshtastic',
        }),
      ).toThrowErrorMatchingInlineSnapshot(`[Error: Invalid message format]`);
    });

    it('should throw on missing values', () => {
      expect(() =>
        parseMessage({
          type: 'message',
          user_id: '12345678-1234-1234-1234-123456789012',
          //time: 123456,
          message: 'hello Meshtastic',
        }),
      ).toThrowErrorMatchingInlineSnapshot(`[Error: Invalid message format]`);
    });
  });
});
