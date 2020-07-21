import { getDistance } from 'geolib';

import { RuntimeFixes, RuntimeTrack } from './track';

// Computes the maximum distance between two consecutive fixes of a track.
export function computeMaxDistance(fixes: RuntimeFixes): number {
  let max = 0;
  for (let i = 1; i < fixes.lat.length; i++) {
    const a = { lat: fixes.lat[i - 1], lon: fixes.lon[i - 1] };
    const b = { lat: fixes.lat[i], lon: fixes.lon[i] };
    max = Math.max(getDistance(a, b), max);
  }
  return max;
}

// Finds the closest fix to {lat, lon} across all the tracks.
export function findClosestFix(tracks: RuntimeTrack[], lat: number, lon: number): { track: number; ts: number } | null {
  let track = 0;
  let ts: number | null = null;
  let distance = 10000;
  const ref = { lat, lon };
  tracks.forEach((t, tIdx) => {
    for (let fixIdx = 0; fixIdx < t.fixes.lat.length; ) {
      const lat = t.fixes.lat[fixIdx];
      const lon = t.fixes.lon[fixIdx];
      const d = getDistance(ref, { lat, lon });
      if (d < distance) {
        ts = t.fixes.ts[fixIdx];
        track = tIdx;
        distance = d;
        fixIdx++;
      } else {
        fixIdx += Math.max(1, Math.floor((d - distance) / t.maxDistance));
      }
    }
  });

  return ts ? { track, ts } : null;
}
