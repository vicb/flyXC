import { Solution, solver } from 'igc-xc-score';
import { BRecord, IGCFile } from 'igc-parser';
import { createSegments } from './utils/createSegments';
import { mergeTracks } from './utils/mergeTracks';
import { ScoringRules, scoringRules } from './scoringRules';
import { getDistance } from 'geolib';

// When the track has not enough points (<5), we build a new one by adding interpolated points between existing ones.
// See this issue https://github.com/mmomtchev/igc-xc-score/issues/231
const MIN_POINTS = 5;
const NUM_SEGMENTS_BETWEEN_POINTS = 2;

// For adding interpolated points, this constant adjusts the proximity of the points to the starting point of
// the segment. We want the added points to be very close to the starting points of the segment so that the solution
// points returned by the solver are as close as possible (or may be equal) to one of the original points of the track.
const DISTRIBUTION_FACTOR_FOR_ADDED_POINTS = 1e-5;

// TODO: all console.xxx statements are commented. In the future, we should use a logging library

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
 * @param request the OptimizationRequest. if request.options is undefined, then there will be one iteration, and the result
 *                will be the best solution
 * @param rules the ScoringRules to apply for computation
 * @return an Iterator of OptimizationResult
 * @see README.md
 */
export function* getOptimizer(
  request: OptimizationRequest,
  rules: ScoringRules,
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
  const solverTrack = buildValidTrackForSolver(originalTrack);
  const flight = toIgcFile(solverTrack);
  const solverScoringRules = scoringRules.get(rules);
  const options = toSolverOptions(request.options);
  const solutionIterator = solver(flight, solverScoringRules || {}, options);
  while (true) {
    const solution = solutionIterator.next();
    if (solution.done) {
      // console.debug('solution', JSON.stringify(solution.value, undefined, 2));
      return toOptimizationResult(solution.value, originalTrack, solverTrack);
    }
    yield toOptimizationResult(solution.value, originalTrack, solverTrack);
  }
}

/**
 * the solver requires at least 5 points, so if there is not enough points,
 * we create points between existing ones
 */
function buildValidTrackForSolver(track: ScoringTrack) {
  if (track.points.length >= MIN_POINTS) {
    return track;
  }
  // console.debug(`not enough points (${track.points.length}) in track. Interpolate intermediate points`);
  track = deepCopy(track);
  while (track.points.length < MIN_POINTS) {
    const segments: ScoringTrack[] = [];
    for (let i = 1; i < track.points.length; i++) {
      // split each segment of the track into two segments
      segments.push(
        createSegments(
          track.points[i - 1],
          track.points[i],
          track.startTimeSec,
          NUM_SEGMENTS_BETWEEN_POINTS,
          DISTRIBUTION_FACTOR_FOR_ADDED_POINTS,
        ),
      );
    }
    track = mergeTracks(...segments);
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
  // we ignore some properties of the igc-file, as they are not required for the computation
  // @ts-ignore
  return {
    date: new Date(track.startTimeSec * 1000).toISOString(),
    fixes: fixes,
  };
}

type SolverOptions = { maxloop?: number; maxcycle?: number };

function toSolverOptions(request: OptimizationRequest): SolverOptions {
  return {
    maxcycle: request.maxCycleDurationMs,
    maxloop: request.maxNumCycles,
  };
}

function toOptimizationResult(
  solution: Solution,
  originalTrack: ScoringTrack,
  solverTrack: ScoringTrack,
): OptimizationResult {
  return {
    score: solution.score ?? 0,
    lengthKm: solution.scoreInfo?.distance ?? 0,
    multiplier: solution.opt.scoring.multiplier,
    circuit: toCircuitType(solution.opt.scoring.code),
    closingRadiusM: getClosingRadiusM(solution),
    solutionIndices: getIndices(solution, originalTrack, solverTrack),
    optimal: solution.optimal || false,
  };
}

// TODO: submit a PR to igc-xc-score
interface Scoring {
  closingDistanceFixed?: number;
  closingDistanceRelative?: number;
}

function getClosingRadiusM(solution: Solution): number | undefined {
  const closingDistance = solution.scoreInfo?.cp?.d;

  if (closingDistance == null) {
    return undefined;
  }

  const closingDistanceFixed = solution.opt.scoring?.closingDistanceFixed;

  if (closingDistanceFixed != null && closingDistance < closingDistanceFixed) {
    return closingDistanceFixed;
  }

  const closingDistanceRelativeRatio = solution.opt.scoring?.closingDistanceRelative;
  const closingDistanceRelative =
    solution.scoreInfo?.distance != null && closingDistanceRelativeRatio != null
      ? closingDistanceRelativeRatio * solution.scoreInfo.distance
      : undefined;

  if (closingDistanceRelative != null && closingDistance < closingDistanceRelative) {
    return closingDistanceRelative;
  }

  return undefined;
}

const circuitTypeCodes = ['od', 'tri', 'fai', 'oar'];
type CircuitTypeCode = (typeof circuitTypeCodes)[number];

const circuitMapping = {
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
 * Return the indices of the solution points.
 *
 * This permit to identify the solution points in the ScoringTrack.points array
 *
 * It contains (when applicable):
 * - the starting point
 * - the 'in' closing point
 * - the turn points
 * - the 'out' closing point
 * - the end point
 * */
function getIndices(solution: Solution, originalTrack: ScoringTrack, solverTrack: ScoringTrack) {
  const result: number[] = [];
  pushInResult(getEntryPointsStartIndex(solution, originalTrack, solverTrack));
  pushInResult(getClosingPointsInIndex(solution, originalTrack, solverTrack));
  solution.scoreInfo?.tp
    ?.map((turnPoint) => turnPoint.r)
    .forEach((index) => pushInResult(getPointIndex(index, originalTrack, solverTrack)));
  pushInResult(getClosingPointsOutIndex(solution, originalTrack, solverTrack));
  pushInResult(getEntryPointsFinishIndex(solution, originalTrack, solverTrack));
  return result;

  function pushInResult(index: number) {
    if (index >= 0) {
      result.push(index);
    }
  }
}

function getEntryPointsStartIndex(solution: Solution, originalTrack: ScoringTrack, solverTrack: ScoringTrack): number {
  // console.debug('getEntryPointsStartIndex', solution.scoreInfo?.ep?.start.r);
  return getPointIndex(solution.scoreInfo?.ep?.start.r, originalTrack, solverTrack);
}

function getClosingPointsInIndex(solution: Solution, originalTrack: ScoringTrack, solverTrack: ScoringTrack): number {
  // console.debug('getClosingPointsInIndex', solution.scoreInfo?.cp?.in.r);
  return getPointIndex(solution.scoreInfo?.cp?.in.r, originalTrack, solverTrack);
}

function getClosingPointsOutIndex(solution: Solution, originalTrack: ScoringTrack, solverTrack: ScoringTrack): number {
  // console.debug('getClosingPointsOutIndex', solution.scoreInfo?.cp?.out.r);
  return getPointIndex(solution.scoreInfo?.cp?.out.r, originalTrack, solverTrack);
}

function getEntryPointsFinishIndex(solution: Solution, originalTrack: ScoringTrack, solverTrack: ScoringTrack): number {
  // console.debug('getEntryPointsFinishIndex', solution.scoreInfo?.ep?.finish.r);
  return getPointIndex(solution.scoreInfo?.ep?.finish.r, originalTrack, solverTrack);
}

function getPointIndex(index: number | undefined, originalTrack: ScoringTrack, solverTrack: ScoringTrack): number {
  if (index === undefined) {
    return -1;
  }
  return solutionContainsValidIndices(originalTrack, solverTrack)
    ? index
    : getIndexInOriginalTrack(index, originalTrack, solverTrack);
}

function solutionContainsValidIndices(originalTrack: ScoringTrack, solverTrack: ScoringTrack): boolean {
  return originalTrack.points.length === solverTrack.points.length;
}

function getIndexInOriginalTrack(index: number, originalTrack: ScoringTrack, solverTrack: ScoringTrack): number {
  const solutionPoint = solverTrack.points[index];
  let indexInOriginalTrack = -1;
  let closestDistance = Number.MAX_VALUE;
  for (let i = 0; i < originalTrack.points.length; i++) {
    const point = originalTrack.points[i];
    const distance = getDistance(point, solutionPoint);
    if (distance < closestDistance) {
      closestDistance = distance;
      indexInOriginalTrack = i;
    }
  }
  return indexInOriginalTrack;
}

// Not the most performant solution but is used only for slow dimension problems
function deepCopy<T>(source: T): T {
  return JSON.parse(JSON.stringify(source));
}
