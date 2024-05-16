import { ScoringTrack } from '../optimizer';

/**
 * merge multiple tracks into one track.
 * it removes duplicated points between each end and start of consecutive tracks
 * @param tracks the tracks to concatenate
 * @return a track
 */
export function mergeTracks(...tracks: ScoringTrack[]): ScoringTrack {
  const concatenated: ScoringTrack = {
    points: [],
    startTimeSec: 0,
  };

  for (const track of tracks) {
    const skipFirstPoint =
      concatenated.points.at(-1)?.lat === track.points[0].lat &&
      concatenated.points.at(-1)?.lon === track.points[0].lon;
    const arrayToConcat = skipFirstPoint ? track.points.slice(1) : track.points;
    concatenated.points = concatenated.points.concat(arrayToConcat);
  }
  return concatenated;
}
