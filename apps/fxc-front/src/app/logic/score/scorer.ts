import { CircuitType as OptimizerCircuitType } from '@flyxc/optimizer';

export enum CircuitType {
  OpenDistance = 'Open distance',
  FlatTriangle = 'Flat triangle',
  FaiTriangle = 'Fai triangle',
  OutAndReturn = 'Out and return',
}

export function getCircuitType(circuit?: OptimizerCircuitType) {
  return circuit as unknown as CircuitType;
}

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
