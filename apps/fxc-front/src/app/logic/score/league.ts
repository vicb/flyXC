import { Measure } from './measure';
import { Score } from './scorer';

export abstract class League {
  abstract name: string;
  abstract code: LeagueCode;
  abstract score(measure: Measure): Score[];
}

// allowed league codes
// ensure that all league codes defined in each League sub classes are in this
// closed set.
export type LeagueCode = 'czl' | 'cze' | 'czo' | 'fr' | 'leo' | 'nor' | 'ukc' | 'uki' | 'ukn' | 'xc' | 'xcppg' | 'wxc';
