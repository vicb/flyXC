import type { LatLon, LatLonAlt, protos, RuntimeTrack } from '@flyxc/common';
import { extractGroupId, isGroundAltitudeValid, sampleAt } from '@flyxc/common';
import { createSelector } from '@reduxjs/toolkit';

import type { ChartTrack } from '../components/chart-element';
import { ChartYAxis } from '../components/chart-element';
import { getActiveTrackSegment } from '../logic/live-track';
import { DistanceUnit } from '../logic/units';
import { getUniqueColor, getUniqueContrastColor } from '../styles/track';
import { selectChartYAxis, selectTimeSec } from './app-slice';
import { selectCurrentLiveId, selectLiveTrackEntities } from './live-track-slice';
import type { RootState } from './store';
import { selectCurrentTrackId, trackAdapterSelector } from './track-slice';
import { selectUnits } from './units-slice';

export const units = selectUnits;
export const altitudeUnits = createSelector(units, (units) => units.altitude);
export const tracks = trackAdapterSelector.selectAll;
export const currentTrack = (state: RootState): RuntimeTrack | undefined => {
  const trackId = selectCurrentTrackId(state);
  return trackId ? trackAdapterSelector.selectById(state, trackId) : undefined;
};
export const currentTrackId = selectCurrentTrackId;
export const currentLiveId = selectCurrentLiveId;
export const numTracks = trackAdapterSelector.selectTotal;

export const groupIds = (state: RootState): Set<number> =>
  new Set(trackAdapterSelector.selectIds(state).map((trackId) => extractGroupId(String(trackId))));

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
  if (tracks.length > 0) {
    const referenceTrack = currentTrack ?? tracks[0];
    const start = referenceTrack.timeSec[0];
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
  t.map((t) => t.maxTimeSec - (offsetSeconds[t.id] ?? 0)),
);
export const maxTimeSec = createSelector(maxTimeSecs, (timeSecs) => (timeSecs.length ? Math.max(...timeSecs) : 1));

export const minTimeSecs = createSelector(tracks, offsetSeconds, (tracks, offsetSeconds) =>
  tracks.map((t) => t.minTimeSec - (offsetSeconds[t.id] ?? 0)),
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

export const selectedLiveTrack = createSelector(
  currentLiveId,
  selectLiveTrackEntities,
  (id, entities): protos.LiveTrack | undefined => (id && entities ? entities[id] : undefined),
);

/**
 * Returns the active segment of the selected live track (the last segment after any gap >= TRACK_GAP_MIN).
 *
 * If the track contains gaps, earlier segments are drawn as dashed lines on the map and only
 * the last segment is considered active (shown on the elevation chart and followed by the moving dot).
 */
export const activeLiveTrack = createSelector(selectedLiveTrack, (track): protos.LiveTrack | undefined =>
  track ? getActiveTrackSegment(track) : undefined,
);

/**
 * Whether a live track is currently selected.
 */
export const isLiveTrackSelected = createSelector(selectedLiveTrack, (track): boolean => track != null);

/**
 * Whether any track (runtime or live) is available to display on the elevation chart.
 */
export const hasChartTrack = createSelector(
  numTracks,
  selectedLiveTrack,
  (numTracks, liveTrack): boolean => numTracks > 0 || liveTrack != null,
);

/**
 * Returns a sampling function that computes the latitude, longitude, and altitude of the active track at a given timestamp.
 *
 * @returns A function `(timeSec, track?) => LatLonAlt | undefined`.
 */
export const getTrackLatLonAlt = createSelector(
  activeLiveTrack,
  currentTrack,
  (activeLiveTrack, currentTrack) =>
    (timeSec: number, track?: RuntimeTrack | protos.LiveTrack): LatLonAlt | undefined => {
      track ??= activeLiveTrack ?? currentTrack;
      if (track == null) {
        return;
      }
      const lat = sampleAt(track.timeSec, track.lat, timeSec);
      const lon = sampleAt(track.timeSec, track.lon, timeSec);
      const alt = sampleAt(track.timeSec, track.alt, timeSec);
      return { lat, lon, alt };
    },
);

/**
 * Sanitizes ground altitude samples for a live track by replacing invalid samples
 * (e.g. NO_GROUND_ALTITUDE = 9999) with the corresponding flight altitude.
 *
 * This prevents sampleAt from interpolating across 9999 sentinel values, which would
 * otherwise produce blended pseudo-elevations far above the actual flight path.
 *
 * @param liveTrack - The live track containing ground and flight altitude arrays.
 * @returns An array of sanitized ground altitude values, or undefined if gndAlt is missing or mismatched.
 */
export function getSanitizedLiveGroundAltitude(liveTrack: protos.LiveTrack): number[] | undefined {
  if (liveTrack.gndAlt && liveTrack.gndAlt.length === liveTrack.timeSec.length) {
    return liveTrack.gndAlt.map((g, i) => (isGroundAltitudeValid(g) ? g : liveTrack.alt[i]));
  }
  return undefined;
}

/**
 * Returns a sampling function that computes the ground altitude of the active track at a given timestamp.
 *
 * @returns A function `(timeSec, track?) => number | undefined`.
 */
export const getGndAlt = createSelector(
  activeLiveTrack,
  currentTrack,
  (activeLiveTrack, currentTrack) =>
    (timeSec: number, track?: RuntimeTrack | protos.LiveTrack): number | undefined => {
      track ??= activeLiveTrack ?? currentTrack;
      if (track == null) {
        return 0;
      }
      if ('flags' in track) {
        const sanitizedGnd = getSanitizedLiveGroundAltitude(track);
        return sanitizedGnd ? sampleAt(track.timeSec, sanitizedGnd, timeSec) : undefined;
      }
      if (!track.gndAlt) {
        return 0;
      }
      return sampleAt(track.timeSec, track.gndAlt, timeSec);
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

/**
 * Converts a live track into a ChartTrack object suitable for the elevation chart.
 *
 * @param liveTrack - The live track protobuf object.
 * @returns A ChartTrack instance.
 */
function liveTrackToChartTrack(liveTrack: protos.LiveTrack): ChartTrack {
  const id = String(liveTrack.id ?? liveTrack.idStr);
  const color = getUniqueContrastColor(id);
  const timeSec = liveTrack.timeSec;
  const alt = liveTrack.alt;
  const minTimeSec = timeSec.length > 0 ? timeSec[0] : 0;
  const maxTimeSec = timeSec.length > 0 ? timeSec[timeSec.length - 1] : 1;

  const gndAlt = getSanitizedLiveGroundAltitude(liveTrack);

  const validGnd = (gndAlt ?? []).filter(isGroundAltitudeValid);
  const minAlt = alt.length > 0 ? Math.min(...alt, ...(validGnd.length ? validGnd : [])) : 0;
  const maxAlt = alt.length > 0 ? Math.max(...alt) : 1;

  return {
    id,
    name: liveTrack.name,
    color,
    timeSec,
    alt,
    gndAlt,
    offsetSeconds: 0,
    minTimeSec,
    maxTimeSec,
    minAlt,
    maxAlt,
    isLive: true,
  };
}

/**
 * Converts a RuntimeTrack into a ChartTrack object.
 *
 * @param track - The runtime track object.
 * @param color - The unique color assigned to this track.
 * @param offsetSeconds - The multi-day offset in seconds.
 * @returns A ChartTrack instance.
 */
function runtimeTrackToChartTrack(track: RuntimeTrack, color: string, offsetSeconds: number): ChartTrack {
  return {
    id: track.id,
    name: track.name,
    color,
    timeSec: track.timeSec,
    alt: track.alt,
    gndAlt: track.gndAlt,
    vx: track.vx,
    vz: track.vz,
    airspaces: track.airspaces,
    offsetSeconds,
    minAlt: track.minAlt,
    maxAlt: track.maxAlt,
    minVx: track.minVx,
    maxVx: track.maxVx,
    minVz: track.minVz,
    maxVz: track.maxVz,
    minTimeSec: track.minTimeSec,
    maxTimeSec: track.maxTimeSec,
  };
}

/**
 * Returns the tracks to be displayed on the elevation chart.
 *
 * When a live track is selected, only its active (last) segment is returned.
 * When runtime tracks are active, all loaded runtime tracks are returned.
 */
export const chartTracks = createSelector(
  activeLiveTrack,
  tracks,
  trackColors,
  offsetSeconds,
  (activeLive, rtTracks, colors, offsets): ChartTrack[] => {
    if (activeLive != null) {
      return [liveTrackToChartTrack(activeLive)];
    }
    return rtTracks.map((t) => runtimeTrackToChartTrack(t, colors[t.id] ?? 'black', offsets[t.id] ?? 0));
  },
);

/**
 * Returns the track ID of the currently active/highlighted track on the chart.
 */
export const chartActiveTrackId = createSelector(
  activeLiveTrack,
  currentTrackId,
  (liveTrack, rtCurrentId): string | undefined => {
    if (liveTrack != null) {
      return String(liveTrack.id ?? liveTrack.idStr);
    }
    return rtCurrentId;
  },
);

/**
 * Returns the minimum timestamp in seconds for the elevation chart X axis.
 */
export const chartMinTimeSec = createSelector(activeLiveTrack, minTimeSec, (liveTrack, rtMinTimeSec): number => {
  if (liveTrack != null && liveTrack.timeSec.length > 0) {
    return liveTrack.timeSec[0];
  }
  return rtMinTimeSec;
});

/**
 * Returns the maximum timestamp in seconds for the elevation chart X axis.
 */
export const chartMaxTimeSec = createSelector(activeLiveTrack, maxTimeSec, (liveTrack, rtMaxTimeSec): number => {
  if (liveTrack != null && liveTrack.timeSec.length > 0) {
    return liveTrack.timeSec[liveTrack.timeSec.length - 1];
  }
  return rtMaxTimeSec;
});

/**
 * Returns the available Y axes for the chart (Altitude only for live tracks; Altitude, Speed, Vario for runtime tracks).
 */
export const chartAvailableYAxes = createSelector(activeLiveTrack, (liveTrack): ChartYAxis[] => {
  if (liveTrack != null) {
    return [ChartYAxis.Altitude];
  }
  return [ChartYAxis.Altitude, ChartYAxis.Speed, ChartYAxis.Vario];
});

/**
 * Returns the minimum Y value for the current chart mode.
 */
export const chartMinY = createSelector(
  activeLiveTrack,
  selectChartYAxis,
  minAlt,
  minSpeed,
  minVario,
  (liveTrack, yAxis, rtMinAlt, rtMinSpeed, rtMinVario): number => {
    if (liveTrack != null) {
      if (liveTrack.alt.length === 0) {
        return 0;
      }
      const sanitizedGnd = getSanitizedLiveGroundAltitude(liveTrack);
      const validGnd = (sanitizedGnd ?? []).filter(isGroundAltitudeValid);
      return Math.min(...liveTrack.alt, ...(validGnd.length ? validGnd : []));
    }
    switch (yAxis) {
      case ChartYAxis.Speed:
        return rtMinSpeed;
      case ChartYAxis.Vario:
        return rtMinVario;
      default:
        return rtMinAlt;
    }
  },
);

/**
 * Returns the maximum Y value for the current chart mode.
 */
export const chartMaxY = createSelector(
  activeLiveTrack,
  selectChartYAxis,
  maxAlt,
  maxSpeed,
  maxVario,
  (liveTrack, yAxis, rtMaxAlt, rtMaxSpeed, rtMaxVario): number => {
    if (liveTrack != null) {
      return liveTrack.alt.length > 0 ? Math.max(...liveTrack.alt) : 1;
    }
    switch (yAxis) {
      case ChartYAxis.Speed:
        return rtMaxSpeed;
      case ChartYAxis.Vario:
        return rtMaxVario;
      default:
        return rtMaxAlt;
    }
  },
);

export interface ActiveDashboardData {
  hasTrack: boolean;
  alt: number;
  gndAlt?: number;
  vz?: number;
  vx?: number;
  timeSec: number;
}

/**
 * Whether there is any active track (live or runtime) selected.
 */
export const hasActiveTrack = createSelector(
  activeLiveTrack,
  currentTrack,
  (liveTrack, rtTrack): boolean => liveTrack != null || rtTrack != null,
);

/**
 * Returns the name of the pilot for the currently active track.
 */
export const activePilotName = createSelector(
  activeLiveTrack,
  currentTrack,
  (liveTrack, rtTrack): string | undefined => {
    if (liveTrack != null) {
      return liveTrack.name ?? 'Pilot';
    }
    return rtTrack?.name;
  },
);

/**
 * Returns the display color for the currently active track.
 */
export const activePilotColor = createSelector(
  activeLiveTrack,
  currentTrack,
  trackColors,
  (liveTrack, rtTrack, colors): string => {
    if (liveTrack != null) {
      return getUniqueContrastColor(String(liveTrack.id ?? liveTrack.idStr));
    }
    if (rtTrack != null) {
      return colors[rtTrack.id] ?? 'black';
    }
    return 'black';
  },
);

/**
 * Samples telemetry data (altitude, ground altitude, speed, vario) at the current app timestamp
 * for the active track.
 */
export const activeDashboardData = createSelector(
  activeLiveTrack,
  currentTrack,
  selectTimeSec,
  (liveTrack, rtTrack, timeSec): ActiveDashboardData => {
    if (liveTrack != null) {
      if (liveTrack.timeSec.length === 0) {
        return { hasTrack: true, alt: 0, timeSec };
      }
      const alt = sampleAt(liveTrack.timeSec, liveTrack.alt, timeSec);
      const sanitizedGnd = getSanitizedLiveGroundAltitude(liveTrack);
      const gndAlt = sanitizedGnd ? sampleAt(liveTrack.timeSec, sanitizedGnd, timeSec) : undefined;
      return {
        hasTrack: true,
        alt,
        gndAlt,
        timeSec,
      };
    }

    if (rtTrack != null) {
      if (rtTrack.timeSec.length === 0) {
        return { hasTrack: true, alt: 0, timeSec };
      }
      const alt = sampleAt(rtTrack.timeSec, rtTrack.alt, timeSec);
      const gndAlt = rtTrack.gndAlt ? sampleAt(rtTrack.timeSec, rtTrack.gndAlt, timeSec) : undefined;
      const vz = rtTrack.vz ? sampleAt(rtTrack.timeSec, rtTrack.vz, timeSec) : undefined;
      const vx = rtTrack.vx ? sampleAt(rtTrack.timeSec, rtTrack.vx, timeSec) : undefined;
      return {
        hasTrack: true,
        alt,
        gndAlt,
        vz,
        vx,
        timeSec,
      };
    }

    return {
      hasTrack: false,
      alt: 0,
      timeSec,
    };
  },
);
