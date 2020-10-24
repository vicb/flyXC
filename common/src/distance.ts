import { getDistance } from 'geolib';

import { RuntimeTrack } from './track';

// Finds the closest fix to {lat, lon} across all the tracks.
export function findClosestFix(
  tracks: RuntimeTrack[],
  lat: number,
  lon: number,
): { track: RuntimeTrack; timestamp: number } | undefined {
  let foundTrack: RuntimeTrack | undefined;
  let foundTimestamp = 0;
  let foundDistance = 10000;
  const ref = { lat, lon };
  tracks.forEach((track) => {
    for (let fixIdx = 0; fixIdx < track.lat.length; ) {
      const lat = track.lat[fixIdx];
      const lon = track.lon[fixIdx];
      const d = getDistance(ref, { lat, lon });
      if (d < foundDistance) {
        foundTimestamp = track.ts[fixIdx];
        foundTrack = track;
        foundDistance = d;
        fixIdx++;
      } else {
        fixIdx += Math.max(1, Math.floor((d - foundDistance) / track.maxDistance));
      }
    }
  });

  return foundTrack != null ? { track: foundTrack, timestamp: foundTimestamp } : undefined;
}
