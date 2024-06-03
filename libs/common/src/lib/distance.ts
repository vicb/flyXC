import { getDistance } from 'geolib';

import type { RuntimeTrack } from './runtime-track';

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
