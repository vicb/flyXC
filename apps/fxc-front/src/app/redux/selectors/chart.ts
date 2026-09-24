import type { protos, RuntimeTrack } from '@flyxc/common';
import { isGroundAltitudeValid } from '@flyxc/common';
import { createSelector } from '@reduxjs/toolkit';

import type { ChartTrack } from '../../components/chart-element';
import { ChartYAxis } from '../../components/chart-element';
import { getUniqueContrastColor } from '../../styles/track';
import { selectChartYAxis } from '../app-slice';
import { getSanitizedLiveGroundAltitude, selectActiveLiveTrack, selectSelectedLiveTrack } from '../live-track-slice';
import {
  selectAllTracks,
  selectCurrentTrackId,
  selectMaxAlt,
  selectMaxSpeed,
  selectMaxTimeSec,
  selectMaxVario,
  selectMinAlt,
  selectMinSpeed,
  selectMinTimeSec,
  selectMinVario,
  selectOffsetSeconds,
  selectTrackColors,
  selectTrackTotal,
} from '../track-slice';

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
 * Whether any track (runtime or live) is available to display on the elevation chart.
 */
export const selectHasChartTrack = createSelector(
  [selectTrackTotal, selectSelectedLiveTrack],
  (numTracks, liveTrack): boolean => numTracks > 0 || liveTrack != null,
);

/**
 * Returns the tracks to be displayed on the elevation chart.
 *
 * When a live track is selected, only its active (last) segment is returned.
 * When runtime tracks are active, all loaded runtime tracks are returned with their assigned colors and offsets.
 */
export const selectChartTracks = createSelector(
  [selectActiveLiveTrack, selectAllTracks, selectTrackColors, selectOffsetSeconds],
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
  [selectActiveLiveTrack, selectMinTimeSec],
  (liveTrack, rtMinTimeSec): number => {
    if (liveTrack != null && liveTrack.timeSec.length > 0) {
      return liveTrack.timeSec[0];
    }
    return rtMinTimeSec;
  },
);

/**
 * Returns the maximum timestamp in seconds for the elevation chart X axis.
 */
export const selectChartMaxTimeSec = createSelector(
  [selectActiveLiveTrack, selectMaxTimeSec],
  (liveTrack, rtMaxTimeSec): number => {
    if (liveTrack != null && liveTrack.timeSec.length > 0) {
      return liveTrack.timeSec[liveTrack.timeSec.length - 1];
    }
    return rtMaxTimeSec;
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
  [selectActiveLiveTrack, selectChartYAxis, selectMinAlt, selectMinSpeed, selectMinVario],
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
export const selectChartMaxY = createSelector(
  [selectActiveLiveTrack, selectChartYAxis, selectMaxAlt, selectMaxSpeed, selectMaxVario],
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
