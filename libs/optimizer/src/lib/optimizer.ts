import { Solution, solver } from 'igc-xc-score';
import { BRecord, IGCFile } from 'igc-parser';
import { createSegments } from './utils/createSegments';
import { mergeTracks } from './utils/mergeTracks';
import { ScoringRules, scoringRules } from './scoringRules';
import { getDistance } from 'geolib';

// When the track has not enough points (<5), we build a new one by adding interpolated points between existing ones.
// see this issue https://github.com/mmomtchev/igc-xc-score/issues/231
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
   * time in seconds elapsed since the beginning of the track (see ScoringTrack.startTimeSec)
   */
  timeSec: number;
}

export interface ScoringTrack {
  /**
   * the points that describe the track
   */
  points: LatLonAltTime[];
  /**
   * Timestamp in seconds
   * the "timeSec" values in LatLonAltTime's are offsets according to this timestamp.
   */
  startTimeSec: number;
}

export interface OptimizationOptions {
  /**
   * maximum duration in milliseconds for an optimization round trip.
   * If undefined, calculation duration is unbounded.
   */
  maxCycleDurationMs?: number;
  /**
   * maximum number of iterations allowed for an optimization round trip.
   * If undefined, number of allowed iterations is unbounded
   */
  maxNumCycles?: number;
}

/**
 * optimize function argument
 */
export interface OptimizationRequest {
  track: ScoringTrack;
  options?: OptimizationOptions;
}

export enum CircuitType {
  OpenDistance = 'Open distance',
  FlatTriangle = 'Flat triangle',
  FaiTriangle = 'Fai triangle',
  OutAndReturn = 'Out and return',
}

export interface OptimizationResult {
  /**
   * the score for the track in the given league
   */
  score: number;
  /**
   * the length of the optimized track in kms
   */
  lengthKm: number;
  /**
   * multiplier for computing score. score = lengthKm * multiplier
   */
  multiplier: number;
  /**
   * type of the optimized track
   */
  circuit?: CircuitType;
  /**
   * if applicable, distance in m for closing the circuit
   */
  closingRadius?: number;
  /**
   * indices of solutions points in ScoringTrack.points array
   */
  solutionIndices: number[];
  /**
   * the result is optimal (no need to get a next result of Iterator<OptimizationResult, OptimizationResult>)
   */
  optimal: boolean;
}

const ZERO_SCORE: OptimizationResult = {
  score: 0,
  lengthKm: 0,
  multiplier: 0,
  solutionIndices: [],
  optimal: true,
};

/**
 * returns an iterative optimizer that computes iteratively the score for the flight. At each iteration, the score
 * should be a better solutions.
 * @param request the OptimizationRequest. if request.options is undefined, then there will be one iteration, and the result
 *                will be the best solution
 * @param rules the ScoringRules to apply for computation
 * @return an Iterator over the successive OptimizationResult
 * @see README.md
 */
export function* getOptimizer(
  request: OptimizationRequest,
  rules: ScoringRules,
): Iterator<OptimizationResult, OptimizationResult> {
  if (request.track.points.length == 0) {
    // console.warn('Empty track received in optimization request. Returns a 0 score');
    return ZERO_SCORE;
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
    const timeMilliseconds = point.timeSec * 1000;
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

function toSolverOptions(options?: OptimizationOptions): SolverOptions {
  return {
    maxcycle: options?.maxCycleDurationMs,
    maxloop: options?.maxNumCycles,
  };
}

function toOptimizationResult(solution: Solution, originalTrack: ScoringTrack, solverTrack: ScoringTrack): OptimizationResult {
  return {
    score: solution.score ?? 0,
    lengthKm: solution.scoreInfo?.distance ?? 0,
    multiplier: solution.opt.scoring.multiplier,
    circuit: toCircuitType(solution.opt.scoring.code),
    closingRadius: getClosingRadius(solution),
    solutionIndices: getIndices(solution, originalTrack, solverTrack),
    optimal: solution.optimal || false,
  };
}

function getClosingRadius(solution: Solution) {
  // @ts-ignore : closingDistanceFixed is not exposed by library
  const closingDistanceFixed: number | undefined = solution.opt.scoring?.closingDistanceFixed;
  // @ts-ignore : closingDistanceRelative is not exposed by library
  const closingDistanceRelativeRatio: number | undefined = solution.opt.scoring?.closingDistanceRelative;
  const closingDistanceRelative =
    solution.scoreInfo?.distance && closingDistanceRelativeRatio
      ? closingDistanceRelativeRatio * solution.scoreInfo?.distance
      : undefined;
  const closingDistance = solution.scoreInfo?.cp?.d;
  if (closingDistance == null) {
    return undefined;
  }
  if (closingDistanceFixed != null && closingDistance < closingDistanceFixed) {
    return closingDistanceFixed;
  } else if (closingDistanceRelative != null && closingDistance < closingDistanceRelative) {
    return closingDistanceRelative;
  }
  return undefined;
}

const circuitTypeCodes = ['od' , 'tri' , 'fai' , 'oar']
type CircuitTypeCode = (typeof circuitTypeCodes)[number];

function toCircuitType(code: CircuitTypeCode) {
  switch (code) {
    case 'od':
      return CircuitType.OpenDistance;
    case 'fai':
      return CircuitType.FaiTriangle;
    case 'oar':
      return CircuitType.OutAndReturn;
    case 'tri':
      return CircuitType.FlatTriangle;
  }
  throw new Error(`no CircuitType found for ${code}`);
}

// return indices of solution points. This permit to identify the solution points in the ScoringTrack.points array
// it contains (when applicable):
// - the starting point
// - the 'in' closing point
// - the turn points
// - the 'out' closing point
// - the finish point
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
