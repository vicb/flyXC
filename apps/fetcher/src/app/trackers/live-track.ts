import type { TrackerNames, UfoFleetNames } from '@flyxc/common';
import {
  getTrackerFlags as getLiveTrackFlags,
  isGroundAltitudeValid,
  NO_GROUND_ALTITUDE,
  protos,
  round,
  trackerNames,
  ufoFleetNames,
} from '@flyxc/common';
import { getDistance } from 'geolib';

const deviceNames = new Set<TrackerNames | UfoFleetNames>([...trackerNames, ...ufoFleetNames]);

export interface LivePoint {
  lat: number;
  lon: number;
  alt: number;
  timeSec: number;
  name?: TrackerNames | UfoFleetNames;
  // Whether the gps fix is invalid.
  // undefined or null is considered valid (only false is invalid).
  valid?: boolean | null;

  // Optional fields.
  emergency?: boolean | null;
  message?: string | null;
  // Speed in km/h.
  speed?: number | null;
  gndAlt?: number;
  lowBattery?: boolean | null;
  status?: protos.PilotStatus;
}

export interface PilotStatusUpdate {
  status: protos.PilotStatus;
  statusTimeSec: number;
}

export interface LiveTrackResult {
  track: protos.LiveTrack;
  statusUpdate?: PilotStatusUpdate;
}

/**
 * Returns a human-readable description for a pilot status.
 */
export function getPilotStatusDescription(status: protos.PilotStatus): string {
  switch (status) {
    case protos.PilotStatus.FLYING:
      return 'Flying';
    case protos.PilotStatus.LANDED_OK:
      return 'Landed OK';
    case protos.PilotStatus.NEED_RIDE:
      return 'Need Ride';
    case protos.PilotStatus.PICKED_UP:
      return 'Picked Up';
    case protos.PilotStatus.NEED_HELP:
      return 'Need Help';
    case protos.PilotStatus.SOS:
      return 'SOS';
    default:
      return 'Unknown';
  }
}

/**
 * Converts points into a live track in chronological order and extracts the latest status update.
 *
 * @param points Points to convert. Each point may override the default tracker name.
 * @param defaultTrackerName Tracker name used when a point does not provide one.
 * @returns An object containing the live track and the latest status update if any.
 */
export function createLiveTrack(
  points: LivePoint[],
  defaultTrackerName?: TrackerNames | UfoFleetNames,
): LiveTrackResult {
  if (points.length === 0) {
    return { track: protos.LiveTrack.create() };
  }

  points.sort((a, b) => a.timeSec - b.timeSec);

  const track = protos.LiveTrack.create();
  let latestStatusUpdate: PilotStatusUpdate | undefined;

  points.forEach((point, index) => {
    if (point.status != null) {
      latestStatusUpdate = { status: point.status, statusTimeSec: Math.round(point.timeSec) };
    }
    const device = point.name ?? defaultTrackerName;
    if (device == null) {
      throw new Error('A tracker name is required for every live point');
    }
    if (!deviceNames.has(device)) {
      throw new Error(`Unknown tracker name: ${device}`);
    }
    track.lat.push(round(point.lat, 5));
    track.lon.push(round(point.lon, 5));
    track.alt.push(Math.round(point.alt));
    track.gndAlt.push(isGroundAltitudeValid(point.gndAlt) ? Math.round(point.gndAlt) : NO_GROUND_ALTITUDE);
    track.timeSec.push(Math.round(point.timeSec));
    track.flags.push(
      getLiveTrackFlags({
        valid: point.valid !== false,
        emergency: point.emergency === true,
        lowBat: point.lowBattery === true,
        device,
      }),
    );
    let hasExtra = false;
    const extra: protos.LiveExtra = {};
    if (point.speed != null) {
      extra.speed = Math.round(Math.max(point.speed, 0));
      hasExtra = true;
    }
    if (point.message != null) {
      extra.message = point.message;
      hasExtra = true;
    }
    if (hasExtra) {
      track.extra[index] = extra;
    }
  });

  // Try to compute the speed for the last point when not provided.
  const i1 = points.length - 1;

  if (track.extra[i1]?.speed == null && points.length >= 2) {
    const i2 = points.length - 2;
    const seconds = track.timeSec[i1] - track.timeSec[i2];
    if (seconds > 0 && seconds < 2 * 60) {
      const distance = getDistance(
        { lat: track.lat[i1], lon: track.lon[i1] },
        { lat: track.lat[i2], lon: track.lon[i2] },
      );
      track.extra[i1] ??= {};
      track.extra[i1].speed = Math.round(Math.max((3.6 * distance) / seconds, 0));
    }
  }

  return { track, statusUpdate: latestStatusUpdate };
}
