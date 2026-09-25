import type { AprsPosition } from '@flyxc/common';
import { NO_ALTITUDE, protos } from '@flyxc/common';
import { describe, expect, it } from 'vitest';

import { OGN_ALTITUDE_AFFINITY_MIN, processOgnPositions } from './ogn';

describe('processOgnPositions', () => {
  const baseTimeSec = 10_000;
  const keepFromSec = baseTimeSec - 5 * 60;

  it('preserves altitude for normal beacons with altitude', () => {
    const positions: AprsPosition[] = [
      { lat: 45.1, lon: 6.1, alt: 1500, timeSec: baseTimeSec, speed: 30, course: 180 },
      { lat: 45.2, lon: 6.2, alt: 1520, timeSec: baseTimeSec + 10, speed: 32, course: 185 },
    ];

    const points = processOgnPositions(positions, keepFromSec);
    expect(points).toHaveLength(2);
    expect(points[0].alt).toBe(1500);
    expect(points[1].alt).toBe(1520);
    expect(points[0].status).toBeUndefined();
  });

  it('filters out positions older than keepFromSec', () => {
    const positions: AprsPosition[] = [
      { lat: 45.1, lon: 6.1, alt: 1500, timeSec: keepFromSec - 10, speed: 30, course: 180 },
      { lat: 45.2, lon: 6.2, alt: 1520, timeSec: baseTimeSec, speed: 32, course: 185 },
    ];

    const points = processOgnPositions(positions, keepFromSec);
    expect(points).toHaveLength(1);
    expect(points[0].timeSec).toBe(baseTimeSec);
  });

  it('borrows altitude from an earlier beacon in the same cycle', () => {
    const positions: AprsPosition[] = [
      { lat: 45.1, lon: 6.1, alt: 1200, timeSec: baseTimeSec, speed: 25, course: 90 },
      { lat: 45.11, lon: 6.11, timeSec: baseTimeSec + 15, speed: 0, course: 0, comment: 'id3E88BFEA FNT79 71.0dB' },
    ];

    const points = processOgnPositions(positions, keepFromSec);
    expect(points).toHaveLength(2);
    expect(points[0].alt).toBe(1200);
    expect(points[1].alt).toBe(1200);
    expect(points[1].status).toBe(protos.PilotStatus.LANDED_OK);
  });

  it('borrows altitude from a later beacon in the same cycle', () => {
    const positions: AprsPosition[] = [
      { lat: 45.11, lon: 6.11, timeSec: baseTimeSec, speed: 0, course: 0, comment: 'id3E88BFEA FNT78 71.0dB' },
      { lat: 45.1, lon: 6.1, alt: 850, timeSec: baseTimeSec + 20, speed: 20, course: 100 },
    ];

    const points = processOgnPositions(positions, keepFromSec);
    expect(points).toHaveLength(2);
    expect(points[0].alt).toBe(850);
    expect(points[0].status).toBe(protos.PilotStatus.NEED_RIDE);
    expect(points[1].alt).toBe(850);
  });

  it('borrows altitude from the closest beacon in time in the same cycle', () => {
    const positions: AprsPosition[] = [
      { lat: 45.0, lon: 6.0, alt: 2000, timeSec: baseTimeSec, speed: 20, course: 0 },
      { lat: 45.1, lon: 6.1, timeSec: baseTimeSec + 80, speed: 0, course: 0, comment: 'FNT79' },
      { lat: 45.2, lon: 6.2, alt: 1000, timeSec: baseTimeSec + 90, speed: 10, course: 0 },
    ];

    const points = processOgnPositions(positions, keepFromSec);
    expect(points).toHaveLength(3);
    // Closest to baseTimeSec + 80 is baseTimeSec + 90 (delta 10s vs 80s)
    expect(points[1].alt).toBe(1000);
  });

  it('borrows altitude from pilotTrack when no beacon in the current cycle is within affinity', () => {
    const pilotTrack: protos.LiveTrack = {
      timeSec: [baseTimeSec - 15 * 60],
      lat: [45.0],
      lon: [6.0],
      alt: [1400],
      gndAlt: [1000],
      flags: [0],
      extra: {},
    };

    const positions: AprsPosition[] = [
      { lat: 45.1, lon: 6.1, timeSec: baseTimeSec, speed: 0, course: 0, comment: 'id3E88BFEA FNT79 71.0dB' },
    ];

    const points = processOgnPositions(positions, keepFromSec, pilotTrack);
    expect(points).toHaveLength(1);
    expect(points[0].alt).toBe(1400);
    expect(points[0].status).toBe(protos.PilotStatus.LANDED_OK);
  });

  it('assigns NO_ALTITUDE when pilotTrack fix is older than the affinity window (30 min)', () => {
    const pilotTrack: protos.LiveTrack = {
      timeSec: [baseTimeSec - (OGN_ALTITUDE_AFFINITY_MIN + 5) * 60],
      lat: [45.0],
      lon: [6.0],
      alt: [1400],
      gndAlt: [1000],
      flags: [0],
      extra: {},
    };

    const positions: AprsPosition[] = [
      { lat: 45.1, lon: 6.1, timeSec: baseTimeSec, speed: 0, course: 0, comment: 'id3E88BFEA FNT79 71.0dB' },
    ];

    const points = processOgnPositions(positions, keepFromSec, pilotTrack);
    expect(points).toHaveLength(1);
    expect(points[0].alt).toBe(NO_ALTITUDE);
  });

  it('assigns NO_ALTITUDE when no prior track exists at all', () => {
    const positions: AprsPosition[] = [
      { lat: 45.1, lon: 6.1, timeSec: baseTimeSec, speed: 0, course: 0, comment: 'id3E88BFEA FNT7E 71.0dB' },
    ];

    const points = processOgnPositions(positions, keepFromSec, undefined);
    expect(points).toHaveLength(1);
    expect(points[0].alt).toBe(NO_ALTITUDE);
    expect(points[0].status).toBe(protos.PilotStatus.SOS);
  });
});
