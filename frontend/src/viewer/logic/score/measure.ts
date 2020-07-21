// Optimization code adapted from
// https://github.com/twpayne/maxxc/blob/7c22a46536ec7299ec91d135fea10b5b5925032c/track.c

import { getDistance } from 'geolib';

export interface PointReference {
  index: number;
  distance: number;
}

export interface Point {
  lat: number;
  lon: number;
}

export class Measure {
  protected maxDelta = 0;
  protected len: number;
  protected distanceCache: { [idxA: number]: { [idxB: number]: number } } = {};
  protected farthestBefore: PointReference[] = [];
  protected farthestAfter: PointReference[] = [];

  constructor(public points: Point[]) {
    this.len = points.length;
    for (let i = 0; i < this.len - 1; i++) {
      this.maxDelta = Math.max(this.maxDelta, getDistance(points[i], points[i + 1]));
    }
    this.farthestBefore.push({ index: 0, distance: 0 });
    for (let i = 1; i < this.len; i++) {
      this.farthestBefore.push(this.getFarthestFrom(i, 0, i, 0));
    }
    for (let i = 0; i < this.len - 1; i++) {
      this.farthestAfter.push(this.getFarthestFrom(i, i, this.len, 0));
    }
    this.farthestAfter.push({ index: this.len - 1, distance: 0 });
  }

  getDistance(indexA: number, indexB: number): number {
    if (indexA === indexB) {
      return 0;
    }
    if (indexB < indexA) {
      [indexA, indexB] = [indexB, indexA];
    }
    if (!(indexA in this.distanceCache)) {
      this.distanceCache[indexA] = {};
    }
    if (!(indexB in this.distanceCache[indexA])) {
      this.distanceCache[indexA][indexB] = getDistance(this.points[indexA], this.points[indexB]);
    }
    return this.distanceCache[indexA][indexB];
  }

  getFarthestFrom(ref: number, startIndex: number, stopIndex: number, bound: number): PointReference {
    let index = -1;
    let distance;
    for (let i = startIndex; i < stopIndex; ) {
      distance = this.getDistance(ref, i);
      if (distance > bound) {
        index = i;
        bound = distance;
        i++;
      } else {
        i = this.fastForward(i, bound - distance);
      }
    }
    return { index, distance: bound };
  }

  computeOpenDistance0(): { distance: number; indexes: number[] } {
    const indexes = [-1, -1];
    let bound = -1;
    for (let start = 0; start < this.len - 1; start++) {
      const finish = this.getFarthestFrom(start, start + 1, this.len, bound);
      if (finish.index > -1) {
        indexes[0] = start;
        indexes[1] = finish.index;
        bound = finish.distance;
      }
    }
    return { distance: bound, indexes };
  }

  computeOpenDistance1(): { distance: number; indexes: number[] } {
    const indexes = [-1, -1, -1];
    let bound = -1;
    for (let tp1 = 1; tp1 < this.len - 1; ) {
      const total = this.farthestBefore[tp1].distance + this.farthestAfter[tp1].distance;
      if (total > bound) {
        indexes[0] = this.farthestBefore[tp1].index;
        indexes[1] = tp1;
        indexes[2] = this.farthestAfter[tp1].index;
        bound = total;
        tp1++;
      } else {
        tp1 = this.fastForward(tp1, (bound - total) / 2);
      }
    }
    return { distance: bound, indexes };
  }

  computeOpenDistance2(): { distance: number; indexes: number[] } {
    const indexes = [-1, -1, -1, -1];
    let bound = -1;
    for (let tp1 = 1; tp1 < this.len - 2; tp1++) {
      const leg1 = this.farthestBefore[tp1].distance;
      for (let tp2 = tp1 + 1; tp2 < this.len - 1; ) {
        const distance = leg1 + this.getDistance(tp1, tp2) + this.farthestAfter[tp2].distance;
        if (distance > bound) {
          indexes[0] = this.farthestBefore[tp1].index;
          indexes[1] = tp1;
          indexes[2] = tp2;
          indexes[3] = this.farthestAfter[tp2].index;
          bound = distance;
          tp2++;
        } else {
          tp2 = this.fastForward(tp2, (bound - distance) / 2);
        }
      }
    }
    return { distance: bound, indexes };
  }

  computeOpenDistance3(): { distance: number; indexes: number[] } {
    const indexes = [-1, -1, -1, -1, -1];
    let bound = -1;
    for (let tp1 = 1; tp1 < this.len - 3; tp1++) {
      const leg1 = this.farthestBefore[tp1].distance;
      for (let tp2 = tp1 + 1; tp2 < this.len - 2; tp2++) {
        const leg2 = this.getDistance(tp1, tp2);
        for (let tp3 = tp2 + 1; tp3 < this.len - 1; ) {
          const distance = leg1 + leg2 + this.getDistance(tp2, tp3) + this.farthestAfter[tp3].distance;
          if (distance > bound) {
            indexes[0] = this.farthestBefore[tp1].index;
            indexes[1] = tp1;
            indexes[2] = tp2;
            indexes[3] = tp3;
            indexes[4] = this.farthestAfter[tp3].index;
            bound = distance;
            tp3++;
          } else {
            tp3 = this.fastForward(tp3, (bound - distance) / 2);
          }
        }
      }
    }
    return { distance: bound, indexes };
  }

  protected fastForward(index: number, distance: number): number {
    if (this.maxDelta == 0) {
      return index + 1;
    }
    const step = Math.floor(distance / this.maxDelta);
    return index + Math.max(step, 1);
  }
}
