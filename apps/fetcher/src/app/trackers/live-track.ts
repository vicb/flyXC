import { getTrackerFlags as getLiveTrackFlags, protos, round, TrackerIds } from '@flyxc/common';
import { getDistance } from 'geolib';

export interface LivePoint {
  lat: number;
  lon: number;
  alt: number;
  // Timestamps in milliseconds.
  timestamp: number;
  device: TrackerIds;
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
}

// Makes a track for a list of points.
// The track is in chronological order (oldest point first).
export function makeLiveTrack(points: LivePoint[]): protos.LiveTrack {
  points.sort((a, b) => a.timestamp - b.timestamp);

  const track = protos.LiveTrack.create();

  points.forEach((point, index) => {
    track.lat.push(round(point.lat, 5));
    track.lon.push(round(point.lon, 5));
    track.alt.push(Math.round(point.alt));
    track.timeSec.push(Math.round(point.timestamp / 1000));
    track.flags.push(
      getLiveTrackFlags({
        valid: point.valid !== false,
        emergency: point.emergency === true,
        lowBat: point.lowBattery === true,
        device: point.device,
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
    if (point.gndAlt != null) {
      extra.gndAlt = Math.round(point.gndAlt);
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

  return track;
}
