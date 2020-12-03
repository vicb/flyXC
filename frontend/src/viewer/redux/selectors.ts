import { sampleAt } from 'flyxc/common/src/math';
import { extractGroupId, LatLon, LatLonZ, RuntimeTrack } from 'flyxc/common/src/runtime-track';
import { createSelector } from 'reselect';

import { DistanceUnit, Units } from '../logic/units';
import { getUniqueColor } from '../styles/track';
import { RootState } from './store';
import { trackAdapterSelector } from './track-slice';

export const unitsState = (state: RootState): Units => state.units;
export const altitudeUnits = createSelector(unitsState, (units) => units.altitude);
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
  const minTs = Math.min(...tracks.map((t) => t.ts[0]));
  const maxTs = Math.max(...tracks.map((t) => t.ts[t.ts.length - 1]));
  return maxTs - minTs > 12 * 3600 * 1000;
});

// Offset to subtract to each track timestamp to have them started at the same time as the current one.
export const tsOffsets = createSelector(tracks, currentTrack, isMultiDay, (tracks, currentTrack, isMultiDay) => {
  const offsets: { [id: string]: number } = {};
  if (tracks.length > 0 && currentTrack != null) {
    const start = currentTrack.ts[0];
    tracks.forEach((track) => {
      offsets[track.id] = isMultiDay ? track.ts[0] - start : 0;
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

export const maxTimestamps = createSelector(tracks, tsOffsets, (t, tsOffsets) =>
  t.map((t) => t.ts[t.ts.length - 1] - tsOffsets[t.id]),
);
export const maxTimestamp = createSelector(maxTimestamps, (tss) => (tss.length ? Math.max(...tss) : 1));

export const minTimestamps = createSelector(tracks, tsOffsets, (tracks, tsOffsets) =>
  tracks.map((t) => t.ts[0] - tsOffsets[t.id]),
);
export const minTimestamp = createSelector(minTimestamps, (tss) => (tss.length ? Math.min(...tss) : 0));

export const maxAlts = createSelector(tracks, (tracks) => tracks.map((t) => t.maxAlt));
export const maxAlt = createSelector(maxAlts, (alts) => Math.max(...alts));

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

// Returns a function that compute the coordinates of the current track at the given timestamp.
export const getTrackLatLonAlt = createSelector(
  currentTrack,
  (currentTrack) => (timestamp: number, track?: RuntimeTrack): LatLonZ | undefined => {
    track ??= currentTrack;
    if (track == null) {
      return;
    }
    const lat = sampleAt(track.ts, track.lat, timestamp);
    const lon = sampleAt(track.ts, track.lon, timestamp);
    const alt = sampleAt(track.ts, track.alt, timestamp);
    return { lat, lon, alt };
  },
);

// Returns a function that compute the lookAt coordinates at the given timestamp.
export const getLookAtLatLonAlt = createSelector(
  currentTrack,
  (currentTrack) => (timestamp: number, track?: RuntimeTrack): LatLonZ | undefined => {
    track ??= currentTrack;
    if (track == null) {
      return;
    }
    if (track.lookAtLat == null || track.lookAtLon == null) {
      return;
    }
    const lat = sampleAt(track.ts, track.lookAtLat, timestamp);
    const lon = sampleAt(track.ts, track.lookAtLon, timestamp);
    const alt = sampleAt(track.ts, track.alt, timestamp);
    return { lat, lon, alt };
  },
);

export const trackColors = createSelector(trackAdapterSelector.selectIds, (ids) => {
  const colors: { [id: string]: string } = {};
  ids.forEach((id, i) => {
    colors[id] = getUniqueColor(i);
  });
  return colors;
});
