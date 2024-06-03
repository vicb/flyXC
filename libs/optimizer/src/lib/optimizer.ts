// TODO: all console logs are commented out. In the future, we should use a logging library

import type { Point, Solution } from 'igc-xc-score';
import { solver } from 'igc-xc-score';
import type { BRecord, IGCFile } from 'igc-parser';
import type { ScoringRuleName } from './scoring-rules';
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

export enum CircuitType {
  OpenDistance = 'Open distance',
  FlatTriangle = 'Flat triangle',
  FaiTriangle = 'Fai triangle',
  OutAndReturn = 'Out and return',
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
  circuit?: CircuitType;
  // If applicable, Distance in m for closing the circuit
  closingRadiusM?: number;
  // Indices of solutions points in the request
  solutionIndices: number[];
  // Whether the result is optimal.
  //If not the optimizer can be cycled again to get a more accurate solution.
  optimal: boolean;
  startPoint?: LatLon;
  endPoint?: LatLon;
  legs: Leg[];
  turnpoints: LatLon[];
}

/**
 * Returns an iterative optimizer computing the score for the flight.
 *
 * At each iteration, the score should be a better solutions.
 *
 * @see README.md
 *
 * @param request Contains the tracks and options.
 * @param ruleName The ScoringRules to use.
 * @returns an Iterator of OptimizationResult
 */
export function* getOptimizer(request: ScoringRequest): Iterator<ScoringResult, ScoringResult> {
  if (request.track.points.length === 0) {
    // console.warn('Empty track received in optimization request. Returns a 0 score');
    return {
      score: 0,
      lengthKm: 0,
      multiplier: 0,
      solutionIndices: [],
      optimal: true,
      legs: [],
      turnpoints: [],
    };
  }
  const { track } = request;
  const flight = toIgcFile(appendPointsIfNeeded(track, MIN_IGC_XC_SCORE_POINTS));
  const solverScoringRules = scoringRules.get(request.ruleName);
  if (solverScoringRules == null) {
    throw new Error(`Unknown scoring rule: ${request.ruleName}`);
  }
  const options = toSolverOptions(request);
  const solutionIterator = solver(flight, solverScoringRules, options);
  while (true) {
    const solution = solutionIterator.next();
    if (solution.done) {
      // console.debug('solution', JSON.stringify(solution.value, undefined, 2));
      return toOptimizationResult(solution.value, track);
    }
    yield toOptimizationResult(solution.value, track);
  }
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

  // console.debug(`The track is too short, appending (${MIN_IGC_XC_SCORE_POINTS - track.points.length}) points`);
  while (track.points.length < minValidLength) {
    const lastPoint = track.points.at(-1)!;
    track.points.push({
      ...lastPoint,
      lat: lastPoint.lat + 0.000001,
      timeSec: lastPoint.timeSec + 60,
    });
  }
  // console.debug(`new track has ${newTrack.points.length} points`);
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
  return {
    score: solution.score ?? 0,
    lengthKm: solution.scoreInfo?.distance ?? 0,
    multiplier: solution.opt.scoring.multiplier,
    circuit: toCircuitType(solution.opt.scoring.code),
    closingRadiusM: getClosingRadiusM(solution),
    solutionIndices: getSolutionIndices(solution, track),
    optimal: solution.optimal || false,
    startPoint: solution.scoreInfo?.ep?.start ? pointToLatTon(solution.scoreInfo?.ep?.start) : undefined,
    endPoint: solution.scoreInfo?.ep?.finish ? pointToLatTon(solution.scoreInfo?.ep?.finish) : undefined,
    legs: (solution.scoreInfo?.legs ?? []).map(({ name, d, start, finish }) => ({
      name,
      lengthKm: d,
      start: pointToLatTon(start),
      end: pointToLatTon(finish),
    })),
    turnpoints: (solution.scoreInfo?.tp ?? []).map((point) => pointToLatTon(point)),
  };
}

function pointToLatTon(point: Point): LatLon {
  return { lat: point.y, lon: point.x };
}

function getClosingRadiusM(solution: Solution): number | undefined {
  const closingDistance = solution.scoreInfo?.cp?.d;

  if (closingDistance == null) {
    return undefined;
  }

  // TODO: remove cast when https://github.com/mmomtchev/igc-xc-score/pull/233 is merged
  const closingDistanceFixed = (solution.opt.scoring as any)?.closingDistanceFixed;

  if (closingDistanceFixed != null && closingDistance < closingDistanceFixed) {
    return closingDistanceFixed * 1000;
  }

  // TODO: remove cast when https://github.com/mmomtchev/igc-xc-score/pull/233 is merged
  const closingDistanceRelativeRatio = (solution.opt.scoring as any)?.closingDistanceRelative;
  const closingDistanceRelative =
    solution.scoreInfo?.distance != null && closingDistanceRelativeRatio != null
      ? closingDistanceRelativeRatio * solution.scoreInfo.distance
      : undefined;

  if (closingDistanceRelative != null && closingDistance < closingDistanceRelative) {
    return closingDistanceRelative;
  }

  return undefined;
}

const circuitMapping = {
  od: CircuitType.OpenDistance,
  tri: CircuitType.FlatTriangle,
  fai: CircuitType.FaiTriangle,
  oar: CircuitType.OutAndReturn,
};

function toCircuitType(code: string): CircuitType {
  const type = circuitMapping[code as 'od' | 'tri' | 'fai' | 'oar'];
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
