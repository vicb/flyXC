import { findIndexes } from 'flyxc/common/src/math';

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
