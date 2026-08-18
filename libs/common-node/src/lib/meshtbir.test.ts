import { positionSchema, textSchema } from './meshtbir';

describe('meshtbir schemas', () => {
  describe('positionSchema', () => {
    it('should validate a valid position', () => {
      const valid = {
        type: 'position',
        user_id: '12345678-1234-1234-1234-123456789012',
        latitude: 45.123,
        longitude: 6.456,
        altitude: 1200,
        time: 1700000000,
        ground_speed: 35.5,
      };
      expect(positionSchema.parse(valid)).toEqual(valid);
    });

    it('should reject invalid user_id format', () => {
      expect(() =>
        positionSchema.parse({
          type: 'position',
          user_id: 'not-a-guid',
          latitude: 45.123,
          longitude: 6.456,
          altitude: 1200,
          time: 1700000000,
          ground_speed: 35.5,
        }),
      ).toThrow();
    });

    it('should reject negative time', () => {
      expect(() =>
        positionSchema.parse({
          type: 'position',
          user_id: '12345678-1234-1234-1234-123456789012',
          latitude: 45.123,
          longitude: 6.456,
          altitude: 1200,
          time: -10,
          ground_speed: 35.5,
        }),
      ).toThrow();
    });

    it('should reject wrong literal type', () => {
      expect(() =>
        positionSchema.parse({
          type: 'message',
          user_id: '12345678-1234-1234-1234-123456789012',
          latitude: 45.123,
          longitude: 6.456,
          altitude: 1200,
          time: 1700000000,
          ground_speed: 35.5,
        }),
      ).toThrow();
    });
  });

  describe('textSchema', () => {
    it('should validate a valid message', () => {
      const valid = {
        type: 'message',
        user_id: 'abcdef01-2345-6789-abcd-ef0123456789',
        time: 1700000000,
        message: 'Hello from Meshtastic',
      };
      expect(textSchema.parse(valid)).toEqual(valid);
    });

    it('should reject non-string message', () => {
      expect(() =>
        textSchema.parse({
          type: 'message',
          user_id: 'abcdef01-2345-6789-abcd-ef0123456789',
          time: 1700000000,
          message: 12345,
        }),
      ).toThrow();
    });
  });
});
