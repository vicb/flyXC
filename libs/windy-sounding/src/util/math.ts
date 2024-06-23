/**
 * Linearly interpolates between two values or arrays of values.
 *
 * When ys are arrays they must have the same length.
 *
 * @param x1 - The x-coordinate of the first point.
 * @param y1 - The y-coordinate or array of y-coordinates of the first point.
 * @param x2 - The x-coordinate of the second point.
 * @param y2 - The y-coordinate or array of y-coordinates of the second point.
 * @param x - The x-coordinate at which to interpolate.
 * @returns The interpolated value or array of values.
 *
 * @example
 * ```typescript
 * linearInterpolate(0, 10, 10, 20, 5); // 15
 * linearInterpolate(0, [10, 20], 10, [30, 40], 5); // [20, 30]
 * ```
 */
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

  const isArrayY1 = Array.isArray(y1);
  const isArrayY2 = Array.isArray(y2);

  if (isArrayY1 && isArrayY2) {
    const len = Math.min(y1.length, y2.length);
    const ys: number[] = [];
    for (let i = 0; i < len; i++) {
      ys.push(lerp(y1[i], y2[i], w));
    }
    return ys;
  }

  if (!isArrayY1 && !isArrayY2) {
    return lerp(y1, y2, w);
  }

  throw new Error('Invalid arguments');
}

/**
 * Samples values from a set of data points at specified target x-coordinates using linear interpolation.
 *
 * @param xs - The x-coordinates of the data points. Must be sorted in ascending or descending order.
 * @param ys - The y-coordinates or arrays of y-coordinates of the data points. Must have the same length as `xs`.
 * @param targetXs - The x-coordinate or array of x-coordinates at which to sample.
 * @returns The sampled value or array of values.
 *
 * @example
 * ```typescript
 * const xs = [0, 10, 20];
 * const ys = [10, 20, 30];
 * sampleAt(xs, ys, 5); // 15
 * sampleAt(xs, ys, [5, 15]); // [15, 25]
 * ```
 */
export function sampleAt(xs: number[], ys: number[], targetXs: number): number;
export function sampleAt(xs: number[], ys: number[][], targetXs: number): number[];
export function sampleAt(xs: number[], ys: number[], targetXs: number[]): number[];
export function sampleAt(xs: number[], ys: number[][], targetXs: number[]): number[][];
export function sampleAt(
  xs: number[],
  ys: number[] | number[][],
  targetXs: number | number[],
): number | number[] | number[][] {
  const descOrder = xs[0] > xs[1];
  const xsIsArray = Array.isArray(targetXs);
  const xArray = xsIsArray ? targetXs : [targetXs];
  const values: number[] | number[][] = xArray.map((tx: any) => {
    let index = xs.findIndex((x: any) => (descOrder ? x <= tx : x >= tx));
    if (index == -1) {
      index = xs.length - 1;
    } else if (index == 0) {
      index = 1;
    }
    // y1 and y2 can be number | number[] but TS doesn't seem to understand they have the same type.
    return linearInterpolate(xs[index - 1], ys[index - 1] as number, xs[index], ys[index] as number, tx);
  });
  return xsIsArray ? values : values[0];
}

/**
 * Finds the first intersection point between two lines defined by sets of x and y coordinates.
 *
 * Both sets of x coordinates must be sorted in ascending order.
 * Both sets of x and y coordinates must have the same length.
 *
 * @param x1s - The x-coordinates of the first line.
 * @param y1s - The y-coordinates of the first line.
 * @param x2s - The x-coordinates of the second line.
 * @param y2s - The y-coordinates of the second line.
 * @returns The x and y coordinates of the first intersection point, or undefined if no intersection is found.
 *
 * @example
 * ```typescript
 * const x1s = [0, 10, 20];
 * const y1s = [10, 20, 30];
 * const x2s = [5, 15, 25];
 * const y2s = [15, 25, 35];
 * firstIntersection(x1s, y1s, x2s, y2s); // [10, 20]
 * ```
 */
export function firstIntersection(
  x1s: number[],
  y1s: number[],
  x2s: number[],
  y2s: number[],
): [x: number, y: number] | undefined {
  if (x1s.length == 0 || x2s.length == 0 || y1s.length == 0 || y2s.length == 0) {
    throw new Error('Invalid arguments');
  }
  // Find all the points in the intersection of the 2 x ranges
  const min = Math.max(x1s[0], x2s[0]);
  const max = Math.min(x1s.at(-1)!, x2s.at(-1)!);
  const xs = Array.from(new Set([...x1s, ...x2s]))
    .filter((x) => x >= min && x <= max)
    .sort((a, b) => (Number(a) > Number(b) ? 1 : -1));
  // Interpolate the lines for all the points of that intersection
  const iy1s = sampleAt(x1s, y1s, xs);
  const iy2s = sampleAt(x2s, y2s, xs);
  // Check if each segment intersect
  for (let index = 0; index < xs.length - 1; index++) {
    const y11 = iy1s[index];
    const y21 = iy2s[index];
    const x1 = xs[index];
    if (y11 == y21) {
      return [x1, y11];
    }
    const y12 = iy1s[index + 1];
    const y22 = iy2s[index + 1];
    if (Math.sign(y21 - y11) != Math.sign(y22 - y12)) {
      const x2 = xs[index + 1];
      const width = x2 - x1;
      const slope1 = (y12 - y11) / width;
      const slope2 = (y22 - y21) / width;
      const dx = (y21 - y11) / (slope1 - slope2);
      const dy = dx * slope1;
      return [x1 + dx, y11 + dy];
    }
  }
  return undefined;
}

/**
 * Zips two arrays into an array of tuples.
 *
 * @param a - The first array.
 * @param b - The second array.
 * @returns An array of tuples, where each tuple contains an element from `a` and an element from `b` at the same index.
 *
 * @example
 * ```typescript
 * zip([1, 2, 3], ['a', 'b', 'c']); // [[1, 'a'], [2, 'b'], [3, 'c']]
 * ```
 */
export function zip<T, U>(a: T[], b: U[]): [T, U][] {
  return a.map((v: T, i: number) => [v, b[i]]);
}

/**
 * Type definition for a scale function.
 *
 * A scale function takes a value and returns a scaled value.
 * It also has an `invert` method that takes a scaled value and returns the original value.
 */
export type Scale = {
  (value: number): number;
  invert: (scaledValue: number) => number;
};

/**
 * Creates a linear scale function.
 *
 * @param from - The range of the input values.
 * @param to - The range of the output values.
 * @returns A function that scales values linearly.
 *
 * @example
 * ```typescript
 * const scale = scaleLinear([0, 10], [0, 100]);
 * scale(5); // 50
 * scale.invert(50); // 5
 * ```
 */
export function scaleLinear(from: number[], to: number[]): Scale {
  const scale = (v: number) => sampleAt(from, to, v);
  scale.invert = (v: number) => sampleAt(to, from, v);
  return scale;
}

/**
 * Creates a logarithmic scale function.
 *
 * @param from - The range of the input values.
 * @param to - The range of the output values.
 * @returns A function that scales values logarithmically.
 */
export function scaleLog(from: number[], to: number[]): Scale {
  from = from.map(Math.log);
  const scale = (v: number) => sampleAt(from, to, Math.log(v));
  scale.invert = (v: number) => Math.exp(sampleAt(to, from, v));
  return scale;
}

/**
 * Creates a composed scale function by applying multiple scales in sequence.
 *
 * @param scales - The scales to compose.
 * @returns A function that applies the scales in sequence.
 */
export function composeScales(...scales: Scale[]): Scale {
  const scale = (value: number) => {
    let result = value;
    for (const scale of scales) {
      result = scale(result);
    }
    return result;
  };
  scale.invert = (value: number) => {
    let result = value;
    for (let i = scales.length - 1; i >= 0; i--) {
      result = scales[i].invert(result);
    }
    return result;
  };
  return scale;
}

/**
 * Creates a function that converts an array of points to an SVG path string.
 *
 * @param scaleX - A function that scales the x-coordinate of a point.
 * @param scaleY - A function that scales the y-coordinate of a point.
 * @param numDigits - number of digits in the coordinates.
 * @returns A function that takes an array of points and returns an SVG path string.
 */
export function svgPath(
  scaleX: (point: [x: number, y: number]) => number,
  scaleY: (point: [x: number, y: number]) => number,
  numDigits = 0,
): (d: [x: number, y: number][]) => string {
  return (d: [x: number, y: number][]): string => {
    let lastX = 0;
    let lastY = 0;
    const points = d.map(([x, y]) => {
      const scaledX = round(scaleX([x, y]), numDigits);
      const scaledY = round(scaleY([x, y]), numDigits);
      const coordinates = `${scaledX - lastX},${scaledY - lastY}`;
      lastX = scaledX;
      lastY = scaledY;
      return coordinates;
    });
    return points.length > 1 ? 'M' + points.join(process.env.NODE_ENV === 'development' ? ' l ' : 'l') : '';
  };
}

/**
 * Linearly interpolates between two values.
 *
 * @param v0 - The starting value.
 * @param v1 - The ending value.
 * @param weight - The interpolation weight, between 0 and 1.
 * @returns The interpolated value.
 *
 * @example
 * ```typescript
 * lerp(0, 10, 0.5); // 5
 * ```
 */
export function lerp(v0: number, v1: number, weight: number): number {
  return v0 + weight * (v1 - v0);
}

/**
 * Rounds a number to a specified number of decimal places.
 *
 * @param value - The number to round.
 * @param numDigits - The number of decimal places to round to.
 * @returns The rounded number.
 *
 * @example
 * ```typescript
 * round(1.2345, 2); // 1.23
 * ```
 */
export function round(value: number, numDigits: number): number {
  const multiplier = 10 ** numDigits;
  return Math.round(value * multiplier) / multiplier;
}
