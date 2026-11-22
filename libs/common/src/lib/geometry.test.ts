import {
  boundsOverlap,
  computeBounds,
  densifyPolyline,
  flattenPolygonRings,
  getPointX,
  getPointY,
  pointInPolygonRings,
  pointToSegmentSquared2D,
  segmentIntersection,
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

  describe('segmentIntersection', () => {
    it('returns parametric t when two segments intersect', () => {
      // Perpendicular crossing at (5, 5), t = 0.5 along (0, 5)->(10, 5)
      expect(segmentIntersection(0, 5, 10, 5, 5, 0, 5, 10)).toBeCloseTo(0.5);
      // Crossing at (2, 2), t = 0.2 along (0, 0)->(10, 10)
      expect(segmentIntersection(0, 0, 10, 10, 0, 4, 4, 0)).toBeCloseTo(0.2);
    });

    it('returns t when segments intersect exactly at endpoints', () => {
      // Intersection at start of segment 1 (t = 0)
      expect(segmentIntersection(5, 5, 10, 5, 5, 0, 5, 10)).toBeCloseTo(0);
      // Intersection at end of segment 1 (t = 1)
      expect(segmentIntersection(0, 5, 5, 5, 5, 0, 5, 10)).toBeCloseTo(1);
    });

    it('returns null when lines would intersect outside segment bounds', () => {
      // Lines intersect at (15, 5), which is beyond segment 1 end (10, 5)
      expect(segmentIntersection(0, 5, 10, 5, 15, 0, 15, 10)).toBeNull();
      // Lines intersect before segment 1 start
      expect(segmentIntersection(5, 5, 10, 5, 0, 0, 0, 10)).toBeNull();
      // Segments cross paths but do not reach each other
      expect(segmentIntersection(0, 0, 2, 2, 5, 0, 0, 5)).toBeNull();
    });

    it('returns null for parallel segments', () => {
      // Parallel horizontal segments
      expect(segmentIntersection(0, 0, 10, 0, 0, 5, 10, 5)).toBeNull();
      // Parallel diagonal segments
      expect(segmentIntersection(0, 0, 10, 10, 1, 0, 11, 10)).toBeNull();
    });

    it('returns null for collinear segments', () => {
      // Collinear overlapping
      expect(segmentIntersection(0, 0, 10, 0, 5, 0, 15, 0)).toBeNull();
      // Collinear disjoint
      expect(segmentIntersection(0, 0, 5, 0, 6, 0, 10, 0)).toBeNull();
    });
  });

  describe('getPointX and getPointY', () => {
    it('extracts coordinates from [x, y] tuples', () => {
      const pt: [number, number] = [12.5, 45.8];
      expect(getPointX(pt)).toBe(12.5);
      expect(getPointY(pt)).toBe(45.8);
    });

    it('extracts coordinates from Point objects {x, y}', () => {
      const pt = { x: -3.2, y: 51.4 };
      expect(getPointX(pt)).toBe(-3.2);
      expect(getPointY(pt)).toBe(51.4);
    });
  });

  describe('pointInPolygonRings', () => {
    const outerRing: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ];
    const holeRing: [number, number][] = [
      [2, 2],
      [8, 2],
      [8, 8],
      [2, 8],
      [2, 2],
    ];

    it('returns true when point is inside outer ring with no holes', () => {
      expect(pointInPolygonRings(5, 5, [outerRing])).toBe(true);
    });

    it('returns false when point is outside outer ring', () => {
      expect(pointInPolygonRings(15, 5, [outerRing])).toBe(false);
      expect(pointInPolygonRings(-1, 5, [outerRing])).toBe(false);
    });

    it('returns false when point is inside a hole', () => {
      expect(pointInPolygonRings(5, 5, [outerRing, holeRing])).toBe(false);
    });

    it('returns true when point is inside outer ring but outside hole', () => {
      expect(pointInPolygonRings(1, 1, [outerRing, holeRing])).toBe(true);
    });

    it('works with Point objects ({x, y})', () => {
      const pointRing = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 0 },
      ];
      expect(pointInPolygonRings(5, 5, [pointRing])).toBe(true);
      expect(pointInPolygonRings(15, 5, [pointRing])).toBe(false);
    });

    it('works with unclosed rings', () => {
      const unclosed: [number, number][] = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ];
      expect(pointInPolygonRings(5, 5, [unclosed])).toBe(true);
      expect(pointInPolygonRings(15, 5, [unclosed])).toBe(false);
    });

    it('ignores degenerate rings with fewer than 3 vertices', () => {
      expect(pointInPolygonRings(5, 5, [[]])).toBe(false);
      expect(
        pointInPolygonRings(5, 5, [
          [
            [0, 0],
            [1, 1],
          ],
        ]),
      ).toBe(false);
    });
  });

  describe('computeBounds', () => {
    it('computes bounding box for flat array of points', () => {
      const bounds = computeBounds([
        [0, 5],
        [10, 2],
        [-5, 20],
      ]);
      expect(bounds).toEqual({ xmin: -5, ymin: 2, xmax: 10, ymax: 20 });
    });

    it('computes bounding box for flat array of Point objects ({x, y})', () => {
      const bounds = computeBounds([
        { x: 0, y: 5 },
        { x: 10, y: 2 },
        { x: -5, y: 20 },
      ]);
      expect(bounds).toEqual({ xmin: -5, ymin: 2, xmax: 10, ymax: 20 });
    });

    it('computes bounding box for nested polygon rings', () => {
      const ring1: [number, number][] = [
        [0, 0],
        [10, 10],
      ];
      const ring2: [number, number][] = [
        [-5, -10],
        [5, 5],
      ];
      const bounds = computeBounds([ring1, ring2]);
      expect(bounds).toEqual({ xmin: -5, ymin: -10, xmax: 10, ymax: 10 });
    });

    it('computes bounding box for nested rings of Point objects', () => {
      const ring1 = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ];
      const ring2 = [
        { x: -5, y: -10 },
        { x: 5, y: 5 },
      ];
      const bounds = computeBounds([ring1, ring2]);
      expect(bounds).toEqual({ xmin: -5, ymin: -10, xmax: 10, ymax: 10 });
    });

    it('returns undefined for empty input', () => {
      expect(computeBounds([])).toBeUndefined();
    });
  });

  describe('boundsOverlap', () => {
    it('returns true for overlapping boxes', () => {
      const b1 = { xmin: 0, ymin: 0, xmax: 10, ymax: 10 };
      const b2 = { xmin: 5, ymin: 5, xmax: 15, ymax: 15 };
      expect(boundsOverlap(b1, b2)).toBe(true);
    });

    it('returns false for disjoint boxes', () => {
      const b1 = { xmin: 0, ymin: 0, xmax: 10, ymax: 10 };
      const b2 = { xmin: 15, ymin: 15, xmax: 20, ymax: 20 };
      expect(boundsOverlap(b1, b2)).toBe(false);
    });
  });

  describe('densifyPolyline', () => {
    it('returns short line unchanged', () => {
      const coords: [number, number][] = [[0, 0]];
      expect(densifyPolyline(coords, 1000)).toBe(coords);
    });

    it('strips duplicate consecutive points', () => {
      const coords: [number, number][] = [
        [0, 0],
        [0, 0],
        [0.001, 0.001],
      ];
      const result = densifyPolyline(coords, 100_000);
      expect(result.length).toBe(2);
    });

    it('subdivides long segments based on maxStepMeters', () => {
      // 1 degree latitude ~ 111,139m
      const coords: [number, number][] = [
        [0, 0],
        [0, 1],
      ];
      const result = densifyPolyline(coords, 30_000);
      // ~111km / 30km = 4 steps -> 5 points
      expect(result.length).toBeGreaterThan(2);
      expect(result[0]).toEqual([0, 0]);
      expect(result[result.length - 1]).toEqual([0, 1]);
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

  describe('flattenPolygonRings', () => {
    it('flattens polygons into a flat list of rings', () => {
      const poly1Ring1 = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ];
      const poly1Ring2 = [
        [0.2, 0.2],
        [0.8, 0.2],
        [0.8, 0.8],
        [0.2, 0.2],
      ];
      const poly2Ring1 = [
        [2, 2],
        [3, 2],
        [3, 3],
        [2, 2],
      ];

      const rings = flattenPolygonRings([[poly1Ring1, poly1Ring2], [poly2Ring1]]);
      expect(rings).toHaveLength(3);
      expect(rings[0]).toBe(poly1Ring1);
      expect(rings[1]).toBe(poly1Ring2);
      expect(rings[2]).toBe(poly2Ring1);
    });

    it('filters out rings with fewer than minVertices', () => {
      const validRing = [
        [0, 0],
        [1, 0],
        [1, 1],
      ];
      const degenerateRing = [
        [0, 0],
        [1, 0],
      ];
      const emptyRing: number[][] = [];

      const rings = flattenPolygonRings([[validRing, degenerateRing, emptyRing]]);
      expect(rings).toHaveLength(1);
      expect(rings[0]).toBe(validRing);
    });

    it('returns an empty array for null or empty input', () => {
      expect(flattenPolygonRings(null)).toEqual([]);
      expect(flattenPolygonRings(undefined)).toEqual([]);
      expect(flattenPolygonRings([])).toEqual([]);
      expect(flattenPolygonRings([[]])).toEqual([]);
    });
  });
});
