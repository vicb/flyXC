import { OptimizationRequest, OptimizationResult } from '../optimizer';
import { LatLon } from '@flyxc/common';
import { computeDestinationPoint, getGreatCircleBearing, getPreciseDistance } from 'geolib';
import { splitSegment } from '../utils/splitSegment';
import { concatTracks } from '../utils/concatTracks';
import { LeagueCode } from '../scoringRules';

export type OptimizerFixture = {
  givenRequest: OptimizationRequest;
  expectedResult: OptimizationResult;
};

export function emptyTrackFixture(): OptimizerFixture {
  return {
    givenRequest: {
      track: { lat: [], lon: [], alt: [], timeSec: [], minTimeSec: 0 },
    },
    expectedResult: {
      score: 0,
      optimal: true,
    },
  };
}

export function freeDistanceFixture(
  from: LatLon,
  to: LatLon,
  nbIntervals: number,
  league: LeagueCode,
): OptimizerFixture {
  const multiplier = freeDistanceMultiplier(league);
  return {
    givenRequest: {
      track: splitSegment({ ...from, alt: 0, timeSec: 0 }, { ...to, alt: 0, timeSec: 60 }, nbIntervals),
      league,
    },
    expectedResult: {
      score: (getPreciseDistance(from, to) / 1000) * multiplier,
      optimal: true,
    },
  };
}

export function freeDistance1PointFixture(
  from: LatLon,
  intermediate: LatLon,
  to: LatLon,
  nbIntervals: number,
  league: LeagueCode,
): OptimizerFixture {
  return {
    givenRequest: {
      track: concatTracks(
        splitSegment({ ...from, alt: 0, timeSec: 0 }, { ...intermediate, alt: 0, timeSec: 60 }, nbIntervals),
        splitSegment({ ...intermediate, alt: 0, timeSec: 60 }, { ...to, alt: 0, timeSec: 120 }, nbIntervals),
      ),
      league,
    },
    expectedResult: {
      score:
        ((getPreciseDistance(from, intermediate) + getPreciseDistance(intermediate, to)) / 1000) *
        freeDistanceMultiplier(league),
      optimal: true,
    },
  };
}

export function freeDistance2PointsFixture(
  from: LatLon,
  intermediate1: LatLon,
  intermediate2: LatLon,
  to: LatLon,
  nbIntervals: number,
  league: LeagueCode,
): OptimizerFixture {
  return {
    givenRequest: {
      track: concatTracks(
        splitSegment({ ...from, alt: 0, timeSec: 0 }, { ...intermediate1, alt: 0, timeSec: 60 }, nbIntervals),
        splitSegment(
          { ...intermediate1, alt: 0, timeSec: 60 },
          { ...intermediate2, alt: 0, timeSec: 120 },
          nbIntervals,
        ),
        splitSegment({ ...intermediate2, alt: 0, timeSec: 120 }, { ...to, alt: 0, timeSec: 180 }, nbIntervals),
      ),
      league,
    },
    expectedResult: {
      score:
        ((getPreciseDistance(from, intermediate1) +
          getPreciseDistance(intermediate1, intermediate2) +
          getPreciseDistance(intermediate2, to)) /
          1000) *
        freeDistanceMultiplier(league),
      optimal: true,
    },
  };
}

export function freeDistance3PointsFixture(
  from: LatLon,
  intermediate1: LatLon,
  intermediate2: LatLon,
  intermediate3: LatLon,
  to: LatLon,
  nbIntervals: number,
  league: LeagueCode,
): OptimizerFixture {
  return {
    givenRequest: {
      track: concatTracks(
        splitSegment({ ...from, alt: 0, timeSec: 0 }, { ...intermediate1, alt: 0, timeSec: 60 }, nbIntervals),
        splitSegment(
          { ...intermediate1, alt: 0, timeSec: 60 },
          { ...intermediate2, alt: 0, timeSec: 120 },
          nbIntervals,
        ),
        splitSegment(
          { ...intermediate2, alt: 0, timeSec: 120 },
          { ...intermediate3, alt: 0, timeSec: 180 },
          nbIntervals,
        ),
        splitSegment({ ...intermediate3, alt: 0, timeSec: 180 }, { ...to, alt: 0, timeSec: 240 }, nbIntervals),
      ),
      league,
    },
    expectedResult: {
      score:
        ((getPreciseDistance(from, intermediate1) +
          getPreciseDistance(intermediate1, intermediate2) +
          getPreciseDistance(intermediate2, intermediate3) +
          getPreciseDistance(intermediate3, to)) /
          1000) *
        freeDistanceMultiplier(league),
      optimal: true,
    },
  };
}

export function closedFlatTriangleFixture(
  start: LatLon,
  p1: LatLon,
  p2: LatLon,
  nbIntervals: number,
  league: LeagueCode,
): OptimizerFixture {
  if (isFAI(start, p1, p2)) {
    throw new Error('invalid test data: not a flat triangle');
  }
  const multiplier = flatTriangleMultiplier(league);
  return triangleFixture(start, p1, p2, nbIntervals, league, multiplier);
}

export function closedFaiTriangleFixture(
  start: LatLon,
  p1: LatLon,
  nbIntervals: number,
  league: LeagueCode,
): OptimizerFixture {
  const distance1 = getPreciseDistance(start, p1);
  const bearingStartToP1 = getGreatCircleBearing(start, p1);
  const equilateralPoint = computeDestinationPoint(start, distance1, bearingStartToP1 - 60);
  const p2 = { lat: equilateralPoint.latitude, lon: equilateralPoint.longitude };
  if (!isFAI(start, p1, p2)) {
    throw new Error('invalid test data: not a FAI triangle');
  }
  const multiplier = faiTriangleMultiplier(league);
  return triangleFixture(start, p1, p2, nbIntervals, league, multiplier);
}

export function closedFaiTriangleFixtureWithSmallCycle(
  start: LatLon,
  p1: LatLon,
  nbIntervals: number,
  league: LeagueCode,
):OptimizerFixture {
  const standardFixture = closedFaiTriangleFixture(start,p1,nbIntervals,league);
  return {
    givenRequest: {
      ...standardFixture.givenRequest,
      options: {
        maxCycle: 1,
      },
    },
    expectedResult: standardFixture.expectedResult,
  };
}

export function closedFaiTriangleFixtureWithSmallLoop(
  start: LatLon,
  p1: LatLon,
  nbIntervals: number,
  league: LeagueCode,
):OptimizerFixture {
  const standardFixture = closedFaiTriangleFixture(start,p1,nbIntervals,league);
  return {
    givenRequest: {
      ...standardFixture.givenRequest,
      options: {
        maxLoop: 10,
      },
    },
    expectedResult: standardFixture.expectedResult,
  };
}

function freeDistanceMultiplier(league: LeagueCode) {
  switch (league) {
    case LeagueCode.CZO:
      return 0.8;
    case LeagueCode.LEO:
      return 1.5;
    default:
      return 1;
  }
}

function flatTriangleMultiplier(league: LeagueCode) {
  switch (league) {
    case LeagueCode.LEO:
      return 1.75;
    case LeagueCode.XContest:
      return 1.4;
    case LeagueCode.NOR:
      return 1.7;
    case LeagueCode.UKC:
      return 1.7;
    case LeagueCode.UKN:
      return 1.7;
    case LeagueCode.XCPPG:
      return 2;
    case LeagueCode.WXC:
      return 1.75;
    default:
      return 1.2;
  }
}

function faiTriangleMultiplier(league: LeagueCode) {
  switch (league) {
    case LeagueCode.LEO:
      return 2;
    case LeagueCode.XContest:
      return 1.6;
    case LeagueCode.NOR:
      return 2.4;
    case LeagueCode.UKC:
      return 2;
    case LeagueCode.UKI:
      return 1.5;
    case LeagueCode.UKN:
      return 2;
    case LeagueCode.XCPPG:
      return 4;
    case LeagueCode.WXC:
      return 2;
    default:
      return 1.4;
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

function triangleFixture(
  start: LatLon,
  p1: LatLon,
  p2: { lon: number; lat: number },
  nbIntervals: number,
  league: LeagueCode,
  multiplier: number,
) {
  const distance1 = getPreciseDistance(start, p1);
  const distance2 = getPreciseDistance(p1, p2);
  const distance3 = getPreciseDistance(p2, start);
  const expectedScore = ((distance1 + distance2 + distance3) * multiplier) / 1000;
  return {
    givenRequest: {
      track: concatTracks(
        splitSegment({ ...start, alt: 0, timeSec: 0 }, { ...p1, alt: 0, timeSec: 60 }, nbIntervals),
        splitSegment({ ...p1, alt: 0, timeSec: 60 }, { ...p2, alt: 0, timeSec: 120 }, nbIntervals),
        splitSegment({ ...p2, alt: 0, timeSec: 120 }, { ...start, alt: 0, timeSec: 180 }, nbIntervals),
      ),
      league,
    },
    expectedResult: {
      score: expectedScore,
      optimal: true,
    },
  };
}
