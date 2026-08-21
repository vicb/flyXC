import {
  composeScales,
  firstIntersection,
  lerp,
  lerpAngleDegree,
  linearInterpolate,
  round,
  sampleAt,
  scaleLinear,
  scaleLog,
  svgPath,
  zip,
} from './math';

describe('lerp', () => {
  it('should return v0 when weight is 0', () => {
    expect(lerp(10, 20, 0)).toEqual(10);
  });

  it('should return v1 when weight is 1', () => {
    expect(lerp(10, 20, 1)).toEqual(20);
  });

  it('should return the weighted average when weight is between 0 and 1', () => {
    expect(lerp(10, 20, 0.5)).toEqual(15);
  });

  it('should return the correct value for any weight', () => {
    expect(lerp(10, 20, 0.25)).toEqual(12.5);
    expect(lerp(10, 20, 0.75)).toEqual(17.5);
  });
});

describe('lerpAngleDegree', () => {
  it('should return a when weight is 0', () => {
    expect(lerpAngleDegree(350, 10, 0)).toEqual(350);
    expect(lerpAngleDegree(0, 90, 0)).toEqual(0);
  });

  it('should return b when weight is 1', () => {
    expect(lerpAngleDegree(350, 10, 1)).toEqual(10);
    expect(lerpAngleDegree(0, 90, 1)).toEqual(90);
  });

  it('should interpolate standard angles without crossing 0 boundary', () => {
    expect(lerpAngleDegree(0, 90, 0.5)).toEqual(45);
    expect(lerpAngleDegree(100, 200, 0.5)).toEqual(150);
  });

  it('should take the shortest arc across the 360/0 boundary (clockwise)', () => {
    // 350 to 10 is +20 deg clockwise, midpoint is 0 / 360 -> 0
    expect(lerpAngleDegree(350, 10, 0.5)).toEqual(0);
    expect(lerpAngleDegree(350, 10, 0.25)).toEqual(355);
    expect(lerpAngleDegree(350, 10, 0.75)).toEqual(5);
  });

  it('should take the shortest arc across the 360/0 boundary (counter-clockwise)', () => {
    // 10 to 350 is -20 deg counter-clockwise, midpoint is 0
    expect(lerpAngleDegree(10, 350, 0.5)).toEqual(0);
    expect(lerpAngleDegree(10, 350, 0.25)).toEqual(5);
    expect(lerpAngleDegree(10, 350, 0.75)).toEqual(355);
  });

  it('should handle inputs outside [0, 360) and normalize the output', () => {
    expect(lerpAngleDegree(-10, 10, 0.5)).toEqual(0);
    expect(lerpAngleDegree(710, 370, 0.5)).toEqual(0);
  });
});

describe('linearInterpolate', () => {
  describe('y value are number', () => {
    it('should return y1 when x is equal to x1', () => {
      expect(linearInterpolate(1, 2, 3, 4, 1)).toEqual(2);
    });

    it('should return y2 when x is equal to x2', () => {
      expect(linearInterpolate(1, 2, 3, 4, 3)).toEqual(4);
    });

    it('should return the interpolated value when x is between x1 and x2', () => {
      expect(linearInterpolate(1, 2, 3, 4, 2)).toEqual(3);
    });

    it('should return the correct interpolated value for any x', () => {
      expect(linearInterpolate(1, 2, 3, 4, 1.5)).toEqual(2.5);
      expect(linearInterpolate(1, 2, 3, 4, 2.5)).toEqual(3.5);
    });
  });

  describe('y value are number[]', () => {
    it('should return y1 when x is equal to x1', () => {
      expect(linearInterpolate(1, [2, 3], 3, [4, 5], 1)).toEqual([2, 3]);
      expect(linearInterpolate(3, [2, 3], 1, [4, 5], 3)).toEqual([2, 3]);
    });

    it('should return y2 when x is equal to x2', () => {
      expect(linearInterpolate(1, [2, 3], 3, [4, 5], 3)).toEqual([4, 5]);
      expect(linearInterpolate(3, [2, 3], 1, [4, 5], 1)).toEqual([4, 5]);
    });

    it('should return the interpolated value when x is between x1 and x2', () => {
      expect(linearInterpolate(1, [2, 3], 3, [4, 5], 2)).toEqual([3, 4]);
      expect(linearInterpolate(3, [2, 3], 1, [4, 5], 2)).toEqual([3, 4]);
    });

    it('should return the correct interpolated value for any x', () => {
      expect(linearInterpolate(1, [2, 3], 3, [4, 5], 1.5)).toEqual([2.5, 3.5]);
      expect(linearInterpolate(3, [4, 5], 1, [2, 3], 1.5)).toEqual([2.5, 3.5]);
      expect(linearInterpolate(1, [2, 3], 3, [4, 5], 2.5)).toEqual([3.5, 4.5]);
      expect(linearInterpolate(3, [4, 5], 1, [2, 3], 2.5)).toEqual([3.5, 4.5]);
    });

    it('should support custom lerpFn for arrays', () => {
      expect(linearInterpolate(1, [350, 10], 3, [10, 350], 2, lerpAngleDegree)).toEqual([0, 0]);
    });
  });

  describe('custom lerpFn', () => {
    it('should support lerpAngleDegree for scalar values', () => {
      expect(linearInterpolate(1, 350, 3, 10, 2, lerpAngleDegree)).toEqual(0);
    });
  });
});

describe('sampleAt', () => {
  it('should return the correct value when targetXs is a single number', () => {
    const xs = [1, 2, 3, 4];
    const ys = [10, 20, 30, 40];
    expect(sampleAt(xs, ys, 2.5)).toEqual(25);
  });

  it('should return the correct value when targetXs is an array of numbers', () => {
    const xs = [1, 2, 3, 4];
    const ys = [10, 20, 30, 40];
    expect(sampleAt(xs, ys, [2.5, 3.5])).toEqual([25, 35]);
  });

  it('should return the correct value when ys is an array of arrays', () => {
    const xs = [1, 2, 3, 4];
    const ys = [
      [10, 11],
      [20, 21],
      [30, 31],
      [40, 41],
    ];
    expect(sampleAt(xs, ys, 2.5)).toEqual([25, 26]);
  });

  it('should return the correct value when targetXs is an array of numbers and ys is an array of arrays', () => {
    const xs = [1, 2, 3, 4];
    const ys = [
      [10, 11],
      [20, 21],
      [30, 31],
      [40, 41],
    ];
    expect(sampleAt(xs, ys, [2.5, 3.5])).toEqual([
      [25, 26],
      [35, 36],
    ]);
  });

  it('should return the correct value when xs is in descending order', () => {
    const xs = [4, 3, 2, 1];
    const ys = [10, 20, 30, 40];
    expect(sampleAt(xs, ys, 2.5)).toEqual(25);
  });

  it('should return the correct value when targetXs is outside the range of xs', () => {
    const xs = [1, 2, 3, 4];
    const ys = [10, 20, 30, 40];
    expect(sampleAt(xs, ys, 0)).toEqual(0);
    expect(sampleAt(xs, ys, 5)).toEqual(50);
  });

  it('should interpolate angles with lerpAngleDegree over time on 2D arrays (e.g. windDirByTime)', () => {
    const timesMs = [1000, 2000];
    // Level 1: 350 -> 10 (midpoint 0), Level 2: 10 -> 350 (midpoint 0)
    const windDirByTime = [
      [350, 10],
      [10, 350],
    ];
    expect(sampleAt(timesMs, windDirByTime, 1500, lerpAngleDegree)).toEqual([0, 0]);
  });
});

describe('scaleLinear', () => {
  it('should scale values linearly', () => {
    const from = [0, 10];
    const to = [0, 100];
    const scale = scaleLinear(from, to);
    expect(scale(0)).toEqual(0);
    expect(scale(5)).toEqual(50);
    expect(scale(10)).toEqual(100);
  });

  it('should invert scaled values', () => {
    const from = [0, 10];
    const to = [0, 100];
    const scale = scaleLinear(from, to);
    expect(scale.invert(0)).toEqual(0);
    expect(scale.invert(50)).toEqual(5);
    expect(scale.invert(100)).toEqual(10);
  });
});

describe('scaleLog', () => {
  it('should scale values logarithmically', () => {
    const from = [2, 20];
    const to = [10, 100];
    const scale = scaleLog(from, to);
    expect(scale(2)).toBeCloseTo(10);
    expect(scale(5)).toBeCloseTo(10 + ((100 - 10) * (Math.log(5) - Math.log(2))) / (Math.log(20) - Math.log(2)));
    expect(scale(20)).toBeCloseTo(100);
  });

  it('should invert scaled values', () => {
    const from = [2, 20];
    const to = [10, 100];
    const scale = scaleLog(from, to);
    expect(scale.invert(10)).toBeCloseTo(2);
    expect(scale.invert(10 + ((100 - 10) * (Math.log(5) - Math.log(2))) / (Math.log(20) - Math.log(2)))).toBeCloseTo(5);
    expect(scale.invert(100)).toBeCloseTo(20);
  });
});

describe('composeScales', () => {
  it('should compose multiple scales', () => {
    const scale1 = scaleLinear([0, 10], [0, 100]);
    const scale2 = scaleLog([1, 10], [0, 100]);
    const composedScale = composeScales(scale1, scale2);

    expect(composedScale(5)).toBeCloseTo(scale2(scale1(5)));
  });

  it('should invert composed scales', () => {
    const scale1 = scaleLinear([0, 10], [0, 100]);
    const scale2 = scaleLog([1, 10], [0, 100]);
    const composedScale = composeScales(scale1, scale2);

    const scaledValue = composedScale(5);
    expect(composedScale.invert(scaledValue)).toBeCloseTo(5);
  });

  it('should compose multiple scales with different types', () => {
    const scale1 = scaleLinear([0, 10], [0, 100]);
    const scale2 = scaleLinear([0, 10], [0, 20]);
    const scale3 = scaleLog([1, 10], [0, 100]);
    const composedScale = composeScales(scale1, scale2, scale3);

    expect(composedScale(5)).toBeCloseTo(scale3(scale2(scale1(5))));
  });

  it('should invert composed scales with different types', () => {
    const scale1 = scaleLinear([0, 10], [0, 100]);
    const scale2 = scaleLinear([0, 10], [0, 20]);
    const scale3 = scaleLog([1, 10], [0, 100]);
    const composedScale = composeScales(scale1, scale2, scale3);

    const scaledValue = composedScale(5);
    expect(composedScale.invert(scaledValue)).toBeCloseTo(5);
  });
});

describe('svgPath', () => {
  it('should convert an array of points to an SVG path string', () => {
    const scaleX = (point: [x: number, y: number]) => point[0] * 10;
    const scaleY = (point: [x: number, y: number]) => point[1] * 10;
    const svgPathFn = svgPath(scaleX, scaleY);
    expect(
      svgPathFn([
        [0, 0],
        [1, 1],
        [10, 10],
      ]),
    ).toEqual('M0,0l10,10l90,90');
  });
});

describe('round', () => {
  it('should round a number to a specified number of decimal places', () => {
    expect(round(1.2345, 2)).toEqual(1.23);
  });
});

describe('firstIntersection', () => {
  it('should return the correct intersection point for two lines', () => {
    const x1s = [0, 10, 20];
    const y1s = [10, 20, 30];
    const x2s = [5, 15, 25];
    const y2s = [15, 25, 35];
    expect(firstIntersection(x1s, y1s, x2s, y2s)).toEqual([5, 15]);
  });

  it('should return undefined if no intersection is found', () => {
    const x1s = [0, 10, 20];
    const y1s = [10, 20, 30];
    const x2s = [25, 35, 45];
    const y2s = [35, 45, 55];
    expect(firstIntersection(x1s, y1s, x2s, y2s)).toBeUndefined();
  });
});

describe('zip', () => {
  it('should zip two arrays into an array of tuples', () => {
    const a = [1, 2, 3];
    const b = ['a', 'b', 'c'];
    expect(zip(a, b)).toEqual([
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
    ]);
  });
});
