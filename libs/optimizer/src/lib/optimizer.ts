import { Solution, solver } from 'igc-xc-score';
import { RuntimeTrack } from '@flyxc/common';
import { BRecord, IGCFile } from 'igc-parser';
import { splitSegment } from './utils/splitSegment';
import { concatTracks } from './utils/concatTracks';
import { LeagueCode, scoringRules } from './scoringRules';

// ScoringTrack is a subset of RuntimeTrack
// we define it for the sake of clarity and define the minimal information required to invoke the scoreTrack function
export type ScoringTrack = Pick<RuntimeTrack, 'lat' | 'lon' | 'alt' | 'timeSec' | 'minTimeSec'>;

export interface OptimizationRequest {
  track: ScoringTrack;
  league?: LeagueCode;
}

// minimalistic for the moment. Will be improved in next iterations
export interface OptimizationResult {
  score: number;
}

const ZERO_SCORE: OptimizationResult = {
  score: 0,
};

const MIN_POINTS = 5;

/**
 * computes the score for the flight
 * @param request
 */
export function optimize(request: OptimizationRequest): OptimizationResult {
  if (request.track.lat.length == 0) {
    console.warn('Empty track received in optimization request. Returns a 0 score');
    return ZERO_SCORE;
  }
  const track = addPointsIfRequired(request.track);
  const flight = toIgcFile(track);
  const scoringRules = toScoringRules(request.league);
  const solution = solver(flight, scoringRules).next();
  return toResult(solution.value);
}

const NB_INTERVAL_PER_SEGMENT = 2;

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
      segments.push(splitSegment(getPoint(i - 1), getPoint(i), NB_INTERVAL_PER_SEGMENT));
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
 * @param track: the source track
 */
function toIgcFile(track: ScoringTrack): IGCFile {
  const fixes = track.lat.map((lat, i) => {
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


function toResult(solution: Solution): OptimizationResult {
  return {
    score: solution.score,
  };
}

