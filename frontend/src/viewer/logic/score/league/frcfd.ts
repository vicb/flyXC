import { Score, scoreCircuits, scoreOpenDistance, scoreTriangles } from '../scorer';

import { League } from '../league';
import { Measure } from '../measure';

export class FrCfd extends League {
  name = 'France (CFD)';

  score(measure: Measure): Score[] {
    return [
      ...scoreOpenDistance(measure, 3, this.openDistanceMultiplier),
      ...scoreCircuits(measure, null, this.scoreTriangleAbsolute),
      ...scoreCircuits(measure, null, this.scoreTriangleRelative),
    ];
  }

  protected scoreTriangleRelative = (measure: Measure, distances: number[], indexes: number[]): Score[] =>
    scoreTriangles(1.2, 1.4, 0.05, false, true, measure, distances, indexes);

  protected scoreTriangleAbsolute = (measure: Measure, distances: number[], indexes: number[]): Score[] =>
    scoreTriangles(1.2, 1.4, 3000, true, false, measure, distances, indexes);

  protected openDistanceMultiplier(distance: number): number {
    return distance < 15000 ? 0 : 1;
  }
}
