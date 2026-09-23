import type { protos } from '@flyxc/common';
import {
  differentialDecodeLiveTrack,
  getFixMessage,
  isEmergencyFix,
  isEmergencyTrack,
  isGroundAltitudeValid,
  IsSimplifiableFix,
  isUfo,
  LiveTrackDurationSec,
  LiveTrackPointIntervalSec,
  mergeLiveTracks,
  simplifyLiveTrack,
  TRACK_GAP_MIN,
} from '@flyxc/common';
import { getRhumbLineBearing } from 'geolib';

export enum FixType {
  dot,
  pilot,
  message,
  emergency,
}

export type LivePointProperties = {
  id: string;
  pilotId: string;
  index: number;
  fixType: FixType;
  isUfo: boolean;
  alt: number;
  gndAlt: number | undefined;
  timeSec: number;
  name?: string;
  heading?: number;
  msg?: string;
};

export type LiveLineProperties = {
  id: string;
  firstIndex: number;
  lastIndex: number;
  lastTimeSec: number;
  isUfo: boolean;
  isEmergency: boolean;
  last: boolean;
};

/**
 * Returns the starting index of the last segment in a live track.
 *
 * A track is split into segments when there is a gap greater than `gapMin` minutes.
 * Only the last segment is considered the active track.
 *
 * @param timeSec - Array of point timestamps in seconds.
 * @param gapMin - Maximum gap duration in minutes before starting a new segment (defaults to TRACK_GAP_MIN).
 * @returns The start index of the last segment (0 if no gap exists).
 */
export function getLastSegmentStartIndex(timeSec: number[], gapMin = TRACK_GAP_MIN): number {
  const maxGapSec = gapMin * 60;
  for (let i = timeSec.length - 1; i > 0; i--) {
    if (timeSec[i] - timeSec[i - 1] > maxGapSec) {
      return i;
    }
  }
  return 0;
}

/**
 * Returns the active segment of a live track (the last segment after any gap >= gapMin).
 *
 * Segments before the gap are rendered as dashed lines on the map, while only the
 * last segment is considered the active track shown on the elevation chart and tracked
 * by the moving dot marker.
 *
 * @param track - The full live track protobuf object.
 * @param gapMin - Maximum gap duration in minutes (defaults to TRACK_GAP_MIN).
 * @returns A LiveTrack object representing only the last segment, or the original track if no gap.
 */
export function getActiveTrackSegment(track: protos.LiveTrack, gapMin = TRACK_GAP_MIN): protos.LiveTrack {
  if (track.timeSec.length === 0) {
    return track;
  }
  const startIndex = getLastSegmentStartIndex(track.timeSec, gapMin);
  if (startIndex === 0) {
    return track;
  }
  // Reindex extra metadata entries so fix indices match the sliced arrays.
  let extra: { [key: number]: protos.LiveExtra } | undefined;
  if (track.extra) {
    extra = {};
    for (const index in track.extra) {
      const srcIndex = Number(index);
      if (srcIndex >= startIndex) {
        const item = track.extra[srcIndex];
        if (item) {
          extra[srcIndex - startIndex] = { ...item };
        }
      }
    }
  }
  return {
    ...track,
    timeSec: track.timeSec.slice(startIndex),
    alt: track.alt.slice(startIndex),
    lat: track.lat.slice(startIndex),
    lon: track.lon.slice(startIndex),
    gndAlt:
      track.gndAlt && track.gndAlt.length === track.timeSec.length ? track.gndAlt.slice(startIndex) : track.gndAlt,
    flags: track.flags && track.flags.length === track.timeSec.length ? track.flags.slice(startIndex) : track.flags,
    extra: extra ?? track.extra,
  };
}

/**
 * Creates GeoJSON features from a live track.
 *
 * - Segments are created when there is a gap larger than gapMin,
 * - Segments are returned as a multi-line (earlier segments marked with `last: false`),
 * - Points are returned for all points of interest (pilot fixes, messages, emergencies).
 *
 * @param track - The live track to convert to GeoJSON.
 * @param gapMin - Gap duration threshold in minutes.
 * @returns An array of GeoJSON feature objects.
 */
export function trackToFeatures(track: protos.LiveTrack, gapMin: number): any[] {
  const features: any[] = [];

  // Compute the segments

  if (track.timeSec.length > 0) {
    // A segment start at [start] and ends at [end].
    const segments: { firstIndex: number; lastIndex: number }[] = [];
    let firstIndex = 0;

    // Compute segments.
    let currentTime = track.timeSec[0];
    for (let i = 1; i < track.timeSec.length; i++) {
      const nextTime = track.timeSec[i];
      if (nextTime - currentTime > 60 * gapMin) {
        segments.push({ firstIndex, lastIndex: i - 1 });
        firstIndex = i;
      }
      currentTime = nextTime;
    }
    segments.push({ firstIndex, lastIndex: track.timeSec.length - 1 });

    const pointsByIndex = new Map<number, any>();

    // Create:
    // - a line for each segment.
    // - points for non simplifiable fixes.
    segments.forEach(({ firstIndex, lastIndex }, index) => {
      const line: [number, number, number][] = [];
      for (let i = firstIndex; i <= lastIndex; i++) {
        if (!IsSimplifiableFix(track, i, firstIndex, lastIndex)) {
          addPoint(pointsByIndex, track, i);
        }
        line.push([track.lon[i], track.lat[i], track.alt[i]]);
      }
      if (line.length > 1) {
        const properties: LiveLineProperties = {
          id: String(track.id ?? track.idStr),
          firstIndex,
          lastIndex,
          lastTimeSec: track.timeSec[lastIndex],
          isUfo: isUfo(track.flags[firstIndex]),
          isEmergency: isEmergencyTrack(track),
          last: index == segments.length - 1,
        };
        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: line,
          },
          properties,
        });
      }
    });

    features.push(...pointsByIndex.values());
  }

  return features;
}

/**
 * Adds a GeoJSON Point feature for a specific fix of a live track to the map of points.
 *
 * @param pointsByIndex - Map storing created Point features keyed by fix index.
 * @param track - The live track protobuf object.
 * @param index - The index of the fix within the live track.
 */
function addPoint(pointsByIndex: Map<number, any>, track: protos.LiveTrack, index: number): void {
  const len = track.timeSec.length;
  // Compute the heading for the last fix of last segment.
  let fixType: FixType = FixType.dot;
  const optProperties: {
    heading?: number;
    msg?: string;
  } = {};
  if (index == len - 1) {
    fixType = FixType.pilot;
    if (len > 1) {
      const previous = { lat: track.lat[len - 2], lon: track.lon[len - 2] };
      const current = { lat: track.lat[len - 1], lon: track.lon[len - 1] };
      optProperties.heading = Math.round(getRhumbLineBearing(previous, current));
    } else {
      optProperties.heading = 0;
    }
  }
  const message = getFixMessage(track, index);
  if (message != null) {
    fixType = FixType.message;
    optProperties.msg = message;
  }
  if (isEmergencyFix(track.flags[index])) {
    fixType = FixType.emergency;
  }
  const pilotId = String(track.id ?? track.idStr);
  const properties: LivePointProperties = {
    ...optProperties,
    id: `${pilotId}-${index}`,
    pilotId,
    index,
    fixType,
    isUfo: isUfo(track.flags[index]),
    alt: track.alt[index],
    gndAlt: isGroundAltitudeValid(track.gndAlt[index]) ? track.gndAlt[index] : undefined,
    timeSec: track.timeSec[index],
    name: track.name,
  };

  pointsByIndex.set(index, {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [track.lon[index], track.lat[index], track.alt[index]],
    },
    properties,
  });
}

/**
 * Handles the live track updates from the server.
 *
 * For full updates (not incremental), the tracks received from the server are returned.
 *
 * For incremental updates, the updates are merged with the current tracks and old fixes are removed.
 * The returned tracks contain the updated tracks and the old tracks that still have fixes.
 *
 * @param tracks The current tracks indexed by ID.
 * @param updates The differential track group updates received from the server.
 * @param isIncremental Whether the updates are incremental or a full refresh.
 * @returns The array of updated live tracks.
 */
export function updateLiveTracks(
  tracks: { [id: string]: protos.LiveTrack },
  updates: protos.LiveDifferentialTrackGroup,
  isIncremental: boolean,
): protos.LiveTrack[] {
  // Tracks received from the server (either full or incremental).
  const updatedTracks: { [id: string]: protos.LiveTrack } = {};

  updates.tracks.forEach((diffTrack) => {
    const id = String(diffTrack.id ?? diffTrack.idStr);
    if (id != null) {
      updatedTracks[id] = differentialDecodeLiveTrack(diffTrack);
    }
  });

  if (isIncremental) {
    // Update the current tracks by:
    // - patching the deltas,
    // - removing old points,
    // - deleting processed tracks from the server tracks.
    for (const id of Object.keys(tracks)) {
      let track = tracks[id];
      if (!track) {
        continue;
      }
      if (id in updatedTracks) {
        track = mergeLiveTracks(track, updatedTracks[id]);
        simplifyLiveTrack(track, LiveTrackPointIntervalSec.Recent);
      }
      updatedTracks[id] = track;
    }
  }

  return Object.values(updatedTracks);
}

/**
 * Determines the appropriate fetch parameters based on the age of the last fetch and the history duration.
 *
 * @param lastFetchAgeSec The age of the last fetch in seconds.
 * @param historySec The history duration in seconds.
 * @returns An object containing the incremental flag and the fetch duration in seconds.
 */
export function getFetchParameters(
  lastFetchAgeSec: number,
  historySec: number,
): { isIncremental: boolean; fetchSec: number } {
  if (lastFetchAgeSec <= LiveTrackDurationSec.M5) {
    return { isIncremental: true, fetchSec: LiveTrackDurationSec.M5 };
  }
  if (lastFetchAgeSec <= LiveTrackDurationSec.M20) {
    return { isIncremental: true, fetchSec: LiveTrackDurationSec.M20 };
  }
  if (historySec <= LiveTrackDurationSec.H12) {
    return { isIncremental: false, fetchSec: LiveTrackDurationSec.H12 };
  }
  if (historySec <= LiveTrackDurationSec.H24) {
    return { isIncremental: false, fetchSec: LiveTrackDurationSec.H24 };
  }
  return { isIncremental: false, fetchSec: LiveTrackDurationSec.H48 };
}
