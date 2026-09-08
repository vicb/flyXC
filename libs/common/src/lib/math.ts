// Linear interpolation
// The values (y1 and y2) can be arrays
export function linearInterpolate(x1: number, y1: number, x2: number, y2: number, x: number): number;
export function linearInterpolate(x1: number, y1: number[], x2: number, y2: number[], x: number): number[];
export function linearInterpolate(
  x1: number,
  y1: number | number[],
  x2: number,
  y2: number | number[],
  x: number,
): number | number[] {
  if (x1 == x2) {
    return y1;
  }
  const w = (x - x1) / (x2 - x1);

  if (Array.isArray(y1) && Array.isArray(y2)) {
    return y1.map((y1, i) => y1 * (1 - w) + y2[i] * w);
  }

  return (y1 as number) * (1 - w) + (y2 as number) * w;
}

// Sampling at a single targetXs with linear interpolation
// xs and ys must have the same length.
// xs must be sorted in ascending order
export function sampleAt(xs: number[], ys: number[], targetX: number): number {
  const { beforeIndex, afterIndex } = findIndexes(xs, targetX);
  return linearInterpolate(xs[beforeIndex], ys[beforeIndex], xs[afterIndex], ys[afterIndex], targetX);
}

export const enum Comparison {
  GREATER,
  GREATER_EQUAL,
}

/**
 * Binary search to find the partition point in an ascending array.
 *
 * @param ascendingList - List of numbers in ascending order.
 * @param value - Search value.
 * @param comparison - Search comparison mode (Comparison.GREATER or Comparison.GREATER_EQUAL).
 * @returns Index in [0, ascendingList.length].
 */
export function findFirstIndex(
  ascendingList: number[],
  value: number,
  comparison: Comparison = Comparison.GREATER_EQUAL,
): number {
  const len = ascendingList.length;
  if (len === 0) {
    return 0;
  }
  const isGreater = comparison === Comparison.GREATER;
  const first = ascendingList[0];
  if (isGreater ? first > value : first >= value) {
    return 0;
  }
  const last = ascendingList[len - 1];
  if (isGreater ? last <= value : last < value) {
    return len;
  }

  let low = 0;
  let high = len - 1;
  let result = len;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (isGreater ? ascendingList[mid] > value : ascendingList[mid] >= value) {
      result = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return result;
}

/**
 * Finds the two indexes left and right of the value in an ascending list.
 *
 * The output contains the following properties:
 * - beforeAll: true when the value is less than any element in the list,
 * - beforeIndex and afterIndex: indexes before and after the value. They are equal to the index of the value when
 *   it is in the list.
 * - afterAll: true when the value is greater than any element in the list.
 *
 * @param ascendingList - List of numbers in ascending order (must not be empty).
 * @param value - Search value.
 */
export function findIndexes(
  ascendingList: number[],
  value: number,
): { beforeAll: boolean; afterAll: boolean; beforeIndex: number; afterIndex: number } {
  const len = ascendingList.length;
  if (len === 0) {
    throw new Error('The list must contain at least 1 element');
  }

  if (value < ascendingList[0]) {
    return {
      beforeAll: true,
      beforeIndex: 0,
      afterAll: false,
      afterIndex: 0,
    };
  }

  if (value > ascendingList[len - 1]) {
    return {
      beforeAll: false,
      beforeIndex: len - 1,
      afterAll: true,
      afterIndex: len - 1,
    };
  }

  const idx = findFirstIndex(ascendingList, value, Comparison.GREATER) - 1;
  const isExact = ascendingList[idx] === value;

  return {
    beforeAll: false,
    beforeIndex: idx,
    afterAll: false,
    afterIndex: isExact ? idx : idx + 1,
  };
}

// Rounds a value with up to `numDigits` digits after the decimal point.
export function round(value: number, numDigits: number): number {
  const multiplier = 10 ** numDigits;
  return Math.round(value * multiplier) / multiplier;
}

// 32-bit integer boundaries for clamping encoded differential values.
// Standard JavaScript `Number` only provides MAX_SAFE_INTEGER / MIN_SAFE_INTEGER (53-bit),
// so explicit 32-bit signed and unsigned limits are defined here.
const INT32_MIN = -2147483648; // -2^31
const INT32_MAX = 2147483647; // 2^31 - 1
const UINT32_MIN = 0;
const UINT32_MAX = 4294967295; // 2^32 - 1

// Differential encoding of an array.
// The value is multiplied by the given `multiplier`.
// The first value is then stored unchanged followed by the deltas only.
//
// `signed == false` makes sure the value can not be less than 0.
// It is used to sanitize some values (i.e. time should always be increasing).
export function diffEncodeArray32bit(data: number[], multiplier = 1, signed = true): number[] {
  const len = data.length;
  if (len === 0) {
    return [];
  }

  const out = new Array<number>(len);
  let previousValue = multiplier === 1 ? Math.round(data[0]) : Math.round(data[0] * multiplier);

  if (signed) {
    out[0] = previousValue < INT32_MIN ? INT32_MIN : previousValue > INT32_MAX ? INT32_MAX : previousValue;
    if (multiplier === 1) {
      for (let i = 1; i < len; i++) {
        const v = Math.round(data[i]);
        const res = v - previousValue;
        previousValue = v;
        out[i] = res < INT32_MIN ? INT32_MIN : res > INT32_MAX ? INT32_MAX : res;
      }
    } else {
      for (let i = 1; i < len; i++) {
        const v = Math.round(data[i] * multiplier);
        const res = v - previousValue;
        previousValue = v;
        out[i] = res < INT32_MIN ? INT32_MIN : res > INT32_MAX ? INT32_MAX : res;
      }
    }
  } else {
    out[0] = previousValue < UINT32_MIN ? UINT32_MIN : previousValue > UINT32_MAX ? UINT32_MAX : previousValue;
    if (multiplier === 1) {
      for (let i = 1; i < len; i++) {
        const v = Math.round(data[i]);
        const res = v - previousValue;
        previousValue = v;
        out[i] = res < UINT32_MIN ? UINT32_MIN : res > UINT32_MAX ? UINT32_MAX : res;
      }
    } else {
      for (let i = 1; i < len; i++) {
        const v = Math.round(data[i] * multiplier);
        const res = v - previousValue;
        previousValue = v;
        out[i] = res < UINT32_MIN ? UINT32_MIN : res > UINT32_MAX ? UINT32_MAX : res;
      }
    }
  }

  return out;
}

// Decodes a differential encoded array.
//
// See `diffEncodeArray`.
export function diffDecodeArray(data: number[], multiplier = 1): number[] {
  const len = data.length;
  if (len === 0) {
    return [];
  }
  const out = new Array<number>(len);
  let value = data[0];
  out[0] = value / multiplier;
  if (multiplier === 1) {
    for (let i = 1; i < len; i++) {
      value += data[i];
      out[i] = value;
    }
  } else {
    for (let i = 1; i < len; i++) {
      value += data[i];
      out[i] = value / multiplier;
    }
  }
  return out;
}
