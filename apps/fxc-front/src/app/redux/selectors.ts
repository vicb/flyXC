import type { LatLon, LatLonAlt, RuntimeTrack } from '@flyxc/common';
import { extractGroupId, sampleAt } from '@flyxc/common';
import { createSelector } from 'reselect';

import type { Units } from '../logic/units';
import { DistanceUnit } from '../logic/units';
import { getUniqueColor } from '../styles/track';
import type { RootState } from './store';
import { trackAdapterSelector } from './track-slice';

export const units = (state: RootState): Units => state.units;
export const altitudeUnits = createSelector(units, (units) => units.altitude);
export const tracks = trackAdapterSelector.selectAll;
export const currentTrack = (state: RootState): RuntimeTrack | undefined =>
  state.track.currentTrackId ? trackAdapterSelector.selectById(state, state.track.currentTrackId) : undefined;
export const currentTrackId = (state: RootState): string | undefined => state.track.currentTrackId;
export const numTracks = trackAdapterSelector.selectTotal;

export const groupIds = (state: RootState): Set<number> =>
  new Set(state.track.tracks.ids.map((trackId) => extractGroupId(String(trackId))));

// isMultiDay is true if tracks starts are more than 12h apart.
export const isMultiDay = createSelector(tracks, (tracks): boolean => {
  if (tracks.length == 0) {
    return false;
  }
  const startTimesSec = tracks.map((t) => t.minTimeSec);
  const minTimeSec = Math.min(...startTimesSec);
  const maxTimeSec = Math.max(...startTimesSec);
  return maxTimeSec - minTimeSec > 12 * 3600;
});

// Offset to subtract to each track timestamp to have them started at the same time as the current one.
export const offsetSeconds = createSelector(tracks, currentTrack, isMultiDay, (tracks, currentTrack, isMultiDay) => {
  const offsets: { [id: string]: number } = {};
  if (tracks.length > 0 && currentTrack != null) {
    const start = currentTrack.timeSec[0];
    tracks.forEach((track) => {
      offsets[track.id] = isMultiDay ? track.timeSec[0] - start : 0;
    });
  }
  return offsets;
});

// Min & Max for track values.

export const maxLats = createSelector(tracks, (tracks) => tracks.map((t) => t.maxLat));
export const maxLat = createSelector(maxLats, (lats) => Math.max(...lats));

export const maxLons = createSelector(tracks, (tracks) => tracks.map((t) => t.maxLon));
export const maxLon = createSelector(maxLons, (lons) => Math.max(...lons));

export const minLats = createSelector(tracks, (tracks) => tracks.map((t) => t.minLat));
export const minLat = createSelector(minLats, (lats) => Math.min(...lats));

export const minLons = createSelector(tracks, (tracks) => tracks.map((t) => t.minLon));
export const minLon = createSelector(minLons, (lons) => Math.min(...lons));

export const maxTimeSecs = createSelector(tracks, offsetSeconds, (t, offsetSeconds) =>
  t.map((t) => t.maxTimeSec - offsetSeconds[t.id]),
);
export const maxTimeSec = createSelector(maxTimeSecs, (timeSecs) => (timeSecs.length ? Math.max(...timeSecs) : 1));

export const minTimeSecs = createSelector(tracks, offsetSeconds, (tracks, offsetSeconds) =>
  tracks.map((t) => t.minTimeSec - offsetSeconds[t.id]),
);
export const minTimeSec = createSelector(minTimeSecs, (timeSecs) => (timeSecs.length ? Math.min(...timeSecs) : 0));

export const maxAlts = createSelector(tracks, (tracks) => tracks.map((t) => t.maxAlt));
export const maxAlt = createSelector(maxAlts, (alts) => (alts.length ? Math.max(...alts) : 0));

export const minAlts = createSelector(tracks, (tracks) => tracks.map((t) => t.minAlt));
export const minAlt = createSelector(minAlts, (alts) => Math.min(...alts));

export const maxSpeeds = createSelector(tracks, (tracks) => tracks.map((t) => t.maxVx));
export const maxSpeed = createSelector(maxSpeeds, (speeds) => Math.max(...speeds));

export const minSpeeds = createSelector(tracks, (tracks) => tracks.map((t) => t.minVx));
export const minSpeed = createSelector(minSpeeds, (speeds) => Math.min(...speeds));

export const maxVarios = createSelector(tracks, (tracks) => tracks.map((t) => t.maxVz));
export const maxVario = createSelector(maxVarios, (varios) => Math.max(...varios));

export const minVarios = createSelector(tracks, (tracks) => tracks.map((t) => t.minVz));
export const minVario = createSelector(minVarios, (varios) => Math.min(...varios));

// Return the bounding box of the tracks (null if no tracks).
export const tracksExtent = createSelector(
  tracks,
  minLat,
  minLon,
  maxLat,
  maxLon,
  (tracks, minLat, minLon, maxLat, maxLon): { ne: LatLon; sw: LatLon } | null => {
    if (tracks.length == 0) {
      return null;
    }
    return {
      ne: { lat: maxLat, lon: maxLon },
      sw: { lat: minLat, lon: minLon },
    };
  },
);

// Returns a list of altitude stops for airspaces in meters.
export const airspaceAltitudeStops = createSelector(altitudeUnits, (units) => {
  const steps: number[] = [];
  if (units === DistanceUnit.Feet) {
    for (let ft = 1000; ft <= 17000; ft += 1000) {
      const m = ft / 3.28084;
      steps.push(m);
    }
  } else {
    for (let m = 500; m <= 6000; m += 500) {
      steps.push(m);
    }
  }
  return steps;
});

// Returns a function that compute the coordinates of the current track at the given time in seconds.
export const getTrackLatLonAlt = createSelector(
  currentTrack,
  (currentTrack) =>
    (timeSec: number, track?: RuntimeTrack): LatLonAlt | undefined => {
      track ??= currentTrack;
      if (track == null) {
        return;
      }
      const lat = sampleAt(track.timeSec, track.lat, timeSec);
      const lon = sampleAt(track.timeSec, track.lon, timeSec);
      const alt = sampleAt(track.timeSec, track.alt, timeSec);
      return { lat, lon, alt };
    },
);

// Returns a function that compute the gnd altitude at the given time in seconds.
export const getGndAlt = createSelector(
  currentTrack,
  (currentTrack) =>
    (timeSec: number, track?: RuntimeTrack): number => {
      track ??= currentTrack;
      return track == null ? 0 : sampleAt(track.timeSec, track.gndAlt, timeSec);
    },
);

// Returns a function that compute the lookAt coordinates at the given time in seconds.
export const getLookAtLatLonAlt = createSelector(
  currentTrack,
  (currentTrack) =>
    (timeSec: number, track?: RuntimeTrack): LatLonAlt | undefined => {
      track ??= currentTrack;
      if (track == null) {
        return;
      }
      if (track.lookAtLat == null || track.lookAtLon == null) {
        return;
      }
      const lat = sampleAt(track.timeSec, track.lookAtLat, timeSec);
      const lon = sampleAt(track.timeSec, track.lookAtLon, timeSec);
      const alt = sampleAt(track.timeSec, track.alt, timeSec);
      return { lat, lon, alt };
    },
);

export const trackColors = createSelector(trackAdapterSelector.selectIds, (ids) => {
  const colors: { [id: string]: string } = {};
  ids.forEach((id, i) => {
    colors[id] = getUniqueColor(String(i), 1);
  });
  return colors;
});
