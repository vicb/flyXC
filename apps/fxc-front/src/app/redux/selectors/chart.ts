import type { protos, RuntimeTrack } from '@flyxc/common';
import { arrayMax, arrayMin, isGroundAltitudeValid } from '@flyxc/common';
import { createSelector } from '@reduxjs/toolkit';

import type { ChartTrack } from '../../components/chart-element';
import { ChartYAxis } from '../../components/chart-element';
import { getUniqueContrastColor } from '../../styles/track';
import { selectChartYAxis } from '../app-slice';
import { getSanitizedLiveGroundAltitude, selectActiveLiveTrack, selectIsLiveTrackSelected } from '../live-track-slice';
import { selectAllTracks, selectCurrentTrackId, selectOffsetSeconds, selectTrackColors } from '../track-slice';

/**
 * Converts a live track into a ChartTrack object suitable for the elevation chart.
 *
 * @param liveTrack - The live track protobuf object.
 * @returns A ChartTrack instance.
 */
export function liveTrackToChartTrack(liveTrack: protos.LiveTrack): ChartTrack {
  const id = String(liveTrack.id ?? liveTrack.idStr);
  const color = getUniqueContrastColor(id);
  const timeSec = liveTrack.timeSec;
  const alt = liveTrack.alt;
  const minTimeSec = timeSec.length > 0 ? timeSec[0] : 0;
  const maxTimeSec = timeSec.length > 0 ? timeSec[timeSec.length - 1] : 1;

  const gndAlt = getSanitizedLiveGroundAltitude(liveTrack);

  const validGnd = (gndAlt ?? []).filter(isGroundAltitudeValid);
  const minAlt =
    alt.length > 0 ? (validGnd.length > 0 ? Math.min(arrayMin(alt), arrayMin(validGnd)) : arrayMin(alt)) : 0;
  const maxAlt = alt.length > 0 ? arrayMax(alt) : 1;

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
export function runtimeTrackToChartTrack(track: RuntimeTrack, color: string, offsetSeconds: number): ChartTrack {
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
 * Whether a track (live or runtime) has sufficient fixes and altitude data to be displayed on the elevation chart.
 *
 * @param track - The live or runtime track to evaluate.
 * @returns True if the track has at least 2 timestamp fixes and 2 altitude points, false otherwise.
 */
export function isTrackChartable<T extends protos.LiveTrack | RuntimeTrack>(track?: T | null): track is T {
  return track != null && track.timeSec.length >= 2 && track.alt.length >= 2;
}

/**
 * Returns only the runtime tracks that are chartable (at least 2 fixes and 2 altitude points).
 */
export const selectChartableTracks = createSelector([selectAllTracks], (tracks): RuntimeTrack[] =>
  tracks.filter(isTrackChartable),
);

/**
 * Returns the tracks to be displayed on the elevation chart.
 *
 * When a live track is selected, only its active (last) segment is returned, provided it has
 * at least 2 points to define an elevation profile.
 * When runtime tracks are active, all loaded runtime tracks with at least 2 points are returned.
 */
export const selectChartTracks = createSelector(
  [selectActiveLiveTrack, selectChartableTracks, selectTrackColors, selectOffsetSeconds, selectIsLiveTrackSelected],
  (activeLive, rtTracks, colors, offsets, isLiveSelected): ChartTrack[] => {
    if (isLiveSelected) {
      if (isTrackChartable(activeLive)) {
        return [liveTrackToChartTrack(activeLive)];
      }
      return [];
    }
    return rtTracks.map((t) => runtimeTrackToChartTrack(t, colors[t.id] ?? 'black', offsets[t.id] ?? 0));
  },
);

/**
 * Whether any track (runtime or live) is available to display on the elevation chart.
 */
export const selectHasChartTrack = createSelector(
  [selectChartTracks],
  (chartTracks): boolean => chartTracks.length > 0,
);

/**
 * Returns the track ID of the currently active/highlighted track on the chart.
 */
export const selectChartActiveTrackId = createSelector(
  [selectActiveLiveTrack, selectCurrentTrackId],
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
export const selectChartMinTimeSec = createSelector(
  [selectActiveLiveTrack, selectChartableTracks, selectOffsetSeconds],
  (liveTrack, rtTracks, offsets): number => {
    if (liveTrack != null && liveTrack.timeSec.length > 0) {
      return liveTrack.timeSec[0];
    }
    if (rtTracks.length === 0) {
      return 0;
    }
    return arrayMin(rtTracks.map((t) => t.minTimeSec - (offsets[t.id] ?? 0)));
  },
);

/**
 * Returns the maximum timestamp in seconds for the elevation chart X axis.
 */
export const selectChartMaxTimeSec = createSelector(
  [selectActiveLiveTrack, selectChartableTracks, selectOffsetSeconds],
  (liveTrack, rtTracks, offsets): number => {
    if (liveTrack != null && liveTrack.timeSec.length > 0) {
      return liveTrack.timeSec[liveTrack.timeSec.length - 1];
    }
    if (rtTracks.length === 0) {
      return 1;
    }
    return arrayMax(rtTracks.map((t) => t.maxTimeSec - (offsets[t.id] ?? 0)));
  },
);

/**
 * Returns the available Y axes for the chart (Altitude only for live tracks; Altitude, Speed, Vario for runtime tracks).
 */
export const selectChartAvailableYAxes = createSelector([selectActiveLiveTrack], (liveTrack): ChartYAxis[] => {
  if (liveTrack != null) {
    return [ChartYAxis.Altitude];
  }
  return [ChartYAxis.Altitude, ChartYAxis.Speed, ChartYAxis.Vario];
});

/**
 * Returns the minimum Y value for the current chart mode.
 */
export const selectChartMinY = createSelector(
  [selectActiveLiveTrack, selectChartYAxis, selectChartableTracks],
  (liveTrack, yAxis, rtTracks): number => {
    if (liveTrack != null) {
      if (liveTrack.alt.length === 0) {
        return 0;
      }
      const sanitizedGnd = getSanitizedLiveGroundAltitude(liveTrack);
      const validGnd = (sanitizedGnd ?? []).filter(isGroundAltitudeValid);
      return validGnd.length > 0 ? Math.min(arrayMin(liveTrack.alt), arrayMin(validGnd)) : arrayMin(liveTrack.alt);
    }
    if (rtTracks.length === 0) {
      return 0;
    }
    switch (yAxis) {
      case ChartYAxis.Speed:
        return arrayMin(rtTracks.map((t) => t.minVx));
      case ChartYAxis.Vario:
        return arrayMin(rtTracks.map((t) => t.minVz));
      default:
        return arrayMin(rtTracks.map((t) => t.minAlt));
    }
  },
);

/**
 * Returns the maximum Y value for the current chart mode.
 */
export const selectChartMaxY = createSelector(
  [selectActiveLiveTrack, selectChartYAxis, selectChartableTracks],
  (liveTrack, yAxis, rtTracks): number => {
    if (liveTrack != null) {
      return liveTrack.alt.length > 0 ? arrayMax(liveTrack.alt) : 1;
    }
    if (rtTracks.length === 0) {
      return 1;
    }
    switch (yAxis) {
      case ChartYAxis.Speed:
        return arrayMax(rtTracks.map((t) => t.maxVx));
      case ChartYAxis.Vario:
        return arrayMax(rtTracks.map((t) => t.maxVz));
      default:
        return arrayMax(
          rtTracks.map((t) => t.maxAlt),
          0,
        );
    }
  },
);
