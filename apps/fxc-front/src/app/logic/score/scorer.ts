import { CircuitType, getOptimizer, ScoringRuleNames, ScoringTrack } from '@flyxc/optimizer';
import { LatLon } from '@flyxc/common';
import { LeagueCode } from './league/leagues';
import { getPathLength } from 'geolib';

export class Score {
  distanceM: number;
  indexes: number[];
  multiplier: number;
  circuit: CircuitType;
  closingRadiusM: number | null;
  points: number;

  constructor(score: Partial<Score>) {
    this.distanceM = score.distanceM ?? 0;
    this.indexes = score.indexes ?? [];
    this.multiplier = score.multiplier ?? 1;
    this.circuit = score.circuit ?? CircuitType.OpenDistance;
    this.closingRadiusM = score.closingRadiusM ?? null;
    this.points = score.points ?? 0;
  }
}

export type LatLonAndMaybeAltTime = LatLon & {
  alt?: number;
  timeSec?: number;
};

export function computeScore(points: LatLonAndMaybeAltTime[], league: string): Score {
  const track: ScoringTrack = {
    points: points.map((point, i) => {
      return {
        ...point,
        alt: point.alt ?? 0,
        offsetFromStartSec: point.timeSec ?? i * 60,
      };
    }),
    startTimeSec: new Date().getTime() / 1000,
  };
  const result = getOptimizer({ track }, getScoringRule(league)).next().value;
  return new Score({
    circuit: result.circuit,
    distanceM: result.lengthKm * 1000,
    multiplier: result.multiplier,
    closingRadiusM: result.closingRadiusM ? result.closingRadiusM * 1000 : null,
    indexes: result.solutionIndices,
    points: result.score,
  });
}

export function getSampledTrackLengthKm(points: (LatLon & { timeSec: number })[], sampleIntervalSec: number) {
  let nextSampleTime = points[0].timeSec + sampleIntervalSec;
  const samples = [points[0]];
  points.forEach((point) => {
    if (point.timeSec > nextSampleTime){
      nextSampleTime = nextSampleTime + sampleIntervalSec;
      samples.push(point);
    }
  });
  return getPathLength(samples)/1000;
}

function getScoringRule(league: string): ScoringRuleNames {
  switch (league as LeagueCode) {
    case 'czl':
      return 'CzechLocal';
    case 'cze':
      return 'CzechEuropean';
    case 'czo':
      return 'CzechOutsideEurope';
    case 'fr':
      return 'FederationFrancaiseVolLibre';
    case 'leo':
      return 'Leonardo';
    case 'nor':
      return 'Norway';
    case 'ukc':
      return 'UnitedKingdomClub';
    case 'uki':
      return 'UnitedKingdomInternational';
    case 'ukn':
      return 'UnitedKingdomNational';
    case 'xc':
      return 'XContest';
    case 'xcppg':
      return 'XContestPPG';
    case 'wxc':
      return 'WorldXC';
  }
  throw new Error(`no Scoring Rules for league ${league}`);
}
