// Linear interpolation
// The values (y1 and y2) can be arrays
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

// Sampling at at targetXs with linear interpolation
// xs and ys must have the same length.
// xs must be sorted in ascending order.
export function sampleAt(xs: number[], ys: number[], targetXs: number[]): number[] {
  return targetXs.map((tx) => {
    const [left, right] = findIndexes(xs, tx);
    return linearInterpolate(xs[left], ys[left], xs[right], ys[right], tx) as number;
  });
}

// Find the two indexes left and right of the value.
export function findIndexes(ascendingList: number[], value: number): [number, number] {
  let left = 0;
  let right = ascendingList.length - 1;
  if (value <= ascendingList[0]) {
    return [left, left];
  }
  if (value >= ascendingList[ascendingList.length - 1]) {
    return [right, right];
  }

  while (right - left > 1) {
    const m = Math.round((left + right) / 2);
    if (ascendingList[m] > value) {
      right = m;
    } else {
      left = m;
    }
  }

  return [left, right];
}
