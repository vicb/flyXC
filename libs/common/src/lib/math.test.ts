import { diffDecodeArray, diffEncodeArray32bit, findIndexes } from './math';

describe('findIndexes', () => {
  test('throws when the lis is empty', () => {
    expect(() => findIndexes([], 0)).toThrow();
  });

  test('list with a single element', () => {
    expect(findIndexes([10], 5)).toEqual({ beforeAll: true, beforeIndex: 0, afterAll: false, afterIndex: 0 });
    expect(findIndexes([10], 15)).toEqual({ beforeAll: false, beforeIndex: 0, afterAll: true, afterIndex: 0 });
    expect(findIndexes([10], 10)).toEqual({ beforeAll: false, beforeIndex: 0, afterAll: false, afterIndex: 0 });
  });

  test('value not found', () => {
    expect(findIndexes([5, 10, 15], 9)).toEqual({
      beforeAll: false,
      beforeIndex: 0,
      afterAll: false,
      afterIndex: 1,
    });
  });

  test('value found', () => {
    expect(findIndexes([5, 10, 15], 5)).toEqual({ beforeAll: false, beforeIndex: 0, afterAll: false, afterIndex: 0 });
    expect(findIndexes([5, 10, 15], 10)).toEqual({ beforeAll: false, beforeIndex: 1, afterAll: false, afterIndex: 1 });
    expect(findIndexes([5, 10, 15], 15)).toEqual({ beforeAll: false, beforeIndex: 2, afterAll: false, afterIndex: 2 });
  });

  test('before all', () => {
    expect(findIndexes([5, 10, 15], 3)).toEqual({ beforeAll: true, beforeIndex: 0, afterAll: false, afterIndex: 0 });
  });

  test('after all', () => {
    expect(findIndexes([5, 10, 15], 20)).toEqual({ beforeAll: false, beforeIndex: 2, afterAll: true, afterIndex: 2 });
  });

  test('repeated values', () => {
    expect(findIndexes([5, 5, 10, 10, 15, 15], 9)).toEqual({
      beforeAll: false,
      beforeIndex: 1,
      afterAll: false,
      afterIndex: 2,
    });
    expect(findIndexes([5, 5, 10, 10, 15, 15], 10)).toEqual({
      beforeAll: false,
      beforeIndex: 3,
      afterAll: false,
      afterIndex: 3,
    });
  });
});

describe('diffEncodeArray32bit', () => {
  it('should handle empty arrays', () => {
    expect(diffEncodeArray32bit([])).toEqual([]);
    expect(diffEncodeArray32bit([], 1e5, true)).toEqual([]);
    expect(diffEncodeArray32bit([], 1, false)).toEqual([]);
  });

  it('should handle single element arrays', () => {
    expect(diffEncodeArray32bit([100])).toEqual([100]);
    expect(diffEncodeArray32bit([45.123456], 1e5)).toEqual([4512346]);
    expect(diffEncodeArray32bit([100], 1, false)).toEqual([100]);
  });

  it('should encode signed deltas with multiplier = 1', () => {
    // Altitude-like values
    const alts = [1000, 1050, 1040, 1100];
    const encoded = diffEncodeArray32bit(alts, 1, true);
    // [1000, 1050-1000=50, 1040-1050=-10, 1100-1040=60]
    expect(encoded).toEqual([1000, 50, -10, 60]);
  });

  it('should encode signed deltas with multiplier != 1 (coordinates)', () => {
    const lats = [45.12345, 45.12355, 45.1235];
    const encoded = diffEncodeArray32bit(lats, 1e5, true);
    // 45.12345 * 1e5 = 4512345
    // 45.12355 * 1e5 = 4512355 -> delta = +10
    // 45.12350 * 1e5 = 4512350 -> delta = -5
    expect(encoded).toEqual([4512345, 10, -5]);
  });

  it('should clamp signed values to 32-bit signed integer limits', () => {
    const extreme = [2147483650, 0, -2147483650];
    const encoded = diffEncodeArray32bit(extreme, 1, true);
    expect(encoded[0]).toBe(2147483647);
    expect(encoded[1]).toBe(-2147483648);
  });

  it('should clamp unsigned values to 0 and 32-bit unsigned limit (timeSec)', () => {
    // Decreasing timestamps should clamp deltas to 0
    const times = [100, 90, 120];
    const encoded = diffEncodeArray32bit(times, 1, false);
    // [100, clamp(90-100 = -10 to 0), 120-90 = 30]
    expect(encoded).toEqual([100, 0, 30]);
  });

  it('should round floating-point values when multiplier is 1', () => {
    const floats = [10.2, 20.7, 30.1];
    // 10, 21 - 10 = 11, 30 - 21 = 9
    expect(diffEncodeArray32bit(floats, 1, true)).toEqual([10, 11, 9]);
  });
});

describe('diffDecodeArray', () => {
  it('should handle empty arrays', () => {
    expect(diffDecodeArray([])).toEqual([]);
    expect(diffDecodeArray([], 1e5)).toEqual([]);
  });

  it('should decode deltas with multiplier = 1', () => {
    const encoded = [1000, 50, -10, 60];
    expect(diffDecodeArray(encoded, 1)).toEqual([1000, 1050, 1040, 1100]);
  });

  it('should decode deltas with multiplier != 1', () => {
    const encoded = [4512345, 10, -5];
    const decoded = diffDecodeArray(encoded, 1e5);
    expect(decoded[0]).toBeCloseTo(45.12345, 5);
    expect(decoded[1]).toBeCloseTo(45.12355, 5);
    expect(decoded[2]).toBeCloseTo(45.1235, 5);
  });

  it('should roundtrip encode and decode correctly', () => {
    const original = [45.12345, 45.1236, 45.1237, 45.12365];
    const encoded = diffEncodeArray32bit(original, 1e5, true);
    const decoded = diffDecodeArray(encoded, 1e5);

    expect(decoded).toHaveLength(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(decoded[i]).toBeCloseTo(original[i], 5);
    }
  });
});
