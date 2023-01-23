import { getTrackerName, isEmergencyFix, isLowBatFix, isValidFix, LiveTrackFlag, trackerIdByName } from '@flyxc/common';
import { computeDestinationPoint } from 'geolib';
import { LivePoint, makeLiveTrack } from './live-track';

describe('makeLiveTrack', () => {
  it('should order the points in chronological order', () => {
    const points: LivePoint[] = [
      {
        name: 'inreach',
        lat: 10.123456,
        lon: -12.123456,
        alt: 100.123,
        timestamp: 2000001,
        valid: false,
      },
      {
        name: 'skylines',
        lat: 11.123456,
        lon: -13.123456,
        alt: 200.123,
        timestamp: 1000001,
        valid: true,
      },
    ];

    expect(makeLiveTrack(points)).toEqual({
      alt: [200, 100],
      extra: {},
      lat: [11.12346, 10.12346],
      lon: [-13.12346, -12.12346],
      flags: [LiveTrackFlag.Valid | trackerIdByName.skylines, trackerIdByName.inreach],
      timeSec: [1000, 2000],
    });
  });

  it('should keep 5 digits for lat and lon', () => {
    const track = makeLiveTrack([
      {
        name: 'inreach',
        lat: 10.123456,
        lon: -12.123456,
        alt: 100.123,
        timestamp: 20001,
        valid: false,
      },
    ]);

    expect(track.lat[0]).toBe(10.12346);
    expect(track.lon[0]).toBe(-12.12346);
  });

  it('should round the altitude', () => {
    const track = makeLiveTrack([
      {
        name: 'inreach',
        lat: 10.123456,
        lon: -12.123456,
        alt: 100.123,
        timestamp: 20001,
        valid: false,
      },
    ]);

    expect(track.alt[0]).toBe(100);
  });

  it('should round the ground altitude', () => {
    const track = makeLiveTrack([
      {
        name: 'inreach',
        lat: 10.123456,
        lon: -12.123456,
        alt: 100.123,
        gndAlt: 80.123,
        timestamp: 20001,
        valid: false,
      },
    ]);

    expect(track.extra[0].gndAlt).toBe(80);
  });

  it('should convert the timestamp to seconds', () => {
    const track = makeLiveTrack([
      {
        name: 'inreach',
        lat: 10.123456,
        lon: -12.123456,
        alt: 100.123,
        timestamp: 20001,
        valid: false,
      },
    ]);

    expect(track.timeSec[0]).toBe(20);
  });

  it('should not add extra when not required', () => {
    const track = makeLiveTrack([
      {
        name: 'inreach',
        lat: 10.123456,
        lon: -12.123456,
        alt: 100.123,
        timestamp: 20001,
        valid: false,
      },
    ]);

    expect(track.extra).toEqual({});
  });

  it('should add extra for speed as uint32', () => {
    const track = makeLiveTrack([
      { name: 'inreach', lat: 10, lon: -12, alt: 100, timestamp: 1000000, valid: false },
      { name: 'inreach', lat: 10, lon: -12, alt: 100, timestamp: 2000000, valid: false, speed: 10.123 },
    ]);

    expect(track.extra).toEqual({ 1: { speed: 10 } });
  });

  it('should add extra for messages', () => {
    const track = makeLiveTrack([
      { name: 'inreach', lat: 10, lon: -12, alt: 100, timestamp: 1000000, valid: false },
      {
        name: 'inreach',
        lat: 10,
        lon: -12,
        alt: 100,
        timestamp: 2000000,
        valid: false,
        message: 'hello',
      },
    ]);

    expect(track.extra).toEqual({ 1: { message: 'hello' } });
  });

  it('should add extra for ground altitude', () => {
    const track = makeLiveTrack([
      { name: 'inreach', lat: 10, lon: -12, alt: 100, timestamp: 1000000, valid: false },
      { name: 'inreach', lat: 10, lon: -12, alt: 100, timestamp: 2000000, valid: false, gndAlt: 32 },
    ]);

    expect(track.extra).toEqual({ 1: { gndAlt: 32 } });
  });

  it('should compute the speed for the last point as an uint32', () => {
    const start = { lat: 0, lon: 0 };
    const end = computeDestinationPoint(start, 1000, 0);

    const track = makeLiveTrack([
      { name: 'inreach', lat: start.lat, lon: start.lon, alt: 100, timestamp: 1000000, valid: false },
      {
        name: 'inreach',
        lat: end.latitude,
        lon: end.longitude,
        alt: 100,
        timestamp: 1060000,
        valid: false,
      },
    ]);

    const speed = track.extra[1].speed as number;
    expect(speed).toBeGreaterThan(58);
    expect(speed).toBeLessThan(62);
    expect(Math.round(speed)).toEqual(speed);
  });

  it('should encode valid', () => {
    const track = makeLiveTrack([
      { name: 'inreach', lat: 10, lon: -12, alt: 100, timestamp: 1000, valid: false },
      { name: 'inreach', lat: 10, lon: -12, alt: 100, timestamp: 2000, valid: true },
      { name: 'inreach', lat: 10, lon: -12, alt: 100, timestamp: 2000, valid: null },
      { name: 'inreach', lat: 10, lon: -12, alt: 100, timestamp: 2000 },
    ]);

    expect(track.flags.map((flags) => isValidFix(flags))).toEqual([false, true, true, true]);
  });

  it('should encode emergency', () => {
    const track = makeLiveTrack([
      { name: 'inreach', lat: 10, lon: -12, alt: 100, timestamp: 1000, emergency: true },
      { name: 'inreach', lat: 10, lon: -12, alt: 100, timestamp: 2000, emergency: false },
      { name: 'inreach', lat: 10, lon: -12, alt: 100, timestamp: 2000, emergency: null },
      { name: 'inreach', lat: 10, lon: -12, alt: 100, timestamp: 2000 },
    ]);

    expect(track.flags.map((flags) => isEmergencyFix(flags))).toEqual([true, false, false, false]);
  });

  it('should encode low battery', () => {
    const track = makeLiveTrack([
      { name: 'inreach', lat: 10, lon: -12, alt: 100, timestamp: 1000, lowBattery: true },
      { name: 'inreach', lat: 10, lon: -12, alt: 100, timestamp: 2000, lowBattery: false },
      { name: 'inreach', lat: 10, lon: -12, alt: 100, timestamp: 2000, lowBattery: null },
      { name: 'inreach', lat: 10, lon: -12, alt: 100, timestamp: 2000 },
    ]);

    expect(track.flags.map((flags) => isLowBatFix(flags))).toEqual([true, false, false, false]);
  });

  it('should encode the device', () => {
    const track = makeLiveTrack([
      { name: 'inreach', lat: 10, lon: -12, alt: 100, timestamp: 1000 },
      { name: 'spot', lat: 10, lon: -12, alt: 100, timestamp: 2000 },
      { name: 'skylines', lat: 10, lon: -12, alt: 100, timestamp: 2000 },
      { name: 'flyme', lat: 10, lon: -12, alt: 100, timestamp: 2000 },
      { name: 'flymaster', lat: 10, lon: -12, alt: 100, timestamp: 2000 },
    ]);

    expect(track.flags.map((flags) => getTrackerName(flags))).toEqual([
      'inreach',
      'spot',
      'skylines',
      'flyme',
      'flymaster',
    ]);
  });
});
