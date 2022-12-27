import { Measure } from './measure';
import { Score } from './scorer';

export abstract class League {
  abstract name: string;
  abstract score(measure: Measure): Score[];
}
