import { Measure } from './measure';
import { Score } from './scorer';
import { ScoreAndRoute, scoreTrack, ScoringTrack } from './improvedScorer';
import { LatLon } from '@flyxc/common';

export abstract class League {
  abstract name: string;
  abstract code: LeagueCode;
  abstract score(measure: Measure): Score[];

  // An attempt for using the new scorer in League classes
  async scorePoints(latLons: LatLon[]): Promise<ScoreAndRoute | undefined> {
    return await scoreTrack(toTrack(latLons), this.code);
  }
}

export type LeagueCode = 'czl' | 'cze' | 'czo' | 'fr' | 'leo' | 'nor' | 'ukc' | 'uki' | 'ukn' | 'xc' | 'xcppg' | 'wxc';

function toTrack(latLons: LatLon[]): ScoringTrack {
  let copy = latLons.map((it) => it);
  while (copy.length < 6) {
    copy = doublePoints(copy);
  }
  const date = new Date();
  const minTimeSec = date.getSeconds();
  date.setSeconds(1);
  return {
    lat: copy.map((it) => it.lat),
    lon: copy.map((it) => it.lon),
    timeSec: copy.map((_value, index) => minTimeSec + index),
    minTimeSec: minTimeSec,
  };
}

function doublePoints(source: LatLon[]): LatLon[] {
  const result = [];
  for (let i = 0; i < source.length - 1; i++) {
    result.push(source[i]);
    result.push(middle(source[i], source[i + 1]));
  }
  result.push(source[source.length - 1]);
  return result;
}

function middle(p1: LatLon, p2: LatLon): LatLon {
  return {
    lat: (p1.lat + p2.lat) / 2,
    lon: (p1.lon + p2.lon) / 2,
  };
}
