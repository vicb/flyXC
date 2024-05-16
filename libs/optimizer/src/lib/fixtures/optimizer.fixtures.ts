import { OptimizationRequest, OptimizationResult, CircuitType } from '../optimizer';
import { computeDestinationPoint, getGreatCircleBearing, getPreciseDistance } from 'geolib';
import { createSegments } from '../utils/createSegments';
import { mergeTracks } from '../utils/mergeTracks';
import { ScoringRules } from '../scoringRules';

/**
 * Functions to generate test fixtures for the optimizer tests
 */

/**
 * Test fixture for the optimizer tests
 * givenRequest: the OptimizationRequest to test the optimizer
 * expectedResult: the expected OptimizationResult that should be returned by the optimizer
 */
export type OptimizerFixture = {
  request: OptimizationRequest;
  rules: ScoringRules;
  expectedResult: Omit<OptimizationResult, 'closingRadius' | 'solutionIndices'>;
};

/**
 * returns an empty track and its expected score
 */
export function createEmptyTrackFixture(): OptimizerFixture {
  return {
    request: {
      track: { points: [], startTimeSec: 0 },
    },
    rules: 'FederationFrancaiseVolLibre',
    expectedResult: {
      score: 0,
      lengthKm: 0,
      multiplier: 0,
      circuit: undefined,
      optimal: true,
    },
  };
}

export type LatLon = {
  lat: number;
  lon: number;
};

const START_TIME_SEC = Math.round(new Date().getTime() / 1000);
/**
 * @param from LatLon of the starting point
 * @param to LatLon of the ending point
 * @param nbSegments number of segments to create between the two points
 * @param givenRules the ScoringRules for computing the score
 * @returns a fixture for a free distance track and it's expected score
 */
export function createFreeDistanceFixture(
  from: LatLon,
  to: LatLon,
  nbSegments: number,
  givenRules: ScoringRules,
): OptimizerFixture {
  const multiplier = getFreeDistanceMultiplier(givenRules);
  const distance = getPreciseDistance(from, to) / 1000;
  return {
    request: {
      track: createSegments(
        { ...from, alt: 0, timeSec: 0 },
        { ...to, alt: 0, timeSec: 60 },
        START_TIME_SEC,
        nbSegments,
      ),
    },
    rules: givenRules,
    expectedResult: {
      score: distance * multiplier,
      lengthKm: distance,
      multiplier,
      circuit: CircuitType.OpenDistance,
      optimal: true,
    },
  };
}

/**
 *
 * @param from LatLon of the starting point
 * @param intermediate LatLon of the intermediate turn point
 * @param to LatLon of the ending point
 * @param nbSegments number of segments to create between each given points
 * @param givenRules the ScoringRules for computing the score
 * @returns a fixture for a free distance track with one intermediate turn point point and it's expected score
 */
export function createFreeDistance1PointFixture(
  from: LatLon,
  intermediate: LatLon,
  to: LatLon,
  nbSegments: number,
  givenRules: ScoringRules,
): OptimizerFixture {
  const distance = (getPreciseDistance(from, intermediate) + getPreciseDistance(intermediate, to)) / 1000;
  const multiplier = getFreeDistanceMultiplier(givenRules);
  return {
    request: {
      track: mergeTracks(
        createSegments(
          { ...from, alt: 0, timeSec: 0 },
          { ...intermediate, alt: 0, timeSec: 60 },
          START_TIME_SEC,
          nbSegments,
        ),
        createSegments(
          { ...intermediate, alt: 0, timeSec: 60 },
          { ...to, alt: 0, timeSec: 120 },
          START_TIME_SEC,
          nbSegments,
        ),
      ),
    },
    rules: givenRules,
    expectedResult: {
      score: distance * multiplier,
      lengthKm: distance,
      multiplier,
      circuit: CircuitType.OpenDistance,
      optimal: true,
    },
  };
}

/**
 *
 * @param from LatLon of the starting point
 * @param turnPoint1 LatLon of the first intermediate turn point
 * @param turnPoint2 LatLon of the second intermediate turn point
 * @param to LatLon of the ending point
 * @param nbSegments number of segments to create between each given points
 * @param givenRules the ScoringRules for computing the score
 * @returns a fixture for a free distance track with two intermediate turn points and it's expected score
 */
export function createFreeDistance2PointsFixture(
  from: LatLon,
  turnPoint1: LatLon,
  turnPoint2: LatLon,
  to: LatLon,
  nbSegments: number,
  givenRules: ScoringRules,
): OptimizerFixture {
  const distance =
    (getPreciseDistance(from, turnPoint1) +
      getPreciseDistance(turnPoint1, turnPoint2) +
      getPreciseDistance(turnPoint2, to)) /
    1000;
  const multiplier = getFreeDistanceMultiplier(givenRules);
  return {
    request: {
      track: mergeTracks(
        createSegments(
          { ...from, alt: 0, timeSec: 0 },
          { ...turnPoint1, alt: 0, timeSec: 60 },
          START_TIME_SEC,
          nbSegments,
        ),
        createSegments(
          { ...turnPoint1, alt: 0, timeSec: 60 },
          { ...turnPoint2, alt: 0, timeSec: 120 },
          START_TIME_SEC,
          nbSegments,
        ),
        createSegments(
          { ...turnPoint2, alt: 0, timeSec: 120 },
          { ...to, alt: 0, timeSec: 180 },
          START_TIME_SEC,
          nbSegments,
        ),
      ),
    },
    rules: givenRules,
    expectedResult: {
      score: distance * multiplier,
      lengthKm: distance,
      multiplier,
      circuit: CircuitType.OpenDistance,
      optimal: true,
    },
  };
}

/**
 *
 * @param from LatLon of the starting point
 * @param turnPoint1 LatLon of the first intermediate turn point
 * @param turnPoint2 LatLon of the second intermediate turn point
 * @param turnPoint3 LatLon of the third intermediate turn point
 * @param to LatLon of the ending point
 * @param nbSegments number of segments to create between each given points
 * @param givenRules the ScoringRules for computing the score
 * @returns a fixture for a free distance track with three intermediate turn points and it's expected score
 */
export function createFreeDistance3PointsFixture(
  from: LatLon,
  turnPoint1: LatLon,
  turnPoint2: LatLon,
  turnPoint3: LatLon,
  to: LatLon,
  nbSegments: number,
  givenRules: ScoringRules,
): OptimizerFixture {
  const distance =
    (getPreciseDistance(from, turnPoint1) +
      getPreciseDistance(turnPoint1, turnPoint2) +
      getPreciseDistance(turnPoint2, turnPoint3) +
      getPreciseDistance(turnPoint3, to)) /
    1000;
  const multiplier = getFreeDistanceMultiplier(givenRules);
  return {
    request: {
      track: mergeTracks(
        createSegments(
          { ...from, alt: 0, timeSec: 0 },
          { ...turnPoint1, alt: 0, timeSec: 60 },
          START_TIME_SEC,
          nbSegments,
        ),
        createSegments(
          { ...turnPoint1, alt: 0, timeSec: 60 },
          { ...turnPoint2, alt: 0, timeSec: 120 },
          START_TIME_SEC,
          nbSegments,
        ),
        createSegments(
          { ...turnPoint2, alt: 0, timeSec: 120 },
          { ...turnPoint3, alt: 0, timeSec: 180 },
          START_TIME_SEC,
          nbSegments,
        ),
        createSegments(
          { ...turnPoint3, alt: 0, timeSec: 180 },
          { ...to, alt: 0, timeSec: 240 },
          START_TIME_SEC,
          nbSegments,
        ),
      ),
    },
    rules: givenRules,
    expectedResult: {
      score: distance * multiplier,
      lengthKm: distance,
      multiplier,
      circuit: CircuitType.OpenDistance,
      optimal: true,
    },
  };
}

/**
 *
 * @param start LatLon of the starting point of the flat triangle (first point of the triangle)
 * @param turnPoint1 LatLon of the second point of the triangle
 * @param turnPoint2 LatLon of the third point of the triangle
 * @param nbSegments number of segments to create between each given points
 * @param givenRules the ScoringRules for computing the score
 * @returns a fixture for a flat triangle track and it's expected score
 */
export function createClosedFlatTriangleFixture(
  start: LatLon,
  turnPoint1: LatLon,
  turnPoint2: LatLon,
  nbSegments: number,
  givenRules: ScoringRules,
): OptimizerFixture {
  if (isFAI(start, turnPoint1, turnPoint2)) {
    throw new Error('invalid test data: not a flat triangle');
  }
  const multiplier = getFlatTriangleMultiplier(givenRules);
  return createTriangleFixture(start, turnPoint1, turnPoint2, nbSegments, givenRules, multiplier, CircuitType.FlatTriangle);
}

/**
 *
 * @param start LatLon of the starting point of the flat triangle (first point of the triangle)
 * @param turnPoint1 LatLon of the second point of the triangle
 * @param nbSegments number of segments to create between each given points
 * @param givenRules the ScoringRules for computing the score
 * @returns a fixture for a FAI triangle track and it's expected score
 *
 * The third point of the triangle is computed so that the triangle is equilateral
 */
export function createClosedFaiTriangleFixture(
  start: LatLon,
  turnPoint1: LatLon,
  nbSegments: number,
  givenRules: ScoringRules,
): OptimizerFixture {
  const distance1 = getPreciseDistance(start, turnPoint1);
  const bearingStartToP1 = getGreatCircleBearing(start, turnPoint1);
  // The third point 'p2' is at 'distance1' from 'p1' on a line which makes a 60° angle with the line 'start'->'p1'
  const equilateralPoint = computeDestinationPoint(start, distance1, bearingStartToP1 + 60);
  const p2 = { lat: equilateralPoint.latitude, lon: equilateralPoint.longitude };
  if (!isFAI(start, turnPoint1, p2)) {
    throw new Error('invalid test data: not a FAI triangle');
  }
  const multiplier = getFaiTriangleMultiplier(givenRules);
  return createTriangleFixture(start, turnPoint1, p2, nbSegments, givenRules, multiplier, CircuitType.FaiTriangle);
}

/**
 * same as closedFaiTriangleFixture with a maximum allowed cycle duration of 1 ms for optimization
 */
export function createClosedFaiTriangleFixtureWithSmallCycle(
  start: LatLon,
  p1: LatLon,
  nbIntervals: number,
  givenRules: ScoringRules,
): OptimizerFixture {
  const standardFixture = createClosedFaiTriangleFixture(start, p1, nbIntervals, givenRules);
  return {
    request: {
      ...standardFixture.request,
      options: {
        maxCycleDurationMs: 1,
      },
    },
    rules: givenRules,
    expectedResult: standardFixture.expectedResult,
  };
}

/**
 * same as closedFaiTriangleFixture with a only ten iterations allowed for optimization
 */
export function createClosedFaiTriangleFixtureWithSmallLoop(
  start: LatLon,
  p1: LatLon,
  nbIntervals: number,
  givenRules: ScoringRules,
): OptimizerFixture {
  const standardFixture = createClosedFaiTriangleFixture(start, p1, nbIntervals, givenRules);
  return {
    request: {
      ...standardFixture.request,
      options: {
        maxNumCycles: 10,
      },
    },
    rules: givenRules,
    expectedResult: standardFixture.expectedResult,
  };
}

function getFreeDistanceMultiplier(scoringRules: ScoringRules) {
  switch (scoringRules) {
    case 'CzechLocal':
    case 'CzechEuropean':
    case 'FederationFrancaiseVolLibre':
    case 'Norway':
    case 'UnitedKingdomClub':
    case 'UnitedKingdomInternational':
    case 'UnitedKingdomNational':
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

function getFlatTriangleMultiplier(scoringRules: ScoringRules) {
  switch (scoringRules) {
    case 'CzechEuropean':
    case 'CzechOutsideEurope':
    case 'FederationFrancaiseVolLibre':
    case 'UnitedKingdomInternational':
      return 1.2;
    case 'Leonardo':
    case 'WorldXC':
      return 1.75;
    case 'XContest':
      return 1.4;
    case 'Norway':
    case 'UnitedKingdomClub':
    case 'UnitedKingdomNational':
      return 1.7;
    case 'CzechLocal':
      return 1.8;
    case 'XContestPPG':
      return 2;
  }
}

function getFaiTriangleMultiplier(scoringRules: ScoringRules) {
  switch (scoringRules) {
    case 'CzechEuropean':
    case 'CzechOutsideEurope':
    case 'FederationFrancaiseVolLibre':
      return 1.4;
    case 'Leonardo':
    case 'UnitedKingdomClub':
    case 'UnitedKingdomNational':
    case 'WorldXC':
      return 2;
    case 'XContest':
      return 1.6;
    case 'CzechLocal':
      return 2.2;
    case 'Norway':
      return 2.4;
    case 'UnitedKingdomInternational':
      return 1.5;
    case 'XContestPPG':
      return 4;
  }
}

function isFAI(p1: LatLon, p2: LatLon, p3: LatLon) {
  const distance1 = getPreciseDistance(p1, p2);
  const distance2 = getPreciseDistance(p2, p3);
  const distance3 = getPreciseDistance(p3, p1);
  const totalDistance = distance1 + distance2 + distance3;
  const minDistance = Math.min(distance1, distance2, distance3);
  const threshold = totalDistance * 0.28;
  return minDistance > threshold;
}

function createTriangleFixture(
  start: LatLon,
  p1: LatLon,
  p2: { lon: number; lat: number },
  nbSegments: number,
  givenRules: ScoringRules,
  multiplier: number,
  circuit: CircuitType,
): OptimizerFixture {
  const distance1 = getPreciseDistance(start, p1);
  const distance2 = getPreciseDistance(p1, p2);
  const distance3 = getPreciseDistance(p2, start);
  const lengthKm = (distance1 + distance2 + distance3) / 1000;
  const expectedScore = lengthKm * multiplier;
  return {
    request: {
      track: mergeTracks(
        createSegments({ ...start, alt: 0, timeSec: 0 }, { ...p1, alt: 0, timeSec: 60 }, START_TIME_SEC, nbSegments),
        createSegments({ ...p1, alt: 0, timeSec: 60 }, { ...p2, alt: 0, timeSec: 120 }, START_TIME_SEC, nbSegments),
        createSegments({ ...p2, alt: 0, timeSec: 120 }, { ...start, alt: 0, timeSec: 180 }, START_TIME_SEC, nbSegments),
      ),
    },
    rules: givenRules,
    expectedResult: {
      score: expectedScore,
      lengthKm,
      multiplier,
      circuit,
      optimal: true,
    },
  };
}
