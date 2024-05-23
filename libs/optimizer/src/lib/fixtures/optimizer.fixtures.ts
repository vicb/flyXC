import { OptimizationRequest, OptimizationResult } from '../optimizer';
import { computeDestinationPoint, getGreatCircleBearing, getPreciseDistance } from 'geolib';
import { createSegments } from '../utils/createSegments';
import { concatTracks } from '../utils/concatTracks';
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
  givenRequest: OptimizationRequest;
  givenRules: ScoringRules;
  expectedResult: OptimizationResult;
};

/**
 * returns an empty track and its expected score
 */
export function createEmptyTrackFixture(): OptimizerFixture {
  return {
    givenRequest: {
      track: { points: [], minTimeSec: 0 },
    },
    givenRules: ScoringRules.FederationFrancaiseVolLibre,
    expectedResult: {
      score: 0,
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
 * @returns a fixture for a free distance track and it's expected score
 * @param from LatLon of the starting point of the free distance
 * @param to LatLon of the ending point of the free distance
 * @param nbSegments number of segments to create between the two points
 * @param givenRules the ScoringRules for computing the score
 */
export function createFreeDistanceFixture(
  from: LatLon,
  to: LatLon,
  nbSegments: number,
  givenRules: ScoringRules,
): OptimizerFixture {
  const multiplier = getFreeDistanceMultiplier(givenRules);
  return {
    givenRequest: {
      track: createSegments(
        { ...from, alt: 0, timeSec: 0 },
        { ...to, alt: 0, timeSec: 60 },
        START_TIME_SEC,
        nbSegments,
      ),
    },
    givenRules,
    expectedResult: {
      score: (getPreciseDistance(from, to) / 1000) * multiplier,
      optimal: true,
    },
  };
}

/**
 *
 * @returns a fixture for a free distance track with one intermediate bypass point and it's expected score
 * @param from LatLon of the starting point of the free distance
 * @param intermediate LatLon of the intermediate bypass point
 * @param to LatLon of the ending point of the free distance
 * @param nbSegments number of segments to create between each given points
 * @param givenRules the ScoringRules for computing the score
 */
export function createFreeDistance1PointFixture(
  from: LatLon,
  intermediate: LatLon,
  to: LatLon,
  nbSegments: number,
  givenRules: ScoringRules,
): OptimizerFixture {
  return {
    givenRequest: {
      track: concatTracks(
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
    givenRules,
    expectedResult: {
      score:
        ((getPreciseDistance(from, intermediate) + getPreciseDistance(intermediate, to)) / 1000) *
        getFreeDistanceMultiplier(givenRules),
      optimal: true,
    },
  };
}

/**
 *
 * @returns a fixture for a free distance track with two intermediate bypass points and it's expected score
 * @param from LatLon of the starting point of the free distance
 * @param intermediate1 LatLon of the first intermediate bypass point
 * @param intermediate2 LatLon of the second intermediate bypass point
 * @param to LatLon of the ending point of the free distance
 * @param nbSegments number of segments to create between each given points
 * @param givenRules the ScoringRules for computing the score
 */
export function createFreeDistance2PointsFixture(
  from: LatLon,
  intermediate1: LatLon,
  intermediate2: LatLon,
  to: LatLon,
  nbSegments: number,
  givenRules: ScoringRules,
): OptimizerFixture {
  return {
    givenRequest: {
      track: concatTracks(
        createSegments(
          { ...from, alt: 0, timeSec: 0 },
          { ...intermediate1, alt: 0, timeSec: 60 },
          START_TIME_SEC,
          nbSegments,
        ),
        createSegments(
          { ...intermediate1, alt: 0, timeSec: 60 },
          { ...intermediate2, alt: 0, timeSec: 120 },
          START_TIME_SEC,
          nbSegments,
        ),
        createSegments(
          { ...intermediate2, alt: 0, timeSec: 120 },
          { ...to, alt: 0, timeSec: 180 },
          START_TIME_SEC,
          nbSegments,
        ),
      ),
    },
    givenRules,
    expectedResult: {
      score:
        ((getPreciseDistance(from, intermediate1) +
          getPreciseDistance(intermediate1, intermediate2) +
          getPreciseDistance(intermediate2, to)) /
          1000) *
        getFreeDistanceMultiplier(givenRules),
      optimal: true,
    },
  };
}

/**
 *
 * @returns a fixture for a free distance track with three intermediate bypass points and it's expected score
 * @param from LatLon of the starting point of the free distance
 * @param intermediate1 LatLon of the first intermediate bypass point
 * @param intermediate2 LatLon of the second intermediate bypass point
 * @param intermediate3 LatLon of the third intermediate bypass point
 * @param to LatLon of the ending point of the free distance
 * @param nbSegments number of segments to create between each given points
 * @param givenRules the ScoringRules for computing the score
 */
export function createFreeDistance3PointsFixture(
  from: LatLon,
  intermediate1: LatLon,
  intermediate2: LatLon,
  intermediate3: LatLon,
  to: LatLon,
  nbSegments: number,
  givenRules: ScoringRules,
): OptimizerFixture {
  return {
    givenRequest: {
      track: concatTracks(
        createSegments(
          { ...from, alt: 0, timeSec: 0 },
          { ...intermediate1, alt: 0, timeSec: 60 },
          START_TIME_SEC,
          nbSegments,
        ),
        createSegments(
          { ...intermediate1, alt: 0, timeSec: 60 },
          { ...intermediate2, alt: 0, timeSec: 120 },
          START_TIME_SEC,
          nbSegments,
        ),
        createSegments(
          { ...intermediate2, alt: 0, timeSec: 120 },
          { ...intermediate3, alt: 0, timeSec: 180 },
          START_TIME_SEC,
          nbSegments,
        ),
        createSegments(
          { ...intermediate3, alt: 0, timeSec: 180 },
          { ...to, alt: 0, timeSec: 240 },
          START_TIME_SEC,
          nbSegments,
        ),
      ),
    },
    givenRules,
    expectedResult: {
      score:
        ((getPreciseDistance(from, intermediate1) +
          getPreciseDistance(intermediate1, intermediate2) +
          getPreciseDistance(intermediate2, intermediate3) +
          getPreciseDistance(intermediate3, to)) /
          1000) *
        getFreeDistanceMultiplier(givenRules),
      optimal: true,
    },
  };
}

/**
 *
 * @returns a fixture for a flat triangle track and it's expected score
 * @param start LatLon of the starting point of the flat triangle (first point of the triangle)
 * @param p1 LatLon of the second point of the triangle
 * @param p2 LatLon of the third point of the triangle
 * @param nbSegments number of segments to create between each given points
 * @param givenRules the ScoringRules for computing the score
 */
export function createClosedFlatTriangleFixture(
  start: LatLon,
  p1: LatLon,
  p2: LatLon,
  nbSegments: number,
  givenRules: ScoringRules,
): OptimizerFixture {
  if (isFAI(start, p1, p2)) {
    throw new Error('invalid test data: not a flat triangle');
  }
  const multiplier = getFlatTriangleMultiplier(givenRules);
  return createTriangleFixture(start, p1, p2, nbSegments, givenRules, multiplier);
}

/**
 *
 * @returns a fixture for a FAI triangle track and it's expected score
 * @param start LatLon of the starting point of the flat triangle (first point of the triangle)
 * @param p1 LatLon of the second point of the triangle
 * @param nbSegments number of segments to create between each given points
 * @param givenRules the ScoringRules for computing the score
 *
 * The third point of the triangle is computed so that the triangle is equilateral
 */
export function createClosedFaiTriangleFixture(
  start: LatLon,
  p1: LatLon,
  nbSegments: number,
  givenRules: ScoringRules,
): OptimizerFixture {
  const distance1 = getPreciseDistance(start, p1);
  const bearingStartToP1 = getGreatCircleBearing(start, p1);
  // The third point 'p2' is at 'distance1' from 'p1' on a line which makes a 60° angle with the line 'start'->'p1'
  const equilateralPoint = computeDestinationPoint(start, distance1, bearingStartToP1 + 60);
  const p2 = { lat: equilateralPoint.latitude, lon: equilateralPoint.longitude };
  if (!isFAI(start, p1, p2)) {
    throw new Error('invalid test data: not a FAI triangle');
  }
  const multiplier = getFaiTriangleMultiplier(givenRules);
  return createTriangleFixture(start, p1, p2, nbSegments, givenRules, multiplier);
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
    givenRequest: {
      ...standardFixture.givenRequest,
      options: {
        maxCycleDurationMs: 1,
      },
    },
    givenRules,
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
    givenRequest: {
      ...standardFixture.givenRequest,
      options: {
        maxNumCycles: 10,
      },
    },
    givenRules,
    expectedResult: standardFixture.expectedResult,
  };
}


function getFreeDistanceMultiplier(scoringRules: ScoringRules) {
  switch (scoringRules) {
    case ScoringRules.CzechLocal:
    case ScoringRules.CzechEuropean:
    case ScoringRules.FederationFrancaiseVolLibre:
    case ScoringRules.Norway:
    case ScoringRules.UnitedKingdomClub:
    case ScoringRules.UnitedKingdomInternational:
    case ScoringRules.UnitedKingdomNational:
    case ScoringRules.XContest:
    case ScoringRules.XContestPPG:
    case ScoringRules.WorldXC:
      return 1;
    case ScoringRules.CzechOutsideEurope:
      return 0.8;
    case ScoringRules.Leonardo:
      return 1.5;
  }
}

function getFlatTriangleMultiplier(scoringRules: ScoringRules) {
  switch (scoringRules) {
    case ScoringRules.CzechEuropean:
    case ScoringRules.CzechOutsideEurope:
    case ScoringRules.FederationFrancaiseVolLibre:
    case ScoringRules.UnitedKingdomInternational:
      return 1.2;
    case ScoringRules.Leonardo:
    case ScoringRules.WorldXC:
      return 1.75;
    case ScoringRules.XContest:
      return 1.4;
    case ScoringRules.Norway:
    case ScoringRules.UnitedKingdomClub:
    case ScoringRules.UnitedKingdomNational:
      return 1.7;
    case ScoringRules.CzechLocal:
      return 1.8;
    case ScoringRules.XContestPPG:
      return 2;
  }
}

function getFaiTriangleMultiplier(scoringRules: ScoringRules) {
  switch (scoringRules) {
    case ScoringRules.CzechEuropean:
    case ScoringRules.CzechOutsideEurope:
    case ScoringRules.FederationFrancaiseVolLibre:
      return 1.4;
    case ScoringRules.Leonardo:
    case ScoringRules.UnitedKingdomClub:
    case ScoringRules.UnitedKingdomNational:
    case ScoringRules.WorldXC:
      return 2;
    case ScoringRules.XContest:
      return 1.6;
    case ScoringRules.CzechLocal:
      return 2.2;
    case ScoringRules.Norway:
      return 2.4;
    case ScoringRules.UnitedKingdomInternational:
      return 1.5;
    case ScoringRules.XContestPPG:
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
) {
  const distance1 = getPreciseDistance(start, p1);
  const distance2 = getPreciseDistance(p1, p2);
  const distance3 = getPreciseDistance(p2, start);
  const expectedScore = ((distance1 + distance2 + distance3) * multiplier) / 1000;
  return {
    givenRequest: {
      track: concatTracks(
        createSegments({ ...start, alt: 0, timeSec: 0 }, { ...p1, alt: 0, timeSec: 60 }, START_TIME_SEC, nbSegments),
        createSegments({ ...p1, alt: 0, timeSec: 60 }, { ...p2, alt: 0, timeSec: 120 }, START_TIME_SEC, nbSegments),
        createSegments({ ...p2, alt: 0, timeSec: 120 }, { ...start, alt: 0, timeSec: 180 }, START_TIME_SEC, nbSegments),
      ),
    },
    givenRules,
    expectedResult: {
      score: expectedScore,
      optimal: true,
    },
  };
}
