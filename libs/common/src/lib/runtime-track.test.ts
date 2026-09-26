import { describe, expect, it } from 'vitest';

import { averagePerSeconds, computeVerticalSpeed } from './runtime-track';

describe('averagePerSeconds', () => {
  it('handles empty and single-point inputs', () => {
    expect(averagePerSeconds([], [], 60)).toEqual([]);
    expect(averagePerSeconds([0], [10], 60)).toEqual([0]);
  });

  it('computes correct rate for a 2-point track', () => {
    // 20 meters climbed in 10 seconds = 2.0 m/s
    const data = [0, 20];
    const times = [0, 10];
    expect(averagePerSeconds(data, times, 20)).toEqual([2, 2]);
  });

  it('computes exact constant rate across all points including index 0 and last index', () => {
    // 10 meters climbed every 10 seconds = 1.0 m/s
    const times = [0, 10, 20, 30, 40, 50];
    const data = [0, 10, 10, 10, 10, 10];
    const result = averagePerSeconds(data, times, 20);
    expect(result).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('includes data from the final fix without omitting the last interval', () => {
    // 300m climb only in the final 10s interval (t=20 to t=30)
    const times = [0, 10, 20, 30];
    const data = [0, 0, 0, 300];
    const result = averagePerSeconds(data, times, 60);
    // Over the entire 30s window (300m / 30s = 10 m/s)
    expect(result).toEqual([10, 10, 10, 10]);
  });

  it('handles duplicate timestamps without returning NaN or Infinity', () => {
    const times = [0, 10, 10, 20];
    const data = [0, 10, 0, 10];
    const result = averagePerSeconds(data, times, 60);
    expect(result.every((val) => Number.isFinite(val))).toBe(true);
  });

  it('smooths rates over the specified sliding window', () => {
    // Level flight for 30s, then climb for 30s
    const times = [0, 10, 20, 30, 40, 50, 60];
    const data = [0, 0, 0, 0, 20, 20, 20]; // 2 m/s starting at t=30
    const result = averagePerSeconds(data, times, 40);
    // At t=0, speed is 0
    expect(result[0]).toBe(0);
    // Transition points are smoothed between 0 and 2 m/s
    expect(result[3]).toBeGreaterThan(0);
    expect(result[3]).toBeLessThan(2);
    // At t=60, speed reaches 2 m/s
    expect(result[6]).toBe(2);
  });
});

describe('computeVerticalSpeed', () => {
  it('computes 0 m/s for level flight', () => {
    const alt = [1000, 1000, 1000, 1000];
    const times = [0, 10, 20, 30];
    const vz = computeVerticalSpeed(alt, times);
    expect(vz).toEqual([0, 0, 0, 0]);
  });

  it('computes correct vertical speed for steady climb', () => {
    // Climbing 20m every 10s = 2 m/s
    const alt = [1000, 1020, 1040, 1060, 1080];
    const times = [0, 10, 20, 30, 40];
    const vz = computeVerticalSpeed(alt, times);
    expect(vz).toEqual([2, 2, 2, 2, 2]);
  });

  it('computes correct negative vertical speed for descent', () => {
    // Sinking 30m every 10s = -3 m/s
    const alt = [1000, 970, 940, 910];
    const times = [0, 10, 20, 30];
    const vz = computeVerticalSpeed(alt, times);
    expect(vz).toEqual([-3, -3, -3, -3]);
  });
});
