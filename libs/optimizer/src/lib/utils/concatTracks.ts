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

  function concat(track: ScoringTrack) {
    const concatLastIndex = concatenated.lat.length - 1;
    const lastLat = concatLastIndex >= 0 ? concatenated.lat[concatLastIndex] : undefined;
    const lastLon = concatLastIndex >= 0 ? concatenated.lon[concatLastIndex] : undefined;
    const trackFirstLat = track.lat[0];
    const trackFirstLon = track.lon[0];
    const skipFirstPoint = lastLat === trackFirstLat && lastLon === trackFirstLon;
    for (const key of ['lat', 'lon', 'alt', 'timeSec']) {
      const arrayToConcat = skipFirstPoint ? track[key].slice(1): track[key]
      concatenated[key] = concatenated[key].concat(arrayToConcat);
    }
  }

  for (const track of tracks) {
    concat(track);
  }
  return concatenated;
}
