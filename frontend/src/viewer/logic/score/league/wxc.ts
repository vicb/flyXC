import { Measure } from '../measure';
import { Score, scoreCircuits, scoreOpenDistance, scoreTriangles } from '../scorer';

export class WXC {
  name = 'World XC Online Contest';

  score(measure: Measure): Score[] {
    return [
      ...scoreOpenDistance(measure, 3, this.openDistanceMultiplier),
      ...scoreCircuits(measure, null, this.scoreTriangles),
    ];
  }

  protected scoreTriangles = (measure: Measure, distances: number[], indexes: number[]): Score[] =>
    scoreTriangles(1.75, 2, 0.2, false, true, measure, distances, indexes);

  protected openDistanceMultiplier(): number {
    return 1;
  }
}
