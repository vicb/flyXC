import { Measure } from '../measure';
import { CircuitType, Score, scoreCircuits, scoreOpenDistance } from '../scorer';

function scoreOutAndReturn(multiplierFn: (d: number) => number, measure: Measure): Score[] {
  let maxIndexes;
  let maxDistance = 0;
  let maxScoringDistance = 0;
  const len = measure.points.length;
  for (let i = 0; i < len - 1; i++) {
    for (let tp1 = i; tp1 < len - 1; tp1++) {
      for (let tp2 = tp1 + 1; tp2 < len; tp2++) {
        const distance = measure.getDistance(tp1, tp2);
        for (let l = tp2; l < len; l++) {
          const gap = measure.getDistance(i, l);
          if (gap <= 800) {
            const scoringDistance = 2 * distance - gap;
            if (scoringDistance > maxScoringDistance) {
              maxIndexes = [i, tp1, tp2, l];
              maxDistance = distance;
              maxScoringDistance = scoringDistance;
            }
          }
        }
      }
    }
  }
  return maxIndexes == null
    ? []
    : [
        new Score({
          distance: maxScoringDistance,
          indexes: maxIndexes,
          multiplier: multiplierFn(2 * maxDistance),
          circuit: CircuitType.OutAndReturn,
          closingRadius: 800,
        }),
      ];
}

function scoreTriangles(
  faiMultiplierFn: (d: number) => number,
  flatMultiplierFn: (d: number) => number,
  measure: Measure,
  distances: number[],
  indexes: number[],
): Score[] {
  const firstIndex = indexes[0];
  const lastIndex = indexes[2];
  const len = measure.points.length;
  const distance = distances[0] + distances[1] + distances[2];
  const shortestLegFraction = Math.min(...distances) / distance;
  const longestLegFraction = Math.max(...distances) / distance;
  let multiplier;
  let circuit;
  if (shortestLegFraction >= 0.28) {
    multiplier = faiMultiplierFn(distance);
    circuit = CircuitType.FaiTriangle;
  } else if (shortestLegFraction >= 0.15 && longestLegFraction <= 0.45) {
    multiplier = flatMultiplierFn(distance);
    circuit = CircuitType.FlatTriangle;
  } else {
    return [];
  }
  let minGap = 800;
  let minIndexes;
  for (let i = firstIndex; i >= 0; --i) {
    for (let j = lastIndex; j < len; ++j) {
      const gap = measure.getDistance(i, j);
      if (gap < minGap) {
        minGap = gap;
        minIndexes = [i, ...indexes, j];
      }
    }
  }
  return minIndexes == null
    ? []
    : [
        new Score({
          distance: distance - minGap,
          indexes: minIndexes,
          multiplier,
          circuit,
          closingRadius: 800,
        }),
      ];
}

abstract class UKXCLBase {
  score(measure: Measure): Score[] {
    return [
      ...scoreOpenDistance(measure, 3, this.openDistanceMultiplier),
      ...scoreCircuits(measure, this.scoreOutAndReturn, this.scoreTriangles),
    ];
  }

  protected abstract outAndReturnFlatTriangleMultiplier(distance: number): number;
  protected abstract faiTriangleMultiplier(distance: number): number;
  protected abstract openDistanceMultiplier(distance: number): number;

  protected scoreOutAndReturn = (measure: Measure): Score[] =>
    scoreOutAndReturn(this.outAndReturnFlatTriangleMultiplier, measure);

  protected scoreTriangles = (measure: Measure, distances: number[], indexes: number[]): Score[] =>
    scoreTriangles(this.faiTriangleMultiplier, this.outAndReturnFlatTriangleMultiplier, measure, distances, indexes);
}

export class UKXCLClub extends UKXCLBase {
  name = 'UK (XC League, Club)';

  protected outAndReturnFlatTriangleMultiplier(distance: number): number {
    return distance < 5000 ? 0 : distance < 15000 ? 1.2 : distance < 35000 ? 1.3 : 1.7;
  }

  protected faiTriangleMultiplier(distance: number): number {
    return distance < 5000 ? 0 : distance < 15000 ? 1.5 : distance < 35000 ? 1.7 : 2.0;
  }

  protected openDistanceMultiplier(distance: number): number {
    return distance < 5000 ? 0 : 1;
  }
}

export class UKXCLInternational extends UKXCLBase {
  name = 'UK (XC League, International)';

  protected outAndReturnFlatTriangleMultiplier(distance: number): number {
    return distance < 35000 ? 0 : 1.2;
  }

  protected faiTriangleMultiplier(distance: number): number {
    return distance < 25000 ? 0 : 1.5;
  }

  protected openDistanceMultiplier(distance: number): number {
    return distance < 10000 ? 0 : 1;
  }
}

export class UKXCLNational extends UKXCLBase {
  name = 'UK (XC League, National)';

  protected outAndReturnFlatTriangleMultiplier(distance: number): number {
    return distance < 15000 ? 0 : distance < 35000 ? 1.3 : 1.7;
  }

  protected faiTriangleMultiplier(distance: number): number {
    return distance < 15000 ? 0 : distance < 25000 ? 1.7 : 2.0;
  }

  protected openDistanceMultiplier(distance: number): number {
    return distance < 10000 ? 0 : 1;
  }
}
