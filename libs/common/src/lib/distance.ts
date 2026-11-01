import { getDistance } from 'geolib';

import type { RuntimeTrack } from './runtime-track';

/**
 * Approximate meters per degree of latitude on Earth.
 */
export const METERS_PER_DEG_LAT = 111_139;

/**
 * Computes the squared approximate distance in meters² between two coordinates using an equirectangular flat-earth projection.
 *
 * Tradeoffs:
 * - **Performance**: Fast because it avoids full geodesic calculations, eliminates allocating temporary point objects
 *   `{ lat, lon }` on the heap, and avoids expensive square-root calls. Ideal for comparing against a squared distance threshold
 *   (e.g. `dist² <= maxDist²`).
 * - **Accuracy**: Assumes a locally flat Earth where parallels are evenly spaced. The relative approximation error
 *   is < 0.15% for short-to-medium distances (< 50 km) and remains < 1% up to hundreds of kilometers, making it
 *   well-suited for speed and proximity threshold checks in live flight tracking. It is not intended for global-scale
 *   geodesics or near-polar routes.
 *
 * @param lat1 - Latitude of first point in decimal degrees.
 * @param lon1 - Longitude of first point in decimal degrees.
 * @param lat2 - Latitude of second point in decimal degrees.
 * @param lon2 - Longitude of second point in decimal degrees.
 * @returns Squared approximate distance in meters².
 */
export function approximateDistanceSquared(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLatMeters = (lat2 - lat1) * METERS_PER_DEG_LAT;
  let dLon = lon2 - lon1;
  if (dLon > 180) {
    dLon -= 360;
  } else if (dLon < -180) {
    dLon += 360;
  }
  const cosLat = Math.cos(((lat1 + lat2) * Math.PI) / 360);
  const dLonMeters = dLon * METERS_PER_DEG_LAT * cosLat;
  return dLatMeters * dLatMeters + dLonMeters * dLonMeters;
}

// Finds the closest fix to {lat, lon} across all the tracks.
export function findClosestFix(
  tracks: RuntimeTrack[],
  lat: number,
  lon: number,
): { track: RuntimeTrack; timeSec: number } | undefined {
  let foundTrack: RuntimeTrack | undefined;
  let foundTimeSec = 0;
  let foundDistance = 10000;
  const ref = { lat, lon };
  tracks.forEach((track) => {
    for (let fixIdx = 0; fixIdx < track.lat.length; ) {
      const lat = track.lat[fixIdx];
      const lon = track.lon[fixIdx];
      const d = getDistance(ref, { lat, lon });
      if (d < foundDistance) {
        foundTimeSec = track.timeSec[fixIdx];
        foundTrack = track;
        foundDistance = d;
        fixIdx++;
      } else {
        fixIdx += Math.max(1, Math.floor((d - foundDistance) / track.maxDistance));
      }
    }
  });

  return foundTrack != null ? { track: foundTrack, timeSec: foundTimeSec } : undefined;
}
