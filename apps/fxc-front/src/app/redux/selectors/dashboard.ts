import { sampleAt } from '@flyxc/common';
import { createSelector } from '@reduxjs/toolkit';

import { getUniqueContrastColor } from '../../styles/track';
import { selectTimeSec } from '../app-slice';
import { getSanitizedLiveGroundAltitude, selectActiveLiveTrack } from '../live-track-slice';
import { selectCurrentTrack, selectTrackColors } from '../track-slice';

/**
 * Real-time telemetry data sampled for the active track at the current application timestamp.
 */
export interface ActiveDashboardData {
  /** Whether an active track exists. */
  hasTrack: boolean;
  /** Current flight altitude in meters. */
  alt: number;
  /** Ground altitude at current position in meters (if available). */
  gndAlt?: number;
  /** Vertical speed (vario) in m/s (runtime tracks only). */
  vz?: number;
  /** Horizontal speed in km/h (runtime tracks only). */
  vx?: number;
  /** Timestamp of the sample in seconds. */
  timeSec: number;
}

/**
 * Whether there is any active track (live or runtime) selected.
 */
export const selectHasActiveTrack = createSelector(
  [selectActiveLiveTrack, selectCurrentTrack],
  (liveTrack, rtTrack): boolean => liveTrack != null || rtTrack != null,
);

/**
 * Returns the name of the pilot for the currently active track.
 *
 * For live tracks, defaults to 'Pilot' if no name is specified.
 */
export const selectActivePilotName = createSelector(
  [selectActiveLiveTrack, selectCurrentTrack],
  (liveTrack, rtTrack): string | undefined => {
    if (liveTrack != null) {
      return liveTrack.name ?? 'Pilot';
    }
    return rtTrack?.name;
  },
);

/**
 * Returns the display color for the currently active track.
 *
 * For live tracks, computes a unique contrast color based on the track ID.
 * For runtime tracks, looks up the assigned track color.
 */
export const selectActivePilotColor = createSelector(
  [selectActiveLiveTrack, selectCurrentTrack, selectTrackColors],
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
 * for the active track (prioritizing live track, falling back to runtime track).
 */
export const selectActiveDashboardData = createSelector(
  [selectActiveLiveTrack, selectCurrentTrack, selectTimeSec],
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
