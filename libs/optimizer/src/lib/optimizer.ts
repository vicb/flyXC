import { Solution, solver } from 'igc-xc-score';
import { BRecord, IGCFile } from 'igc-parser';
import { createSegments } from './utils/createSegments';
import { concatTracks } from './utils/concatTracks';
import { LeagueCode, scoringRules } from './scoringRules';

/**
 * lat: array of latitudes
 * lon: array of longitudes
 * alt: array of altitudes
 * timeSec: array of time in seconds elapsed since the beginning of the track
 * minTimeSec: beginning of the track (seconds elapsed since 01-01-1970T00:00:00.000)
 */
export interface ScoringTrack {
  lat: number[];
  lon: number[];
  alt: number[];
  timeSec: number[];
  minTimeSec: number;
}

/**
 * maxCycle: maximum duration in milliseconds for an optimization round trip. `
 *           If undefined, calculation duration is unbounded.
 * maxLoop: maximum number of iterations allowed for an optimization round trip.
 *          If undefined, number of allowed iterations is unbounded
 */
export interface OptimizationOptions {
  maxCycle?: number;
  maxLoop?: number;
}

/**
 * optimize function argument
 * track: the ScoringTrack to optimize
 * league: the LeagueCode of the leagues rules to follow. If undefined, defaults to LeagueCode.FFVL
 * options: the OptimizationOptions for the computation
 */
export interface OptimizationRequest {
  track: ScoringTrack;
  league?: LeagueCode;
  options?: OptimizationOptions;
}

// minimalistic for the moment. Will be improved in next iterations
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
 * @return an Iterator over the successive OptimizationResult
 * @see README.md
 */
export function* optimize(request: OptimizationRequest): Iterator<OptimizationResult, OptimizationResult> {
  if (request.track.lat.length == 0) {
    console.warn('Empty track received in optimization request. Returns a 0 score');
    return ZERO_SCORE;
  }
  const track = addPointsIfRequired(request.track);
  const flight = toIgcFile(track);
  const scoringRules = toScoringRules(request.league);
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

const NB_SEGMENTS_BETWEEN_POINTS = 2;

/**
 * the solver requires at least 5 points, so if there is not enough points,
 * we create points between existing ones
 */
function addPointsIfRequired(track: ScoringTrack) {
  if (track.lat.length >= MIN_POINTS) {
    return track;
  }
  let newTrack: ScoringTrack = track;
  while (newTrack.lat.length < MIN_POINTS) {
    const segments: ScoringTrack[] = [];
    for (let i = 1; i < newTrack.lat.length; i++) {
      // split each segment of the track into two segments
      segments.push(createSegments(getPoint(i - 1), getPoint(i), NB_SEGMENTS_BETWEEN_POINTS));
    }
    newTrack = concatTracks(...segments);
  }
  return newTrack;

  function getPoint(index: number) {
    return {
      lat: newTrack.lat[index],
      lon: newTrack.lon[index],
      alt: newTrack.alt[index],
      timeSec: newTrack.timeSec[index],
    };
  }
}


/**
 * build a fake igc file from a track, so that the solver can use it
 * @param track the source track
 */
function toIgcFile(track: ScoringTrack): IGCFile {
  const fixes = track.lat.map((_lat, i) => {
    const timeMilliseconds = track.timeSec[i] * 1000;
    return {
      timestamp: timeMilliseconds,
      time: new Date(timeMilliseconds).toISOString(),
      latitude: track.lat[i],
      longitude: track.lon[i],
      valid: true,
      pressureAltitude: null,
      gpsAltitude: track.alt[i],
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

function toScoringRules(league: LeagueCode) {
  if (league) {
    return scoringRules.get(league);
  }
  return scoringRules.get(LeagueCode.FFVL);
}

type SolverOptions = { maxloop?: number; maxcycle?: number };

function toOptions(options?: OptimizationOptions): SolverOptions {
  return {
    maxcycle: options?.maxCycle,
    maxloop: options?.maxLoop,
  };
}

function toResult(solution: Solution): OptimizationResult {
  return {
    score: solution.score,
    optimal: solution.optimal,
  };
}
