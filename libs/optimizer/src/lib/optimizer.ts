import type { BRecord, IGCFile } from 'igc-parser';
import type { Point, Solution } from 'igc-xc-score';
import { solver } from 'igc-xc-score';

import type { ScoringRuleName } from './api';
import { CircuitType } from './api';
import { scoringRules } from './scoring-rules';

// Minimum number of points in an igc-xc-score track.
// See this issue https://github.com/mmomtchev/igc-xc-score/issues/231
const MIN_IGC_XC_SCORE_POINTS = 5;

export interface LatLon {
  lat: number;
  lon: number;
}

export interface LatLonAltTime extends LatLon {
  alt: number;
  timeSec: number;
}

export interface ScoringTrack {
  points: LatLonAltTime[];
}

export interface ScoringRequest {
  track: ScoringTrack;
  ruleName: ScoringRuleName;
  /** Maximum cycle duration. Unbounded when not provided */
  maxCycleDurationMs?: number;
  /** Maximum number of cycles. Unbounded when not provided */
  maxNumCycles?: number;
}

export interface Leg {
  name: string;
  lengthKm: number;
  start: LatLon;
  end: LatLon;
}
export interface ScoringResult {
  // The score for the track in the given league
  score: number;
  // The length of the optimized track in kms
  lengthKm: number;
  // Multiplier for computing score. score = lengthKm * multiplier
  multiplier: number;
  circuit: CircuitType;
  closingRadiusKm?: number;
  // Indices of solutions points in the request
  solutionIndices: number[];
  // Whether the result is optimal.
  //If not the optimizer can be cycled again to get a more accurate solution.
  optimal: boolean;
  startPoint?: LatLon;
  endPoint?: LatLon;
  legs: Leg[];
  turnpoints: LatLon[];
  closingPoints?: {
    in: LatLon;
    out: LatLon;
  };
  // optimized path
  path: LatLon[];
}

/**
 * Returns an iterative optimizer computing the score for the flight.
 *
 * At each iteration, the score should be a better solutions.
 *
 * @see README.md
 *
 * @param request Contains the tracks and options.
 * @returns an Iterator of OptimizationResult
 */
export function* getOptimizer(request: ScoringRequest): Iterator<ScoringResult, ScoringResult> {
  if (request.track.points.length === 0) {
    return {
      score: 0,
      lengthKm: 0,
      multiplier: 0,
      circuit: CircuitType.OpenDistance,
      solutionIndices: [],
      optimal: true,
      legs: [],
      turnpoints: [],
      path: [],
    };
  }
  const { track } = request;
  const flight = toIgcFile(appendPointsIfNeeded(track, MIN_IGC_XC_SCORE_POINTS));
  const solverScoringRules = scoringRules.get(request.ruleName);
  if (solverScoringRules === undefined) {
    return toOptimizationResult(toUnoptimizedSolution(track), track);
  }
  const options = toSolverOptions(request);
  const solutionIterator = solver(flight, solverScoringRules, options);
  while (true) {
    const solution = solutionIterator.next();
    if (solution.done) {
      return toOptimizationResult(solution.value, track);
    }
    yield toOptimizationResult(solution.value, track);
  }
}

function toUnoptimizedSolution(track: ScoringTrack): Solution {
  const tp: Point[] = [];
  let distance = 0;
  for (let i = 1; i < track.points.length - 1; i++) {
    tp.push(trackToPoint(track.points, i));
  }
  for (let i = 1; i < track.points.length; i++) {
    const from = track.points[i - 1];
    const to = track.points[i];
    distance += distanceEarthFCC(from, to);
  }

  return {
    scoreInfo: {
      ep: {
        start: trackToPoint(track.points, 0),
        finish: trackToPoint(track.points, track.points.length - 1),
      },
      tp,
      distance,
      penalty: 0,
      score: distance,
    },
    opt: {
      launch: 0,
      landing: track.points.length - 1,
      scoring: {
        name: '',
        code: 'od',
        multiplier: 1,
      },
      flight: undefined as any,
      config: {},
    },
    optimal: true,
    id: 0,
    bound: 0,
    currentUpperBound: 0,
  };
}

/**
 * Append points if the track is too short for igc-xc-score.
 *
 * The points are close enough to the last point to not affect the score.
 */
function appendPointsIfNeeded(track: ScoringTrack, minValidLength: number) {
  track = structuredClone(track);

  if (track.points.length >= minValidLength) {
    return track;
  }

  while (track.points.length < minValidLength) {
    const lastPoint = track.points.at(-1)!;
    track.points.push({
      ...lastPoint,
      lat: lastPoint.lat + 0.000001,
      timeSec: lastPoint.timeSec + 60,
    });
  }

  return track;
}

/**
 * create an igc file from a track
 * @param track the source track
 */
function toIgcFile(track: ScoringTrack): IGCFile {
  if (track.points.length == 0) {
    throw new Error('Empty track');
  }

  const fixes = track.points.map((point): BRecord => {
    const timeMilliSec = point.timeSec * 1000;
    return {
      timestamp: timeMilliSec,
      time: new Date(timeMilliSec).toISOString(),
      latitude: point.lat,
      longitude: point.lon,
      valid: true,
      pressureAltitude: null,
      gpsAltitude: point.alt,
      extensions: {},
      fixAccuracy: null,
      enl: null,
    };
  });

  // Only fill out the fields required by igc-xc-score.
  return {
    date: new Date(track.points[0].timeSec * 1000).toISOString(),
    fixes,
  } as any;
}

function toSolverOptions(request: ScoringRequest) {
  // TODO: upstream the type to igc-xc-score
  return {
    maxcycle: request.maxCycleDurationMs,
    maxloop: request.maxNumCycles,
  };
}

function toOptimizationResult(solution: Solution, track: ScoringTrack): ScoringResult {
  const startPoint = solution.scoreInfo?.ep?.start ? pointToLatTon(solution.scoreInfo?.ep?.start) : undefined;
  const endPoint = solution.scoreInfo?.ep?.finish ? pointToLatTon(solution.scoreInfo?.ep?.finish) : undefined;
  const closingPoints = solution.scoreInfo?.cp
    ? {
        in: pointToLatTon(solution.scoreInfo.cp.in),
        out: pointToLatTon(solution.scoreInfo.cp.out),
      }
    : undefined;
  const turnpoints = (solution.scoreInfo?.tp ?? []).map((point) => pointToLatTon(point));
  return {
    score: solution.score ?? 0,
    lengthKm: solution.scoreInfo?.distance ?? 0,
    multiplier: solution.opt.scoring.multiplier,
    circuit: toCircuitType(solution.opt.scoring.code),
    closingRadiusKm: getClosingRadiusKm(solution),
    solutionIndices: getSolutionIndices(solution, track),
    optimal: solution.optimal || false,
    startPoint,
    endPoint,
    legs: (solution.scoreInfo?.legs ?? []).map(({ name, d, start, finish }) => ({
      name,
      lengthKm: d,
      start: pointToLatTon(start),
      end: pointToLatTon(finish),
    })),
    turnpoints,
    closingPoints,
    path: [closingPoints?.in, startPoint, ...turnpoints, endPoint, closingPoints?.out].filter((p) => p != null),
  };
}

function pointToLatTon(point: Point): LatLon {
  return { lat: point.y, lon: point.x };
}

function trackToPoint(track: LatLon[], index: number): Point {
  const latLon = track[index];
  return { x: latLon.lon, y: latLon.lat, r: index };
}

function getClosingRadiusKm(solution: Solution): number | undefined {
  const closingDistance = solution.scoreInfo?.cp?.d;

  if (closingDistance == null) {
    return undefined;
  }

  const closingDistanceFixed = solution.opt.scoring.closingDistanceFixed;

  if (closingDistanceFixed != null && closingDistance < closingDistanceFixed) {
    return closingDistanceFixed;
  }

  const closingDistanceRelativeRatio = solution.opt.scoring.closingDistanceRelative;
  const closingDistanceRelative =
    solution.scoreInfo?.distance != null && closingDistanceRelativeRatio != null
      ? closingDistanceRelativeRatio * solution.scoreInfo.distance
      : undefined;

  if (closingDistanceRelative != null && closingDistance < closingDistanceRelative) {
    return closingDistanceRelative;
  }

  return undefined;
}

const circuitMapping: Readonly<Record<string, CircuitType>> = {
  od: CircuitType.OpenDistance,
  tri: CircuitType.FlatTriangle,
  fai: CircuitType.FaiTriangle,
  oar: CircuitType.OutAndReturn,
};

function toCircuitType(code: string): CircuitType {
  const type = circuitMapping[code];
  if (type == null) {
    throw new Error(`Unknown type "${code}"`);
  }
  return type;
}

/**
 * Return the indices of the solution in the input track.
 *
 * It contains (when applicable):
 * - the starting point
 * - the 'in' closing point
 * - the turn points
 * - the 'out' closing point
 * - the end point
 * */
function getSolutionIndices(solution: Solution, inputTrack: ScoringTrack): number[] {
  return (
    [
      solution.scoreInfo?.ep?.start.r,
      solution.scoreInfo?.cp?.in.r,
      ...(solution.scoreInfo?.tp ?? []).map((turnPoint) => turnPoint.r),
      solution.scoreInfo?.cp?.out.r,
      solution.scoreInfo?.ep?.finish.r,
    ]
      .filter((index) => index != null)
      // Map added dummy points back to the last point of the input track.
      .map((index) => Math.min(index!, inputTrack.points.length - 1))
  );
}

// https://github.com/mmomtchev/igc-xc-score/blob/da601fa5ade432c1e55808de5ad3336905ea6cf8/src/foundation.js#L48C1-L64C6
function distanceEarthFCC(p1: LatLon, p2: LatLon) {
  const df = p1.lat - p2.lat;
  const dg = p1.lon - p2.lon;
  const fmDegree = (p2.lat + p1.lat) / 2;
  const fm = fmDegree / (180 / Math.PI);
  // Speed up cos computation using:
  // - cos(2x) = 2 * cos(x)^2 - 1
  // - cos(a+b) = 2 * cos(a)cos(b) - cos(a-b)
  const cosfm = Math.cos(fm);
  const cos2fm = 2 * cosfm * cosfm - 1;
  const cos3fm = cosfm * (2 * cos2fm - 1);
  const cos4fm = 2 * cos2fm * cos2fm - 1;
  const cos5fm = 2 * cos2fm * cos3fm - cosfm;
  const k1 = 111.13209 - 0.566605 * cos2fm + 0.0012 * cos4fm;
  const k2 = 111.41513 * cosfm - 0.09455 * cos3fm + 0.00012 * cos5fm;
  return Math.sqrt(k1 * df * (k1 * df) + k2 * dg * (k2 * dg));
}
