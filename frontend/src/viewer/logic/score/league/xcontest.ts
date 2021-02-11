import { Measure } from '../measure';
import { Score, scoreCircuits, ScoreFunction, scoreOpenDistance, scoreTriangles } from '../scorer';

export class XContest {
  name = 'XContest';

  score(measure: Measure): Score[] {
    return [
      ...scoreOpenDistance(measure, 3, this.openDistanceMultiplier),
      ...scoreCircuits(measure, null, this.scoreTriangles1),
      ...scoreCircuits(measure, null, this.scoreTriangles2),
    ];
  }

  protected scoreTriangles1: ScoreFunction = (measure: Measure, distances: number[], indexes: number[]): Score[] =>
    scoreTriangles(1.4, 1.6, 0.05, false, true, measure, distances, indexes);

  protected scoreTriangles2 = (measure: Measure, distances: number[], indexes: number[]): Score[] =>
    scoreTriangles(1.2, 1.4, 0.2, false, true, measure, distances, indexes);

  protected openDistanceMultiplier(): number {
    return 1;
  }
}

export class NorwayLeague {
  name = 'Norway (Distanseligaen)';

  score(measure: Measure): Score[] {
    return [
      ...scoreOpenDistance(measure, 3, this.openDistanceMultiplier),
      ...scoreCircuits(measure, null, this.scoreTriangles1),
      ...scoreCircuits(measure, null, this.scoreTriangles2),
    ];
  }

  protected scoreTriangles1: ScoreFunction = (measure: Measure, distances: number[], indexes: number[]): Score[] =>
    scoreTriangles(2.0, 2.6, 0.05, false, true, measure, distances, indexes);

  protected scoreTriangles2 = (measure: Measure, distances: number[], indexes: number[]): Score[] =>
    scoreTriangles(1.8, 2.4, 0.2, false, true, measure, distances, indexes);

  protected openDistanceMultiplier(): number {
    return 1;
  }
}
