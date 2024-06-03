import { CircuitType } from '@flyxc/optimizer';

export class Score {
  distanceM: number;
  indexes: number[];
  multiplier: number;
  circuit: CircuitType;
  // TODO: can we use 0 instead of null
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
