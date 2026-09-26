import { describe, expect, it } from 'vitest';

import { computeGroundSpeed, computeVerticalSpeed } from './runtime-track';

describe('computeGroundSpeed', () => {
  it('handles empty and single-point inputs', () => {
    expect(computeGroundSpeed([], [], [], 60)).toEqual({
      maxDistance: 0,
      maxLat: 0,
      maxLon: 0,
      maxVx: 0,
      minLat: 0,
      minLon: 0,
      minVx: 0,
      vx: [],
    });
    expect(computeGroundSpeed([45], [5], [10], 60)).toEqual({
      maxDistance: 0,
      maxLat: 45,
      maxLon: 5,
      maxVx: 0,
      minLat: 45,
      minLon: 5,
      minVx: 0,
      vx: [0],
    });
  });

  it('computes correct speed, maxDistance, and coordinate bounds for a 2-point track', () => {
    // Two coordinates along equator 0.001 deg lon apart ~ 111m
    const lat = [0, 0];
    const lon = [0, 0.001];
    const times = [0, 10]; // 10s -> ~11.1m/s -> ~40 km/h
    const { maxDistance, maxLat, maxLon, maxVx, minLat, minLon, minVx, vx } = computeGroundSpeed(lat, lon, times, 20);
    expect(vx.length).toBe(2);
    expect(vx[0]).toBeCloseTo(40, 0);
    expect(vx[1]).toBeCloseTo(40, 0);
    expect(maxDistance).toBeCloseTo(111, 0);
    expect(minVx).toBeCloseTo(40, 0);
    expect(maxVx).toBeCloseTo(40, 0);
    expect(minLat).toBe(0);
    expect(maxLat).toBe(0);
    expect(minLon).toBe(0);
    expect(maxLon).toBe(0.001);
  });

  it('computes 0 km/h for stationary tracks', () => {
    const lat = [45, 45, 45, 45];
    const lon = [6, 6, 6, 6];
    const times = [0, 10, 20, 30];
    const { maxDistance, maxLat, maxLon, maxVx, minLat, minLon, minVx, vx } = computeGroundSpeed(lat, lon, times, 60);
    expect(vx).toEqual([0, 0, 0, 0]);
    expect(maxDistance).toBe(0);
    expect(minVx).toBe(0);
    expect(maxVx).toBe(0);
    expect(minLat).toBe(45);
    expect(maxLat).toBe(45);
    expect(minLon).toBe(6);
    expect(maxLon).toBe(6);
  });

  it('handles duplicate timestamps without returning NaN or Infinity', () => {
    const lat = [45, 45.001, 45.001, 45.002];
    const lon = [6, 6, 6, 6];
    const times = [0, 10, 10, 20];
    const { vx } = computeGroundSpeed(lat, lon, times, 60);
    expect(vx.every((val) => Number.isFinite(val))).toBe(true);
  });

  it('smooths speeds over the specified sliding window', () => {
    // Stationary for 30s, then moving for 30s
    const lat = [0, 0, 0, 0, 0, 0, 0];
    const lon = [0, 0, 0, 0, 0.001, 0.002, 0.003];
    const times = [0, 10, 20, 30, 40, 50, 60];
    const { vx } = computeGroundSpeed(lat, lon, times, 40);
    // Initial stationary fix
    expect(vx[0]).toBe(0);
    // Transition point is smoothed
    expect(vx[3]).toBeGreaterThan(0);
    // Moving speed at t=60
    expect(vx[6]).toBeGreaterThan(0);
  });
});

describe('computeVerticalSpeed', () => {
  it('computes 0 m/s for level flight', () => {
    const alt = [1000, 1000, 1000, 1000];
    const times = [0, 10, 20, 30];
    const { maxAlt, maxVz, minAlt, minVz, vz } = computeVerticalSpeed(alt, times);
    expect(vz).toEqual([0, 0, 0, 0]);
    expect(minVz).toBe(0);
    expect(maxVz).toBe(0);
    expect(minAlt).toBe(1000);
    expect(maxAlt).toBe(1000);
  });

  it('computes correct vertical speed for steady climb', () => {
    // Climbing 20m every 10s = 2 m/s
    const alt = [1000, 1020, 1040, 1060, 1080];
    const times = [0, 10, 20, 30, 40];
    const { maxAlt, maxVz, minAlt, minVz, vz } = computeVerticalSpeed(alt, times);
    expect(vz).toEqual([2, 2, 2, 2, 2]);
    expect(minVz).toBe(2);
    expect(maxVz).toBe(2);
    expect(minAlt).toBe(1000);
    expect(maxAlt).toBe(1080);
  });

  it('computes correct negative vertical speed for descent', () => {
    // Sinking 30m every 10s = -3 m/s
    const alt = [1000, 970, 940, 910];
    const times = [0, 10, 20, 30];
    const { maxAlt, maxVz, minAlt, minVz, vz } = computeVerticalSpeed(alt, times);
    expect(vz).toEqual([-3, -3, -3, -3]);
    expect(minVz).toBe(-3);
    expect(maxVz).toBe(-3);
    expect(minAlt).toBe(910);
    expect(maxAlt).toBe(1000);
  });

  it('handles empty input gracefully', () => {
    const { maxAlt, maxVz, minAlt, minVz, vz } = computeVerticalSpeed([], []);
    expect(vz).toEqual([]);
    expect(minVz).toBe(0);
    expect(maxVz).toBe(0);
    expect(minAlt).toBe(0);
    expect(maxAlt).toBe(0);
  });
});
