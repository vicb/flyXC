import { createSelector } from 'reselect';

import { LatLon, RuntimeTrack } from '../../../common/track';
import { sampleAt } from './logic/math';
import { UNITS } from './logic/units';
import { MapState, Units } from './reducers';

export const league = (state: MapState): string => state.league;
export const tracks = (state: MapState): RuntimeTrack[] => state.tracks;
export const currentTrackIndex = (state: MapState): number => state.currentTrackIndex;
export const aspAltitude = (state: MapState): number => state.aspAltitude;
export const units = (state: MapState): Units => state.units;
export const currentTrack = createSelector(tracks, currentTrackIndex, (tracks, idx) =>
  tracks ? tracks[idx] : undefined,
);
export const activeFixes = createSelector(currentTrack, (track) => (track ? track.fixes : undefined));
export const name = createSelector(currentTrack, (track) => (track ? track.name : ''));
export const altitudeUnits = createSelector(units, (units) => units.altitude);

// isMultiDay is true if tracks starts are more than 12h apart
export const isMultiDay = createSelector(tracks, (tracks) => {
  if (tracks.length == 0) {
    return false;
  }
  const starts: number[] = tracks.map((t) => t.fixes.ts[0]);
  const delta = Math.max(...starts) - Math.min(...starts);
  return delta > 12 * 3600 * 1000;
});

// offset to subtract to each track timestamp to have them started
// at the same time as the current one
export const tsOffsets = createSelector(tracks, currentTrackIndex, isMultiDay, (tracks, trackIndex, isMultiDay) => {
  if (tracks.length == 0) {
    return [];
  }
  const currentStart = tracks[trackIndex].fixes.ts[0];
  return tracks.map((t) => (isMultiDay ? t.fixes.ts[0] - currentStart : 0));
});

// Coordinates

export const maxLats = createSelector(tracks, (tracks) => {
  const maxLats: number[] = [];
  tracks.forEach((track) => {
    maxLats.push(Math.max(...track.fixes.lat));
  });
  return maxLats;
});

export const maxLat = createSelector(maxLats, (lats) => Math.max(...lats));

export const maxLons = createSelector(tracks, (tracks) => {
  const maxLons: number[] = [];
  tracks.forEach((track) => {
    maxLons.push(Math.max(...track.fixes.lon));
  });
  return maxLons;
});

export const maxLon = createSelector(maxLons, (lons) => Math.max(...lons));

export const minLats = createSelector(tracks, (tracks) => {
  const minLats: number[] = [];
  tracks.forEach((track) => {
    minLats.push(Math.min(...track.fixes.lat));
  });
  return minLats;
});

export const minLat = createSelector(minLats, (lats) => Math.min(...lats));

export const minLons = createSelector(tracks, (tracks) => {
  const minLons: number[] = [];
  tracks.forEach((track) => {
    minLons.push(Math.min(...track.fixes.lon));
  });
  return minLons;
});

export const minLon = createSelector(minLons, (lons) => Math.min(...lons));

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

export const maxTss = createSelector(tracks, tsOffsets, (tracks, tsOffsets) => {
  const maxTss: number[] = [];
  tracks.forEach((track, i) => {
    maxTss.push(Math.max(...track.fixes.ts) - tsOffsets[i]);
  });
  return maxTss;
});

export const maxTs = createSelector(maxTss, (tss) => (tss.length ? Math.max(...tss) : 1));

export const minTss = createSelector(tracks, tsOffsets, (tracks, tsOffsets) => {
  const minTss: number[] = [];
  tracks.forEach((track, i) => {
    minTss.push(Math.min(...track.fixes.ts) - tsOffsets[i]);
  });
  return minTss;
});

export const minTs = createSelector(minTss, (tss) => (tss.length ? Math.min(...tss) : 0));

export const maxAlts = createSelector(tracks, (tracks) => {
  const maxAlts: number[] = [];
  tracks.forEach((track) => {
    maxAlts.push(Math.max(...track.fixes.alt));
  });
  return maxAlts;
});

// Maximum altitude across all the loaded tracks.
export const maxAlt = createSelector(maxAlts, (alts) => Math.max(...alts));

export const minAlts = createSelector(tracks, (tracks) => {
  const minAlts: number[] = [];
  tracks.forEach((track) => {
    minAlts.push(Math.min(...track.fixes.alt));
  });
  return minAlts;
});

export const minAlt = createSelector(minAlts, (alts) => Math.min(...alts));

export const maxSpeeds = createSelector(tracks, (tracks) => {
  const maxSpeeds: number[] = [];
  tracks.forEach((track) => {
    maxSpeeds.push(Math.max(...track.fixes.vx));
  });
  return maxSpeeds;
});

export const maxSpeed = createSelector(maxSpeeds, (speeds) => Math.max(...speeds));

export const minSpeeds = createSelector(tracks, (tracks) => {
  const minSpeeds: number[] = [];
  tracks.forEach((track) => {
    minSpeeds.push(Math.min(...track.fixes.vx));
  });
  return minSpeeds;
});

export const minSpeed = createSelector(minSpeeds, (speeds) => Math.min(...speeds));

export const maxVarios = createSelector(tracks, (tracks) => {
  const maxVarios: number[] = [];
  tracks.forEach((track) => {
    maxVarios.push(Math.max(...track.fixes.vz));
  });
  return maxVarios;
});

export const maxVario = createSelector(maxVarios, (varios) => Math.max(...varios));

export const minVarios = createSelector(tracks, (tracks) => {
  const minVarios: number[] = [];
  tracks.forEach((track) => {
    minVarios.push(Math.min(...track.fixes.vz));
  });
  return minVarios;
});

export const minVario = createSelector(minVarios, (varios) => Math.min(...varios));

// Returns a list of altitude stops for airspaces in meters.
export const aspAltitudeStops = createSelector(altitudeUnits, (units) => {
  const steps: number[] = [];
  if (units === UNITS.feet) {
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

// Return the current stop for the altitude select.
// This is the value greater or equal than the current asp altitude.
export const currentAspAltitudeStop = createSelector(aspAltitudeStops, aspAltitude, (stops, altitude) => {
  return stops.find((v: number) => v >= altitude) || stops[stop.length - 1];
});

// List of track ids.
export const trackIds = createSelector(tracks, (tracks: RuntimeTrack[]) => {
  return tracks.reduce((ids: number[], track: RuntimeTrack) => {
    if (track.id != null) {
      ids.push(track.id);
    }
    return ids;
  }, []);
});

// Returns a function that compute the coordinates of the current track at the given timestamp.
export const getTrackLatLon = createSelector(
  tracks,
  currentTrackIndex,
  (tracks, currentTrackIndex) => (timestamp: number, index?: number): LatLon | null => {
    if (tracks.length == 0) {
      return null;
    }
    const fixes = tracks[index ?? currentTrackIndex].fixes;
    const lat = sampleAt(fixes.ts, fixes.lat, timestamp);
    const lon = sampleAt(fixes.ts, fixes.lon, timestamp);
    const alt = sampleAt(fixes.ts, fixes.alt, timestamp);
    return { lat, lon, alt };
  },
);
