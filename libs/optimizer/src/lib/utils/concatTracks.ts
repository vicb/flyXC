import { ScoringTrack } from '../optimizer';

/**
 * concatenate multiple tracks into one track.
 * it removes duplicated points between each end and start of consecutive tracks
 * @param tracks the tracks to concatenate
 * @return a track
 */
export function concatTracks(...tracks: ScoringTrack[]): ScoringTrack {
  const concatenated: ScoringTrack = {
    lat: [],
    lon: [],
    alt: [],
    timeSec: [],
    minTimeSec: 0,
  };

  for (const track of tracks) {
    const skipFirstPoint = concatenated.lat.at(-1) === track.lat[0] && concatenated.lat.at(-1) === track.lat[0];
    for (const key of ['lat', 'lon', 'alt', 'timeSec']) {
      const arrayToConcat = skipFirstPoint ? track[key].slice(1) : track[key];
      concatenated[key] = concatenated[key].concat(arrayToConcat);
    }
  }
  return concatenated;
}
