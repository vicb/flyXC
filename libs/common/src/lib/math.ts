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

// Finds the two indexes left and right of the value.
//
// The output contains the following properties:
// - beforeAll: true when the value is less than any element in the list,
// - beforeIndex and afterIndex: indexes before and after the value. They are equal to the index of the value when
//   it is in the list.
// - afterAll: true when the value is greater than any element in the list.
export function findIndexes(
  ascendingList: number[],
  value: number,
): { beforeAll: boolean; afterAll: boolean; beforeIndex: number; afterIndex: number } {
  if (ascendingList.length == 0) {
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

  let afterIndex = ascendingList.length - 1;

  if (value > ascendingList[ascendingList.length - 1]) {
    return {
      beforeAll: false,
      beforeIndex: afterIndex,
      afterAll: true,
      afterIndex: afterIndex,
    };
  }

  if (afterIndex == 0) {
    return {
      beforeAll: false,
      beforeIndex: 0,
      afterAll: false,
      afterIndex: 0,
    };
  }

  let beforeIndex = 0;

  while (afterIndex - beforeIndex > 1) {
    const m = Math.round((beforeIndex + afterIndex) / 2);
    if (ascendingList[m] > value) {
      afterIndex = m;
    } else {
      beforeIndex = m;
    }
  }

  if (ascendingList[afterIndex - 1] == value) {
    afterIndex = afterIndex - 1;
  } else if (ascendingList[beforeIndex + 1] == value) {
    beforeIndex = beforeIndex + 1;
  }

  return {
    beforeAll: false,
    afterIndex,
    afterAll: false,
    beforeIndex,
  };
}

// Rounds a value with up to `numDigits` digits after the decimal point.
export function round(value: number, numDigits: number): number {
  const multiplier = 10 ** numDigits;
  return Math.round(value * multiplier) / multiplier;
}

// Differential encoding of an array.
// The value is multiplied by the given `multiplier`.
// The first value is then stored unchanged followed by the deltas only.
//
// `signed == false` makes sure the value can not be less than 0.
// It is used to sanitize some values (i.e. time should always be increasing).
export function diffEncodeArray32bit(data: number[], multiplier = 1, signed = true): number[] {
  let previousValue: number;
  return data.map((v: number, i: number) => {
    v = Math.round(v * multiplier);
    const res = Math.round(i == 0 ? v : v - previousValue);
    previousValue = v;
    if (signed) {
      const cappedInt32Res = Math.max(-2147483648, Math.min(2147483647, res));
      return cappedInt32Res;
    }
    const cappedUIn32Res = Math.max(0, Math.min(4294967295, res));
    return cappedUIn32Res;
  });
}

// Decodes a differential encoded array.
//
// See `diffEncodeArray`.
export function diffDecodeArray(data: number[], multiplier = 1): number[] {
  let value: number;
  return data.map((delta: number, i: number) => {
    value = i == 0 ? delta : value + delta;
    return value / multiplier;
  });
}
