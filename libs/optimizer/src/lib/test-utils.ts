import type { LatLon, LatLonAltTime, ScoringTrack } from './optimizer';

/**
 * Creates a track with segments (test utility only).
 *
 * Points are computed by a linear interpolation
 *
 * @returns a ScoringTrack of nbSegments
 */
export function createSegments(startPoint: LatLonAltTime, endPoint: LatLonAltTime, nbSegments: number): ScoringTrack {
  const points: LatLonAltTime[] = [];

  points.push(startPoint);

  const deltaLat = (endPoint.lat - startPoint.lat) / nbSegments;
  const deltaLon = (endPoint.lon - startPoint.lon) / nbSegments;
  const deltaAlt = (endPoint.alt - startPoint.alt) / nbSegments;
  const deltaTimeSec = (endPoint.timeSec - startPoint.timeSec) / nbSegments;
  for (let index = 1; index < nbSegments; index++) {
    points.push({
      lat: startPoint.lat + deltaLat * index,
      lon: startPoint.lon + deltaLon * index,
      alt: Math.round(startPoint.alt + deltaAlt * index),
      timeSec: Math.round(startPoint.timeSec + deltaTimeSec * index),
    });
  }

  points.push(endPoint);

  return { points };
}

/**
 * Merge multiple tracks (test utility only).
 *
 * Collapse end and start point of consecutive tracks when they match.
 *
 * @param tracks the tracks to concatenate
 * @returns a track
 */
export function mergeTracks(...tracks: ScoringTrack[]): ScoringTrack {
  const points: LatLon[] = [];

  for (const track of tracks) {
    if (track.points.length == 0) {
      continue;
    }
    const collapse = points.at(-1)?.lat === track.points[0].lat && points.at(-1)?.lon === track.points[0].lon;
    points.push(...(collapse ? track.points.slice(1) : track.points));
  }
  return { points };
}

