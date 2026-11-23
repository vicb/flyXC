import {
  densifyFlatRings,
  pointInFlatPolygon,
  pointToSegmentSquared2D,
  simplifyCoords,
  simplifyDouglasPeucker,
  simplifyPath,
  simplifyRadialDist,
} from './geometry';

describe('geometry', () => {
  describe('pointToSegmentSquared2D', () => {
    it('returns 0 when the point lies on the segment', () => {
      expect(pointToSegmentSquared2D(5, 0, 0, 0, 10, 0)).toBe(0);
      expect(pointToSegmentSquared2D(0, 0, 0, 0, 10, 0)).toBe(0);
      expect(pointToSegmentSquared2D(10, 0, 0, 0, 10, 0)).toBe(0);
    });

    it('computes squared perpendicular distance when projection falls within segment', () => {
      expect(pointToSegmentSquared2D(5, 3, 0, 0, 10, 0)).toBe(9);
      expect(pointToSegmentSquared2D(2, -4, 0, 0, 10, 0)).toBe(16);
    });

    it('clamps to segment start when point projects before start', () => {
      expect(pointToSegmentSquared2D(-3, 4, 0, 0, 10, 0)).toBe(25);
    });

    it('clamps to segment end when point projects after end', () => {
      expect(pointToSegmentSquared2D(13, 4, 0, 0, 10, 0)).toBe(25);
    });

    it('handles degenerate zero-length segments', () => {
      expect(pointToSegmentSquared2D(3, 4, 0, 0, 0, 0)).toBe(25);
    });
  });

  describe('pointInFlatPolygon', () => {
    // Square [0,0] -> [10,10]
    const squareCoords = new Float64Array([0, 0, 10, 0, 10, 10, 0, 10, 0, 0]);
    const squareEnds = new Uint32Array([10]);

    it('returns true when point is inside polygon and false when outside', () => {
      expect(pointInFlatPolygon(5, 5, squareCoords, squareEnds)).toBe(true);
      expect(pointInFlatPolygon(15, 5, squareCoords, squareEnds)).toBe(false);
      expect(pointInFlatPolygon(-1, 5, squareCoords, squareEnds)).toBe(false);
    });

    it('correctly handles polygon holes', () => {
      // Outer square [0,0]->[10,10], hole [3,3]->[7,7]
      const coords = new Float64Array([0, 0, 10, 0, 10, 10, 0, 10, 0, 0, 3, 3, 7, 3, 7, 7, 3, 7, 3, 3]);
      const ends = new Uint32Array([10, 20]);

      expect(pointInFlatPolygon(5, 5, coords, ends)).toBe(false); // inside hole
      expect(pointInFlatPolygon(1, 1, coords, ends)).toBe(true); // inside outer, outside hole
      expect(pointInFlatPolygon(12, 5, coords, ends)).toBe(false); // outside
    });

    it('ignores degenerate rings with fewer than 3 vertices', () => {
      expect(pointInFlatPolygon(5, 5, new Float64Array([0, 0, 1, 1]), new Uint32Array([4]))).toBe(false);
      expect(pointInFlatPolygon(5, 5, new Float64Array([]), new Uint32Array([]))).toBe(false);
    });
  });

  describe('densifyFlatRings', () => {
    it('strips duplicate consecutive points', () => {
      const coords = new Float64Array([0, 0, 0, 0, 10, 0, 10, 0, 10, 10, 0, 10, 0, 0]);
      const ends = new Uint32Array([coords.length]);
      const result = densifyFlatRings(coords, ends);

      expect(result.ends).toEqual(new Uint32Array([10]));
      expect(Array.from(result.coords)).toEqual([0, 0, 10, 0, 10, 10, 0, 10, 0, 0]);
    });

    it('subdivides long segments when maxStepMeters is provided', () => {
      // Segment of ~111km (1 degree latitude)
      const coords = new Float64Array([0, 0, 0, 1, 1, 1, 0, 0]);
      const ends = new Uint32Array([coords.length]);
      const result = densifyFlatRings(coords, ends, 40_000);

      // 111km / 40km -> 3 steps (adds 2 intermediate vertices for that edge)
      expect(result.coords.length).toBeGreaterThan(coords.length);
      expect(result.ends[0]).toBe(result.coords.length);
    });
  });

  describe('simplifyDouglasPeucker', () => {
    it('returns short point lists as is', () => {
      const pts: [number, number][] = [
        [0, 0],
        [10, 10],
      ];
      expect(simplifyDouglasPeucker(pts, 1)).toBe(pts);
    });

    it('simplifies intermediate points on a straight line', () => {
      const pts: [number, number][] = [
        [0, 0],
        [1, 0.1],
        [2, -0.1],
        [3, 0],
        [10, 0],
      ];
      const simplified = simplifyDouglasPeucker(pts, 0.5);
      expect(simplified).toEqual([
        [0, 0],
        [10, 0],
      ]);
    });

    it('retains corner vertices exceeding tolerance', () => {
      const pts: [number, number][] = [
        [0, 0],
        [5, 10],
        [10, 0],
      ];
      expect(simplifyDouglasPeucker(pts, 1)).toEqual(pts);
    });
  });

  describe('simplifyRadialDist', () => {
    it('returns short point lists as is', () => {
      const pts: [number, number][] = [[0, 0]];
      expect(simplifyRadialDist(pts, 1)).toBe(pts);
    });

    it('removes points closer than tolerance to the previous point', () => {
      const pts: [number, number][] = [
        [0, 0],
        [0.1, 0.1],
        [0.2, 0.2],
        [2, 2],
        [2.1, 2.1],
      ];
      const result = simplifyRadialDist(pts, 1);
      expect(result).toEqual([
        [0, 0],
        [2, 2],
        [2.1, 2.1],
      ]);
    });
  });

  describe('simplifyPath', () => {
    it('combines radial distance filtering and Douglas-Peucker', () => {
      const pts: [number, number][] = [
        [0, 0],
        [0.1, 0.1],
        [5, 10],
        [5.1, 10.1],
        [10, 0],
      ];
      const result = simplifyPath(pts, 1);
      expect(result).toEqual([
        [0, 0],
        [5, 10],
        [10, 0],
      ]);
    });
  });

  describe('simplifyCoords', () => {
    it('returns short coordinate lists as is', () => {
      const coords: [number, number][] = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ];
      expect(simplifyCoords(coords, 15)).toBe(coords);
    });

    it('returns coordinates unmodified when tolerance is 0 or negative', () => {
      const coords: [number, number][] = [
        [0, 0],
        [0.5, 0.5],
        [1, 1],
        [1, 0],
        [0, 0],
      ];
      expect(simplifyCoords(coords, 0)).toBe(coords);
      expect(simplifyCoords(coords, -5)).toBe(coords);
    });

    it('removes redundant collinear intermediate points within tolerance', () => {
      const coords: [number, number][] = [
        [0, 0],
        [0.00001, 0.00001],
        [0.00002, 0.00002],
        [1, 1],
        [1, 0],
        [0, 0],
      ];
      const simplified = simplifyCoords(coords, 15);
      expect(simplified.length).toBeLessThan(coords.length);
      expect(simplified[0]).toEqual([0, 0]);
      expect(simplified[simplified.length - 1]).toEqual([0, 0]);
    });

    it('preserves original coordinates if simplification would produce fewer than 4 points', () => {
      const coords: [number, number][] = [
        [0, 0],
        [0.000001, 0],
        [0.000001, 0.000001],
        [0, 0.000001],
        [0, 0],
      ];
      const simplified = simplifyCoords(coords, 100);
      expect(simplified.length).toBeGreaterThanOrEqual(4);
    });
  });
});
