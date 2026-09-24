import type { LatLonAlt, protos, RuntimeTrack } from '@flyxc/common';
import { sampleAt } from '@flyxc/common';
import { createSelector } from '@reduxjs/toolkit';

import { getSanitizedLiveGroundAltitude, selectActiveLiveTrack } from '../live-track-slice';
import { selectCurrentTrack } from '../track-slice';

/**
 * Returns a sampling function that computes the latitude, longitude, and altitude of the active track at a given timestamp.
 *
 * Checks the active live track first, and falls back to the current runtime track.
 *
 * @returns A function `(timeSec, track?) => LatLonAlt | undefined`.
 */
export const selectTrackLatLonAlt = createSelector(
  [selectActiveLiveTrack, selectCurrentTrack],
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
 * Returns a sampling function that computes the ground altitude of the active track at a given timestamp.
 *
 * Supports both live tracks (sanitizing sentinel no-ground values) and runtime tracks.
 *
 * @returns A function `(timeSec, track?) => number | undefined`.
 */
export const selectTrackGndAlt = createSelector(
  [selectActiveLiveTrack, selectCurrentTrack],
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

/**
 * Returns a function that computes the 3D camera lookAt coordinates at the given time in seconds
 * for the current runtime track.
 *
 * @returns A function `(timeSec, track?) => LatLonAlt | undefined`.
 */
export const selectLookAtLatLonAlt = createSelector(
  [selectCurrentTrack],
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
