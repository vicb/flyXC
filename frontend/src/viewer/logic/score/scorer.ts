import { Measure } from './measure';

export type ScoreFunction = (measure: Measure, distances: number[], indexes: number[]) => Score[];

export const enum CircuitType {
  OpenDistance = 'Open distance',
  FlatTriangle = 'Flat triangle',
  FaiTriangle = 'Fai triangle',
  OutAndReturn = 'Out and return',
}

export class Score {
  distance: number;
  indexes: number[];
  multiplier: number;
  circuit: CircuitType;
  closingRadius: number | null;
  points: number;

  constructor(score: Partial<Score>) {
    this.distance = score.distance || 0;
    this.indexes = score.indexes || [];
    this.multiplier = score.multiplier || 1;
    this.circuit = score.circuit || CircuitType.OpenDistance;
    this.closingRadius = score.closingRadius || null;
    this.points = (this.distance * this.multiplier) / 1000;
  }
}

export function scoreOpenDistance(
  measure: Measure,
  maxTurnpoints: number,
  multiplierFn: (d: number) => number,
): Score[] {
  const len = measure.points.length;
  let result: any;
  if (maxTurnpoints == 0 || len == 2) {
    result = measure.computeOpenDistance0();
  } else if (maxTurnpoints == 1 || len == 3) {
    result = measure.computeOpenDistance1();
  } else if (maxTurnpoints == 2 || len == 4) {
    result = measure.computeOpenDistance2();
  } else if (maxTurnpoints == 3 || len == 5) {
    result = measure.computeOpenDistance3();
  }

  return result
    ? [
        new Score({
          distance: result.distance,
          indexes: result.indexes,
          multiplier: multiplierFn(result.distance),
          circuit: CircuitType.OpenDistance,
        }),
      ]
    : [];
}

export function scoreCircuits(
  measure: Measure,
  scoreOutAndReturn: ScoreFunction | null,
  scoreTriangles: ScoreFunction | null,
): Score[] {
  const len = measure.points.length;
  const distances = [0, 0, 0];
  const scores: Score[] = [];
  for (let i = 0; i < len - 2; i++) {
    for (let j = i + 1; j < len - 1; j++) {
      distances[0] = measure.getDistance(i, j);
      if (scoreOutAndReturn) {
        const score = scoreOutAndReturn(measure, distances, [i, j]);
        if (score) {
          scores.push(...score);
        }
      }
      if (scoreTriangles) {
        for (let k = j + 1; k < len; k++) {
          distances[1] = measure.getDistance(j, k);
          distances[2] = measure.getDistance(k, i);
          const score = scoreTriangles(measure, distances, [i, j, k]);
          if (score) {
            scores.push(...score);
          }
        }
      }
    }
  }
  return scores;
}

export function scoreTriangles(
  flatMul: number | undefined,
  faiMul: number | undefined,
  tolerance: number,
  absolute: boolean,
  penalize: boolean,
  measure: Measure,
  distances: number[],
  indexes: number[],
): Score[] {
  const firstIdx = indexes[0];
  const lastIdx = indexes[2];
  const len = measure.points.length;
  const distance = distances[0] + distances[1] + distances[2];
  const closingRadius = absolute ? tolerance : tolerance * distance;
  let minGap = closingRadius;
  let minIndexes: null | number[] = null;
  for (let i = firstIdx; i >= 0; i--) {
    for (let j = lastIdx; j < len; j++) {
      const gap = measure.getDistance(i, j);
      if (gap <= minGap) {
        minGap = gap;
        minIndexes = [i, ...indexes, j];
      }
    }
  }
  if (!minIndexes) {
    return [];
  }
  let multiplier: number;
  let circuit: CircuitType;
  if (faiMul && Math.min(...distances) / distance >= 0.28) {
    multiplier = faiMul;
    circuit = CircuitType.FaiTriangle;
  } else if (flatMul) {
    multiplier = flatMul;
    circuit = CircuitType.FlatTriangle;
  } else {
    return [];
  }
  return [
    new Score({
      distance: penalize ? distance - minGap : distance,
      indexes: minIndexes,
      multiplier,
      circuit,
      closingRadius,
    }),
  ];
}
