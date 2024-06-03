import type { ScoringRequest, ScoringResult} from './optimizer';
import { CircuitType, getOptimizer } from './optimizer';
import type { ScoringRuleName} from './scoring-rules';
import { scoringRuleNames } from './scoring-rules';
import { computeDestinationPoint, getGreatCircleBearing, getPreciseDistance } from 'geolib';
import { createSegments } from './utils/create-segments';
import { mergeTracks } from './utils/merge-tracks';

describe('optimizer', () => {
  scoringRuleNames.forEach((ruleName) => {
    describe(`${ruleName} rules`, () => {
      it('Scores an empty request with a score of 0', () => {
        const request = {
          track: { points: [] },
        };
        const result = optimize(request, ruleName);
        expect(result).toMatchObject({
          score: 0,
          lengthKm: 0,
          multiplier: 0,
          optimal: true,
        });
      });

      [1, 10].forEach((segmentsPerBranch) => {
        describe(`given a free distanceKm request (${segmentsPerBranch} segments/branch)`, () => {
          const start = { lat: 45, lon: 5 };
          const end = { lat: 45, lon: 6 };

          const request = {
            track: createSegments({ ...start, alt: 0, timeSec: 0 }, { ...end, alt: 0, timeSec: 60 }, segmentsPerBranch),
          };

          const multiplier = getFreeDistanceMultiplier(ruleName);
          const distanceKm = getPreciseDistance(start, end) / 1000;
          expect(optimize(request, ruleName)).toMatchObject({
            score: expect.closeTo(distanceKm * multiplier, 1),
            lengthKm: expect.closeTo(distanceKm, 1),
            multiplier,
            circuit: CircuitType.OpenDistance,
            optimal: true,
          });
        });

        describe(`given a free distanceKm with 1 turnpoints request (${segmentsPerBranch} segment/branch)`, () => {
          const start = { lat: 45, lon: 5 };
          const tp = { lat: 45, lon: 6 };
          const end = { lat: 46, lon: 6 };

          const request = {
            track: mergeTracks(
              createSegments({ ...start, alt: 0, timeSec: 0 }, { ...tp, alt: 0, timeSec: 60 }, segmentsPerBranch),
              createSegments({ ...tp, alt: 0, timeSec: 60 }, { ...end, alt: 0, timeSec: 120 }, segmentsPerBranch),
            ),
          };

          const distanceKm = (getPreciseDistance(start, tp) + getPreciseDistance(tp, end)) / 1000;
          const multiplier = getFreeDistanceMultiplier(ruleName);
          expect(optimize(request, ruleName)).toMatchObject({
            score: expect.closeTo(distanceKm * multiplier, 1),
            lengthKm: expect.closeTo(distanceKm, 1),
            multiplier,
            circuit: CircuitType.OpenDistance,
            optimal: true,
          });
        });

        describe(`given a free distanceKm with 2 turnpoints request (${segmentsPerBranch} segment/branch)`, () => {
          const start = { lat: 45, lon: 5 };
          const tp1 = { lat: 45, lon: 6 };
          const tp2 = { lat: 46, lon: 6 };
          const end = { lat: 46, lon: 5 };

          const request = {
            track: mergeTracks(
              createSegments({ ...start, alt: 0, timeSec: 0 }, { ...tp1, alt: 0, timeSec: 60 }, segmentsPerBranch),
              createSegments({ ...tp1, alt: 0, timeSec: 60 }, { ...tp2, alt: 0, timeSec: 120 }, segmentsPerBranch),
              createSegments({ ...tp2, alt: 0, timeSec: 120 }, { ...end, alt: 0, timeSec: 180 }, segmentsPerBranch),
            ),
          };

          const distanceKm =
            (getPreciseDistance(start, tp1) + getPreciseDistance(tp1, tp2) + getPreciseDistance(tp2, end)) / 1000;
          const multiplier = getFreeDistanceMultiplier(ruleName);
          expect(optimize(request, ruleName)).toMatchObject({
            score: expect.closeTo(distanceKm * multiplier, 1),
            lengthKm: expect.closeTo(distanceKm, 1),
            multiplier,
            circuit: CircuitType.OpenDistance,
            optimal: true,
          });
        });

        describe(`given a free distanceKm with 3 turnpoints request (${segmentsPerBranch} segment/branch)`, () => {
          const start = { lat: 45, lon: 5 };
          const tp1 = { lat: 45, lon: 6 };
          const tp2 = { lat: 46, lon: 6 };
          const tp3 = { lat: 46, lon: 5 };
          const end = { lat: 47, lon: 5 };

          const request = {
            track: mergeTracks(
              createSegments({ ...start, alt: 0, timeSec: 0 }, { ...tp1, alt: 0, timeSec: 60 }, segmentsPerBranch),
              createSegments({ ...tp1, alt: 0, timeSec: 60 }, { ...tp2, alt: 0, timeSec: 120 }, segmentsPerBranch),
              createSegments({ ...tp2, alt: 0, timeSec: 120 }, { ...tp3, alt: 0, timeSec: 180 }, segmentsPerBranch),
              createSegments({ ...tp3, alt: 0, timeSec: 180 }, { ...end, alt: 0, timeSec: 240 }, segmentsPerBranch),
            ),
          };

          const distanceKm =
            (getPreciseDistance(start, tp1) +
              getPreciseDistance(tp1, tp2) +
              getPreciseDistance(tp2, tp3) +
              getPreciseDistance(tp3, end)) /
            1000;
          const multiplier = getFreeDistanceMultiplier(ruleName);
          expect(optimize(request, ruleName)).toMatchObject({
            score: expect.closeTo(distanceKm * multiplier, 1),
            lengthKm: expect.closeTo(distanceKm, 1),
            multiplier,
            circuit: CircuitType.OpenDistance,
            optimal: true,
          });
        });

        describe(`given a closed flat triangle request (${segmentsPerBranch} segment/branch)`, () => {
          const tp1 = { lat: 45, lon: 5 };
          const tp2 = { lat: 45, lon: 6 };
          const tp3 = { lat: 45.2, lon: 6 };

          const request = {
            track: mergeTracks(
              createSegments({ ...tp1, alt: 0, timeSec: 0 }, { ...tp2, alt: 0, timeSec: 60 }, segmentsPerBranch),
              createSegments({ ...tp2, alt: 0, timeSec: 60 }, { ...tp3, alt: 0, timeSec: 120 }, segmentsPerBranch),
              createSegments({ ...tp3, alt: 0, timeSec: 120 }, { ...tp1, alt: 0, timeSec: 180 }, segmentsPerBranch),
            ),
          };

          const distanceKm =
            (getPreciseDistance(tp1, tp2) + getPreciseDistance(tp2, tp3) + getPreciseDistance(tp3, tp1)) / 1000;
          const multiplier = getFlatTriangleMultiplier(ruleName);
          expect(optimize(request, ruleName)).toMatchObject({
            score: expect.closeTo(distanceKm * multiplier, 1),
            lengthKm: expect.closeTo(distanceKm, 1),
            multiplier,
            circuit: CircuitType.FlatTriangle,
            optimal: true,
          });
        });

        describe(`given a closed FAI triangle request (${segmentsPerBranch} segment/branch)`, () => {
          const tp1 = { lat: 45, lon: 5 };
          const tp2 = { lat: 45, lon: 6 };

          const distance1 = getPreciseDistance(tp1, tp2);
          const bearing = getGreatCircleBearing(tp1, tp2);
          // Build an equilateral triangle
          const tp3GeoLib = computeDestinationPoint(tp1, distance1, bearing + 60);
          const tp3 = { lat: tp3GeoLib.latitude, lon: tp3GeoLib.longitude };

          const request = {
            track: mergeTracks(
              createSegments({ ...tp1, alt: 0, timeSec: 0 }, { ...tp2, alt: 0, timeSec: 60 }, segmentsPerBranch),
              createSegments({ ...tp2, alt: 0, timeSec: 60 }, { ...tp3, alt: 0, timeSec: 120 }, segmentsPerBranch),
              createSegments({ ...tp3, alt: 0, timeSec: 120 }, { ...tp1, alt: 0, timeSec: 180 }, segmentsPerBranch),
            ),
          };

          const distanceKm =
            (getPreciseDistance(tp1, tp2) + getPreciseDistance(tp2, tp3) + getPreciseDistance(tp3, tp1)) / 1000;
          const multiplier = getFaiTriangleMultiplier(ruleName);
          expect(optimize(request, ruleName)).toMatchObject({
            score: expect.closeTo(distanceKm * multiplier, 1),
            lengthKm: expect.closeTo(distanceKm, 1),
            multiplier,
            circuit: CircuitType.FaiTriangle,
            optimal: true,
          });
        });
      });
    });
  });

  it('given a closed FAI triangle request (10 segments/branch) with minimal loop allowed', () => {
    const tp1 = { lat: 45, lon: 5 };
    const tp2 = { lat: 45, lon: 6 };

    const distance1 = getPreciseDistance(tp1, tp2);
    const bearing = getGreatCircleBearing(tp1, tp2);
    // Build an equilateral triangle
    const tp3GeoLib = computeDestinationPoint(tp1, distance1, bearing + 60);
    const tp3 = { lat: tp3GeoLib.latitude, lon: tp3GeoLib.longitude };

    const request: ScoringRequest = {
      track: mergeTracks(
        createSegments({ ...tp1, alt: 0, timeSec: 0 }, { ...tp2, alt: 0, timeSec: 60 }, 10),
        createSegments({ ...tp2, alt: 0, timeSec: 60 }, { ...tp3, alt: 0, timeSec: 120 }, 10),
        createSegments({ ...tp3, alt: 0, timeSec: 120 }, { ...tp1, alt: 0, timeSec: 180 }, 10),
      ),
      maxNumCycles: 1,
    };

    const distanceKm =
      (getPreciseDistance(tp1, tp2) + getPreciseDistance(tp2, tp3) + getPreciseDistance(tp3, tp1)) / 1000;
    const multiplier = getFaiTriangleMultiplier('FFVL');
    expect(optimize(request, 'FFVL')).toMatchObject({
      score: expect.closeTo(distanceKm * multiplier, 1),
      lengthKm: expect.closeTo(distanceKm, 1),
      multiplier,
      circuit: CircuitType.FaiTriangle,
      optimal: true,
    });
  });
});

function optimize(request: ScoringRequest, ruleName: ScoringRuleName): ScoringResult {
  const optimizer = getOptimizer(request, ruleName);
  let result: IteratorResult<ScoringResult, ScoringResult>;
  do {
    result = optimizer.next();
  } while (!result.done);

  expect(result.value.optimal).toBe(true);

  return result.value;
}

// TODO: refactor to extract from the rules
function getFreeDistanceMultiplier(scoringRules: ScoringRuleName) {
  switch (scoringRules) {
    case 'CzechLocal':
    case 'CzechEurope':
    case 'FFVL':
    case 'Norway':
    case 'UKClub':
    case 'UKInternational':
    case 'UKNational':
    case 'XContest':
    case 'XContestPPG':
    case 'WorldXC':
      return 1;
    case 'CzechOutsideEurope':
      return 0.8;
    case 'Leonardo':
      return 1.5;
  }
}

// TODO: refactor to extract from the rules
function getFlatTriangleMultiplier(scoringRules: ScoringRuleName) {
  switch (scoringRules) {
    case 'CzechEurope':
    case 'CzechOutsideEurope':
    case 'FFVL':
    case 'UKInternational':
      return 1.2;
    case 'Leonardo':
    case 'WorldXC':
      return 1.75;
    case 'XContest':
      return 1.4;
    case 'Norway':
    case 'UKClub':
    case 'UKNational':
      return 1.7;
    case 'CzechLocal':
      return 1.8;
    case 'XContestPPG':
      return 2;
  }
}

// TODO: refactor to extract from the rules
function getFaiTriangleMultiplier(scoringRules: ScoringRuleName) {
  switch (scoringRules) {
    case 'CzechEurope':
    case 'CzechOutsideEurope':
    case 'FFVL':
      return 1.4;
    case 'Leonardo':
    case 'UKClub':
    case 'UKNational':
    case 'WorldXC':
      return 2;
    case 'XContest':
      return 1.6;
    case 'CzechLocal':
      return 2.2;
    case 'Norway':
      return 2.4;
    case 'UKInternational':
      return 1.5;
    case 'XContestPPG':
      return 4;
  }
}
