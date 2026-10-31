import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { computeDestinationPoint, getGreatCircleBearing, getPreciseDistance } from 'geolib';

import { CircuitType, type ScoringRuleName } from './api';
import type { LatLon } from './optimizer';
import { initOptimizer, scoreTrack } from './optimizer';
import { createInterpolatedTrack } from './test-utils';

// Canonical test geometries
const P_START: LatLon = { lat: 45, lon: 5 };
const P_EAST: LatLon = { lat: 45, lon: 6 };
const P_NORTH_EAST: LatLon = { lat: 46, lon: 6 };
const P_NORTH: LatLon = { lat: 46, lon: 5 };
const P_FAR_NORTH: LatLon = { lat: 47, lon: 5 };

const STRAIGHT_LINE: LatLon[] = [P_START, P_EAST];
const OPEN_1TP: LatLon[] = [P_START, P_EAST, P_NORTH_EAST];
const OPEN_2TP: LatLon[] = [P_START, P_EAST, P_NORTH_EAST, P_NORTH];
const OPEN_3TP: LatLon[] = [P_START, P_EAST, P_NORTH_EAST, P_NORTH, P_FAR_NORTH];

// Flat triangle: base ~78 km, height ~22 km (< 28% of perimeter)
const FLAT_TRIANGLE: LatLon[] = [P_START, P_EAST, { lat: 45.2, lon: 6 }, P_START];

// FAI triangle: equilateral triangle (each side 33.3% of perimeter >= 28%)
const d = getPreciseDistance(P_START, P_EAST);
const bearing = getGreatCircleBearing(P_START, P_EAST);
const pFaiTop = computeDestinationPoint(P_START, d, bearing + 60);
const FAI_TRIANGLE: LatLon[] = [P_START, P_EAST, { lat: pFaiTop.latitude, lon: pFaiTop.longitude }, P_START];

// Out and Return: closed circuit with 2 turnpoints (~78 km each way)
const OUT_AND_RETURN: LatLon[] = [P_START, P_EAST, P_START];

function totalLegDistanceKm(waypoints: LatLon[]): number {
  let meters = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    meters += getPreciseDistance(waypoints[i], waypoints[i + 1]);
  }
  return meters / 1000;
}

describe('optimizer', () => {
  beforeAll(async () => {
    const wasmPath = createRequire(import.meta.url).resolve('rustigc-wasm/rustigc_wasm_bg.wasm');
    await initOptimizer(readFileSync(wasmPath));
  });

  describe('Edge cases', () => {
    it('scores an empty track with 0', () => {
      expect(scoreTrack([], 'WorldXC')).toEqual({
        score: 0,
        lengthKm: 0,
        multiplier: 0,
        circuit: CircuitType.OpenDistance,
        turnpoints: [],
        path: [],
      });
    });

    it('scores a single-point track with 0', () => {
      expect(scoreTrack([P_START], 'WorldXC')).toEqual({
        score: 0,
        lengthKm: 0,
        multiplier: 0,
        circuit: CircuitType.OpenDistance,
        turnpoints: [],
        path: [P_START],
      });
    });

    it('calculates unoptimized FCC distance sum when rule is "None"', () => {
      const expectedKm = totalLegDistanceKm(OPEN_2TP);
      const result = scoreTrack(OPEN_2TP, 'None');
      expect(result.multiplier).toBe(1);
      expect(result.circuit).toBe(CircuitType.OpenDistance);
      expect(result.turnpoints).toHaveLength(2);
      expect(result.lengthKm).toBeCloseTo(expectedKm, 1);
      expect(result.score).toBeCloseTo(expectedKm, 1);
    });

    it('preserves input route and reports 0 multiplier when track does not meet league constraints', () => {
      const shortTrack: LatLon[] = [
        { lat: 45, lon: 5 },
        { lat: 45.001, lon: 5 },
      ];
      const result = scoreTrack(shortTrack, 'UKClub');
      expect(result.score).toBe(0);
      expect(result.multiplier).toBe(0);
      expect(result.path).toEqual(shortTrack);
    });
  });

  describe('Circuit type classification', () => {
    it('classifies a straight line as OpenDistance', () => {
      const expectedKm = totalLegDistanceKm(STRAIGHT_LINE);
      const result = scoreTrack(STRAIGHT_LINE, 'WorldXC');
      expect(result.circuit).toBe(CircuitType.OpenDistance);
      expect(result.lengthKm).toBeCloseTo(expectedKm, 1);
      expect(result.turnpoints).toHaveLength(0);
    });

    it.each([
      { name: '1 turnpoint', waypoints: OPEN_1TP, expectedTurnpoints: 1 },
      { name: '2 turnpoints', waypoints: OPEN_2TP, expectedTurnpoints: 2 },
      { name: '3 turnpoints', waypoints: OPEN_3TP, expectedTurnpoints: 3 },
    ])('classifies open flight with $name as OpenDistance', ({ waypoints, expectedTurnpoints }) => {
      const expectedKm = totalLegDistanceKm(waypoints);
      const result = scoreTrack(waypoints, 'WorldXC');
      expect(result.circuit).toBe(CircuitType.OpenDistance);
      expect(result.lengthKm).toBeCloseTo(expectedKm, 1);
      expect(result.turnpoints).toHaveLength(expectedTurnpoints);
    });

    it('classifies an asymmetric triangle as FlatTriangle', () => {
      const expectedKm = totalLegDistanceKm(FLAT_TRIANGLE);
      const result = scoreTrack(FLAT_TRIANGLE, 'WorldXC');
      expect(result.circuit).toBe(CircuitType.FlatTriangle);
      expect(result.lengthKm).toBeCloseTo(expectedKm, 1);
      expect(result.turnpoints).toHaveLength(3);
    });

    it('classifies an equilateral triangle as FaiTriangle', () => {
      const expectedKm = totalLegDistanceKm(FAI_TRIANGLE);
      const result = scoreTrack(FAI_TRIANGLE, 'WorldXC');
      expect(result.circuit).toBe(CircuitType.FaiTriangle);
      expect(result.lengthKm).toBeCloseTo(expectedKm, 1);
      expect(result.turnpoints).toHaveLength(3);
    });

    it('classifies an out-and-return course as OutAndReturn', () => {
      const result = scoreTrack(OUT_AND_RETURN, 'UKClub');
      expect(result.circuit).toBe(CircuitType.OutAndReturn);
      expect(result.turnpoints).toHaveLength(2);
    });
  });

  describe('Dense / interpolated track invariance', () => {
    it('produces equivalent score when legs are densely sampled', () => {
      const sparseResult = scoreTrack(FAI_TRIANGLE, 'WorldXC');
      const denseTrack = createInterpolatedTrack(FAI_TRIANGLE, 10);
      const denseResult = scoreTrack(denseTrack, 'WorldXC');

      expect(denseResult.circuit).toBe(sparseResult.circuit);
      expect(denseResult.multiplier).toBe(sparseResult.multiplier);
      expect(denseResult.lengthKm).toBeCloseTo(sparseResult.lengthKm, 1);
      expect(denseResult.score).toBeCloseTo(sparseResult.score, 1);
    });
  });

  describe('League multipliers', () => {
    it.each([
      { league: 'CzechLocal', open: 1.0, flat: 1.8, fai: 2.2 },
      { league: 'CzechEurope', open: 1.0, flat: 1.2, fai: 1.4 },
      { league: 'CzechOutsideEurope', open: 0.8, flat: 1.2, fai: 1.4 },
      { league: 'FFVL', open: 1.0, flat: 1.2, fai: 1.4 },
      { league: 'Leonardo', open: 1.5, flat: 1.75, fai: 2.0 },
      { league: 'Norway', open: 1.0, flat: 1.6, fai: 1.8 },
      { league: 'UKClub', open: 1.0, flat: 1.7, fai: 2.0 },
      { league: 'UKInternational', open: 1.0, flat: 1.2, fai: 1.5 },
      { league: 'UKNational', open: 1.0, flat: 1.7, fai: 2.0 },
      { league: 'XContest', open: 1.0, flat: 1.4, fai: 1.6 },
      { league: 'XContestPPG', open: 1.0, flat: 2.0, fai: 4.0 },
      { league: 'WorldXC', open: 1.0, flat: 1.75, fai: 2.0 },
    ] as const)('applies correct multipliers for $league', ({ league, open, flat, fai }) => {
      const openResult = scoreTrack(STRAIGHT_LINE, league as ScoringRuleName);
      expect(openResult.multiplier).toBe(open);
      expect(openResult.score).toBeCloseTo(openResult.lengthKm * open, 1);

      const flatResult = scoreTrack(FLAT_TRIANGLE, league as ScoringRuleName);
      expect(flatResult.multiplier).toBe(flat);
      expect(flatResult.score).toBeCloseTo(flatResult.lengthKm * flat, 1);

      const faiResult = scoreTrack(FAI_TRIANGLE, league as ScoringRuleName);
      expect(faiResult.multiplier).toBe(fai);
      expect(faiResult.score).toBeCloseTo(faiResult.lengthKm * fai, 1);
    });

    it.each([
      { league: 'UKClub', multiplier: 1.7 },
      { league: 'UKNational', multiplier: 1.7 },
    ] as const)('applies out-and-return multiplier for $league', ({ league, multiplier }) => {
      const result = scoreTrack(OUT_AND_RETURN, league as ScoringRuleName);
      expect(result.circuit).toBe(CircuitType.OutAndReturn);
      expect(result.multiplier).toBe(multiplier);
    });
  });

  describe('Closing radius and threshold rules', () => {
    // 130.9 km triangle with small closing gap (< 3 km)
    const TRIANGLE_SMALL_GAP: LatLon[] = [
      { lat: 45.20467, lon: 5.72595 },
      { lat: 45.62463, lon: 6.11006 },
      { lat: 45.25107, lon: 6.15041 },
      { lat: 45.20169, lon: 5.74171 },
    ];

    // 130.9 km triangle with larger closing gap (> 3 km)
    const TRIANGLE_LARGE_GAP: LatLon[] = [
      { lat: 45.20467, lon: 5.72595 },
      { lat: 45.62463, lon: 6.11006 },
      { lat: 45.25107, lon: 6.15041 },
      { lat: 45.1902, lon: 5.78684 },
    ];

    it('returns fixed 3 km closing distance for FFVL when gap < 3 km', () => {
      expect(scoreTrack(TRIANGLE_SMALL_GAP, 'FFVL').closing?.radiusKm).toBe(3);
    });

    it('returns relative closing distance for FFVL when gap > 3 km', () => {
      expect(scoreTrack(TRIANGLE_LARGE_GAP, 'FFVL').closing?.radiusKm).toBeGreaterThan(3);
    });

    it.each(['CzechLocal', 'CzechEurope', 'CzechOutsideEurope'] as const)(
      'returns relative closing distance for %s',
      (rule) => {
        expect(scoreTrack(TRIANGLE_LARGE_GAP, rule).closing?.radiusKm).toBeLessThan(20);
      },
    );

    it('returns closing information for closed circuits and leaves it undefined for open distance', () => {
      const resultSmall = scoreTrack(TRIANGLE_SMALL_GAP, 'FFVL');
      expect(resultSmall.closing).toBeDefined();
      if (resultSmall.closing) {
        expect(resultSmall.closing.gapKm).toBeLessThan(resultSmall.closing.radiusKm);
        expect(resultSmall.closing.startPoint).toBeDefined();
        expect(resultSmall.closing.endPoint).toBeDefined();
      }

      const resultLarge = scoreTrack(TRIANGLE_LARGE_GAP, 'FFVL');
      expect(resultLarge.closing).toBeDefined();
      expect(resultLarge.closing?.gapKm).toBeGreaterThan(1);

      const resultOpen = scoreTrack(OPEN_2TP, 'FFVL');
      expect(resultOpen.closing).toBeUndefined();
    });
  });
});
