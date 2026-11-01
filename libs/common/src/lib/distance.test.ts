import { getDistance } from 'geolib';
import { describe, expect, it } from 'vitest';

import { approximateDistanceSquared } from './distance';

describe('approximateDistanceSquared', () => {
  it('returns 0 for identical coordinates', () => {
    expect(approximateDistanceSquared(45.0, 6.0, 45.0, 6.0)).toBe(0);
  });

  it('matches geodesic distance squared within 0.5% for short distances (~1.5 km)', () => {
    const lat1 = 32.05;
    const lon1 = 76.7;
    const lat2 = 32.06;
    const lon2 = 76.71;

    const geolibDist = getDistance({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 });
    const approxDistSq = approximateDistanceSquared(lat1, lon1, lat2, lon2);
    const approxDist = Math.sqrt(approxDistSq);

    expect(approxDist).toBeCloseTo(geolibDist, -1); // within 10 meters
    const relativeError = Math.abs(approxDist - geolibDist) / geolibDist;
    expect(relativeError).toBeLessThan(0.003); // < 0.3% error
  });

  it('matches geodesic distance squared within 1% for medium distances (~50 km)', () => {
    const lat1 = 45.0;
    const lon1 = 6.0;
    const lat2 = 45.3;
    const lon2 = 6.4;

    const geolibDist = getDistance({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 });
    const approxDistSq = approximateDistanceSquared(lat1, lon1, lat2, lon2);
    const approxDist = Math.sqrt(approxDistSq);

    const relativeError = Math.abs(approxDist - geolibDist) / geolibDist;
    expect(relativeError).toBeLessThan(0.01); // < 1% error
  });
});
