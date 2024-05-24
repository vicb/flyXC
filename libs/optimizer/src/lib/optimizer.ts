import { Solution, solver } from 'igc-xc-score';
import { BRecord, IGCFile } from 'igc-parser';
import { createSegments } from './utils/createSegments';
import { concatTracks } from './utils/concatTracks';
import { ScoringRules, scoringRules } from './scoringRules';

// When the track has not enough points (<5), we build a new one by adding interpolated points between existing ones.
// This constant tunes the number of segments to build between two existing points.
const NUM_SEGMENTS_BETWEEN_POINTS = 2;

/**
 * lat: array of latitudes
 * lon: array of longitudes
 * alt: array of altitudes
 * timeSec: array of time in seconds elapsed since the beginning of the track
 */
export type LatLonAltTime = { alt: number; lat: number; lon: number; timeSec: number };

/**
 * points: the points that describe the track
 * minTimeSec: beginning of the track (seconds elapsed since 01-01-1970T00:00:00.000)
 */
export interface ScoringTrack {
  points: LatLonAltTime[];
  minTimeSec: number;
}

/**
 * maxCycleDurationMs: maximum duration in milliseconds for an optimization round trip. `
 *                     If undefined, calculation duration is unbounded.
 * maxNumCycles: maximum number of iterations allowed for an optimization round trip.
 *               If undefined, number of allowed iterations is unbounded
 */
export interface OptimizationOptions {
  maxCycleDurationMs?: number;
  maxNumCycles?: number;
}

/**
 * optimize function argument
 * track: the ScoringTrack to optimize
 * options: the OptimizationOptions for the computation
 */
export interface OptimizationRequest {
  track: ScoringTrack;
  options?: OptimizationOptions;
}

// minimalistic for the moment.
// TODO: to improve in next iterations
/**
 * score: the score for the track in the given league
 * optimal: the result is optimal (no need to get a next result of Iterator<OptimizationResult, OptimizationResult>)
 */
export interface OptimizationResult {
  score: number;
  optimal: boolean;
}

const ZERO_SCORE: OptimizationResult = {
  score: 0,
  optimal: true,
};

const MIN_POINTS = 5;

/**
 * computes the score for the flight
 * @param request the OptimizationRequest
 * @param league the LeagueCode of the league rules to follow
 * @return an Iterator over the successive OptimizationResult
 * @see README.md
 */
export function* optimize(request: OptimizationRequest, league: ScoringRules): Iterator<OptimizationResult, OptimizationResult> {
  if (request.track.points.length == 0) {
    console.warn('Empty track received in optimization request. Returns a 0 score');
    return ZERO_SCORE;
  }
  const track = buildValidTrackForSolver(request.track);
  const flight = toIgcFile(track);
  const scoringRules = toScoringRules(league);
  const options = toOptions(request.options);
  const solutionIterator = solver(flight, scoringRules, options);
  while (true) {
    const solution = solutionIterator.next();
    if (solution.done) {
      console.debug(solution.value.processed, 'iterations');
      return toResult(solution.value);
    }
    yield toResult(solution.value);
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
  let newTrack: ScoringTrack = track;
  while (newTrack.points.length < MIN_POINTS) {
    const segments: ScoringTrack[] = [];
    for (let i = 1; i < newTrack.points.length; i++) {
      // split each segment of the track into two segments
      segments.push(
        createSegments(newTrack.points[i - 1], newTrack.points[i], track.minTimeSec, NUM_SEGMENTS_BETWEEN_POINTS),
      );
    }
    newTrack = concatTracks(...segments);
  }
  return newTrack;
}


/**
 * build a fake igc file from a track, so that the solver can use it
 * @param track the source track
 */
function toIgcFile(track: ScoringTrack): IGCFile {
  const fixes = track.points.map(point => {
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
    } as BRecord;
  });
  // we ignore some properties of the igc-file, as they are not required for the computation
  // @ts-ignore
  return {
    date: new Date(track.minTimeSec * 1000).toISOString(),
    fixes: fixes,
  };
}

function toScoringRules(league: ScoringRules) {
    return scoringRules.get(league);
}

type SolverOptions = { maxloop?: number; maxcycle?: number };

function toOptions(options?: OptimizationOptions): SolverOptions {
  return {
    maxcycle: options?.maxCycleDurationMs,
    maxloop: options?.maxNumCycles,
  };
}

function toResult(solution: Solution): OptimizationResult {
  return {
    score: solution.score,
    optimal: solution.optimal,
  };
}
