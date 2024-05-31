// TODO: all console logs are commented out. In the future, we should use a logging library

import { solver, Solution } from 'igc-xc-score';
import { BRecord, IGCFile } from 'igc-parser';
import { ScoringRuleNames, scoringRules } from './scoring-rules';

// Minimum number of points in an igc-xc-score track.
// See this issue https://github.com/mmomtchev/igc-xc-score/issues/231
const MIN_IGC_XC_SCORE_POINTS = 5;

export interface LatLonAltTime {
  alt: number;
  lat: number;
  lon: number;
  /**
   * TODO: make this an absolute time, remove the start time
   * Time relative to the start of the track.
   */
  offsetFromStartSec: number;
}

export interface ScoringTrack {
  points: LatLonAltTime[];
  /**
   * Timestamp of the start of the track.
   */
  startTimeSec: number;
}

export interface OptimizationRequest {
  track: ScoringTrack;
  /**
   * Maximum duration for an optimization round trip.
   * If undefined, calculation duration is unbounded.
   */
  maxCycleDurationMs?: number;
  /**
   * Maximum number of iterations allowed for an optimization round trip.
   * If undefined, number of allowed iterations is unbounded
   */
  maxNumCycles?: number;
}

export enum CircuitType {
  OpenDistance = 'Open distance',
  FlatTriangle = 'Flat triangle',
  FaiTriangle = 'Fai triangle',
  OutAndReturn = 'Out and return',
}

export interface OptimizationResult {
  /**
   * The score for the track in the given league
   */
  score: number;
  /**
   * The length of the optimized track in kms
   */
  lengthKm: number;
  /**
   * TODO: we probably do not need all 3 of score, lengthKm, and multiplier.
   * Multiplier for computing score. score = lengthKm * multiplier
   */
  multiplier: number;
  /**
   * Type of the optimized track
   */
  circuit?: CircuitType;
  /**
   * If applicable, Distance in m for closing the circuit
   */
  closingRadiusM?: number;
  /**
   * Indices of solutions points in the request
   */
  solutionIndices: number[];
  /**
   * Whether the result is optimal.
   * If not the optimizer can be cycled again to get a more accurate solution.
   */
  optimal: boolean;
}

/**
 * Returns an iterative optimizer computing the score for the flight.
 *
 * At each iteration, the score should be a better solutions.
 *
 * @see README.md
 *
 * @param request Contains the tracks and options.
 * @param rules The ScoringRules to use.
 * @return an Iterator of OptimizationResult
 */
export function* getOptimizer(
  request: OptimizationRequest,
  rules: ScoringRuleNames,
): Iterator<OptimizationResult, OptimizationResult> {
  if (request.track.points.length == 0) {
    // console.warn('Empty track received in optimization request. Returns a 0 score');
    return {
      score: 0,
      lengthKm: 0,
      multiplier: 0,
      solutionIndices: [],
      optimal: true,
    };
  }
  const originalTrack = request.track;
  const solverTrack = appendPointsIfNeeded(originalTrack, MIN_IGC_XC_SCORE_POINTS);
  const flight = toIgcFile(solverTrack);
  const solverScoringRules = scoringRules.get(rules);
  const options = toSolverOptions(request);
  const solutionIterator = solver(flight, solverScoringRules || {}, options);
  while (true) {
    const solution = solutionIterator.next();
    if (solution.done) {
      // console.debug('solution', JSON.stringify(solution.value, undefined, 2));
      return toOptimizationResult(solution.value, originalTrack);
    }
    yield toOptimizationResult(solution.value, originalTrack);
  }
}

/**
 * Append points if the track is too short for igc-xc-score.
 *
 * The points are close enough to the last point to not affect the score.
 */
function appendPointsIfNeeded(track: ScoringTrack, minValidLength: number) {
  if (track.points.length >= minValidLength) {
    return track;
  }

  // console.debug(`The track is too short, appending (${MIN_IGC_XC_SCORE_POINTS - track.points.length}) points`);

  track = JSON.parse(JSON.stringify(track));
  while (track.points.length < minValidLength) {
    const lastPoint = track.points.at(-1)!;
    track.points.push({
      ...lastPoint,
      lat: lastPoint.lat + 0.000001,
      offsetFromStartSec: lastPoint.offsetFromStartSec + 60,
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
  const fixes = track.points.map((point): BRecord => {
    const timeMilliseconds = point.offsetFromStartSec * 1000;
    return {
      timestamp: timeMilliseconds,
      time: new Date(timeMilliseconds).toISOString(),
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
    date: new Date(track.startTimeSec * 1000).toISOString(),
    fixes: fixes,
  } as any;
}

function toSolverOptions(request: OptimizationRequest) {
  // TODO: upstream the type to igc-xc-score
  return {
    maxcycle: request.maxCycleDurationMs,
    maxloop: request.maxNumCycles,
  };
}

function toOptimizationResult(solution: Solution, originalTrack: ScoringTrack): OptimizationResult {
  return {
    score: solution.score ?? 0,
    lengthKm: solution.scoreInfo?.distance ?? 0,
    multiplier: solution.opt.scoring.multiplier,
    circuit: toCircuitType(solution.opt.scoring.code),
    closingRadiusM: getClosingRadiusM(solution),
    solutionIndices: getSolutionIndices(solution, originalTrack),
    optimal: solution.optimal || false,
  };
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
