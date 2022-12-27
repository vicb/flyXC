import { Measure } from '../measure';
import { Score, scoreCircuits, scoreOpenDistance, scoreTriangles } from '../scorer';

abstract class CZXCBase {
  score(measure: Measure): Score[] {
    return [
      ...scoreOpenDistance(measure, 3, this.openDistanceMultiplier),
      ...scoreCircuits(measure, null, this.scoreTriangles),
    ];
  }
  protected scoreTriangles = (measure: Measure, distances: number[], indexes: number[]): Score[] =>
    scoreTriangles(
      this.flatTriangleMultiplier(),
      this.faiTriangleMultiplier(),
      0.05,
      false,
      true,
      measure,
      distances,
      indexes,
    );

  protected abstract faiTriangleMultiplier(): number;
  protected abstract flatTriangleMultiplier(): number;
  protected abstract openDistanceMultiplier(): number;
}

export class CzechLocal extends CZXCBase {
  name = 'Czech (ČPP local)';

  protected faiTriangleMultiplier(): number {
    return 2.2;
  }
  protected flatTriangleMultiplier(): number {
    return 1.8;
  }
  protected openDistanceMultiplier(): number {
    return 1;
  }
}

export class CzechEurope extends CZXCBase {
  name = 'Czech (ČPP Europe)';

  protected faiTriangleMultiplier(): number {
    return 1.4;
  }
  protected flatTriangleMultiplier(): number {
    return 1.2;
  }
  protected openDistanceMultiplier(): number {
    return 1;
  }
}

export class CzechOutEurope extends CZXCBase {
  name = 'Czech (ČPP outside Europe)';

  protected faiTriangleMultiplier(): number {
    return 1.4;
  }
  protected flatTriangleMultiplier(): number {
    return 1.2;
  }
  protected openDistanceMultiplier(): number {
    return 0.8;
  }
}
