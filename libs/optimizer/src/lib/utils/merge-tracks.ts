import type { LatLonAltTime, ScoringTrack } from '../optimizer';

/**
 * Merge multiple tracks.
 *
 * Collapse end and start point of consecutive tracks when they match.
 *
 * @param tracks the tracks to concatenate
 * @returns a track
 */
export function mergeTracks(...tracks: ScoringTrack[]): ScoringTrack {
  const points: LatLonAltTime[] = [];

  for (const track of tracks) {
    if (track.points.length == 0) {
      continue;
    }
    const collapse = points.at(-1)?.lat === track.points[0].lat && points.at(-1)?.lon === track.points[0].lon;
    points.push(...(collapse ? track.points.slice(1) : track.points));
  }
  return { points };
}
