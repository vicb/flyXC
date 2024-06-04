import { CircuitType } from '@flyxc/optimizer/lib/api';

export class Score {
  distanceM: number;
  indexes: number[];
  multiplier: number;
  circuit: CircuitType;
  closingRadiusM: number;
  points: number;

  constructor(score: Partial<Score>) {
    this.distanceM = score.distanceM ?? 0;
    this.indexes = score.indexes ?? [];
    this.multiplier = score.multiplier ?? 1;
    this.circuit = score.circuit ?? CircuitType.OpenDistance;
    this.closingRadiusM = score.closingRadiusM ?? 0;
    this.points = score.points ?? 0;
  }
}
