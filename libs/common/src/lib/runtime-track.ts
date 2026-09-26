import { getDistance } from 'geolib';

import * as protos from '../protos/track';
import { diffDecodeArray, diffEncodeArray32bit } from './math';

export type Point = {
  x: number;
  y: number;
};

export type LatLonAlt = {
  alt: number;
  lat: number;
  lon: number;
};

export type LatLon = Omit<LatLonAlt, 'alt'>;

// A track used by the runtime.
export type RuntimeTrack = {
  // Composed as `${groupId}-${groupIndex}`.
  // There could be multiple tracks in the same group.
  id: string;
  // Whether the track has been post-processed on the server.
  isPostProcessed: boolean;
  name: string;
  lat: number[];
  lon: number[];
  // Filtered position for the camera.
  lookAtLat: number[];
  lookAtLon: number[];
  alt: number[];
  gndAlt: number[];
  vx: number[];
  vz: number[];
  // Time in seconds.
  timeSec: number[];
  // Computed async in a web worker.
  heading: number[];
  maxAlt: number;
  minAlt: number;
  maxTimeSec: number;
  minTimeSec: number;
  maxLat: number;
  minLat: number;
  maxLon: number;
  minLon: number;
  maxVx: number;
  minVx: number;
  maxVz: number;
  minVz: number;
  // maximum distance between two consecutive points.
  maxDistance: number;
  airspaces?: protos.Airspaces;
};

// Creates a runtime track id from the datastore id and the group index.
export function createTrackId(groupId: number, groupIndex: number): string {
  return `${groupId}-${groupIndex}`;
}

// Extract the group id from the track id.
export function extractGroupId(trackId: string): number {
  const match = trackId.match(/^(\d+)-/);
  return match ? Number(match[1]) : -1;
}

// Creates a runtime track from a track proto (see track.proto).
// - decodes differential encoded fields,
// - adds computed fields (speed, ...).
export function protoToRuntimeTrack(
  id: string,
  differentialTrack: protos.Track,
  isPostProcessed: boolean,
): RuntimeTrack {
  const track = diffDecodeTrack(differentialTrack);
  const trackLen = track.lat.length;

  const { maxDistance, maxLat, maxLon, maxVx, minLat, minLon, minVx, vx } = computeGroundSpeed(
    track.lat,
    track.lon,
    track.timeSec,
  );
  const { maxAlt, minAlt, maxVz, minVz, vz } = computeVerticalSpeed(track.alt, track.timeSec);

  return {
    id,
    name: track.pilot,
    lat: track.lat,
    lon: track.lon,
    // lookAt coordinates will be replaced from the worker metadata.
    lookAtLat: track.lat,
    lookAtLon: track.lon,
    alt: track.alt,
    // gndAlt will be replaced from the server metadata.
    gndAlt: new Array(trackLen).fill(0),
    timeSec: track.timeSec,
    vx,
    vz,
    heading: new Array(trackLen).fill(0),
    maxAlt,
    minAlt,
    maxLat,
    minLat,
    maxLon,
    minLon,
    maxTimeSec: trackLen > 0 ? track.timeSec[trackLen - 1] : 0,
    minTimeSec: trackLen > 0 ? track.timeSec[0] : 0,
    maxVz,
    minVz,
    maxVx,
    minVx,
    maxDistance,
    isPostProcessed,
  };
}

/**
 * Result of the vertical speed computation.
 */
export type VerticalSpeedResult = {
  maxAlt: number;
  maxVz: number;
  minAlt: number;
  minVz: number;
  vz: number[];
};

/**
 * Computes smoothed vertical speed (m/s) using a centered sliding window.
 *
 * Optimizations:
 * - Since the sum of consecutive altitude deltas is a telescoping sum
 *   (sum = alt[lastIndex] - alt[firstIndex]), it computes windowed vertical speed directly
 *   from `alt` and `timeSec` without allocating or populating an intermediate `distZ` array.
 * - Computes `minAlt`, `maxAlt`, `minVz`, and `maxVz` concurrently in the same pass.
 *
 * @param alt - Array of altitudes in meters.
 * @param timeSec - Monotonically increasing timestamps in seconds.
 * @param windowSec - Duration of the smoothing window in seconds (defaults to 60s).
 * @returns Object containing the smoothed `vz` array, `minAlt`, `maxAlt`, `minVz`, and `maxVz`.
 */
export function computeVerticalSpeed(alt: number[], timeSec: number[], windowSec = 60): VerticalSpeedResult {
  const len = alt.length;
  if (len === 0) {
    return { maxAlt: 0, maxVz: 0, minAlt: 0, minVz: 0, vz: [] };
  }

  const vz = new Array<number>(len);
  let minVz = Infinity;
  let maxVz = -Infinity;
  let minAlt = alt[0];
  let maxAlt = alt[0];

  const lookAheadSec = Math.round(windowSec / 2);
  let firstIndex = 0;
  let lastIndex = 0;

  for (let index = 0; index < len; index++) {
    const a = alt[index];
    if (a < minAlt) minAlt = a;
    if (a > maxAlt) maxAlt = a;

    const windowStart = timeSec[index] - lookAheadSec;
    const windowEnd = windowStart + windowSec;

    // Add samples to the end of the window.
    while (lastIndex < len - 1 && timeSec[lastIndex] < windowEnd) {
      lastIndex++;
    }

    // Remove samples from the beginning of the window that fall before windowStart.
    while (firstIndex < lastIndex && timeSec[firstIndex] < windowStart) {
      firstIndex++;
    }

    const deltaSec = timeSec[lastIndex] - timeSec[firstIndex];
    const speed = deltaSec === 0 ? 0 : (alt[lastIndex] - alt[firstIndex]) / deltaSec;
    vz[index] = speed;

    if (speed < minVz) {
      minVz = speed;
    }
    if (speed > maxVz) {
      maxVz = speed;
    }
  }

  return { maxAlt, maxVz, minAlt, minVz, vz };
}

// Add the ground altitude to a runtime track.
export function addGroundAltitude(track: RuntimeTrack, gndAlt: protos.GroundAltitude): void {
  const { altitudes } = gndAlt;
  if (Array.isArray(altitudes) && altitudes.length == track.lat.length) {
    track.gndAlt = diffDecodeArray(altitudes);
  }
}

// Add the airspaces to a runtime track
export function addAirspaces(track: RuntimeTrack, airspaces: protos.Airspaces): void {
  track.airspaces = diffDecodeAirspaces(airspaces);
}

// Creates tracks.
export function createRuntimeTracks(metaGroups: protos.MetaTrackGroup[]): RuntimeTrack[] {
  const runtimeTracks: RuntimeTrack[] = [];

  metaGroups.forEach((metaGroup: protos.MetaTrackGroup) => {
    const rtTracks: RuntimeTrack[] = [];
    // Decode the TrackGroup proto and create runtime tracks.
    if (metaGroup.trackGroupBin) {
      const trackGroup = protos.TrackGroup.fromBinary(metaGroup.trackGroupBin);
      trackGroup.tracks.forEach((protoTrack, i) => {
        rtTracks.push(protoToRuntimeTrack(createTrackId(metaGroup.id, i), protoTrack, metaGroup.numPostprocess > 0));
      });
    }
    // Add the ground altitude to the tracks if available.
    if (metaGroup.groundAltitudeGroupBin) {
      const altGroup = protos.GroundAltitudeGroup.fromBinary(metaGroup.groundAltitudeGroupBin);
      altGroup.groundAltitudes.forEach((gndAlt, i: number) => {
        addGroundAltitude(rtTracks[i], gndAlt);
      });
    }
    // Add the airspaces to the tracks if available.
    if (metaGroup.airspacesGroupBin) {
      const airspacesGroup = protos.AirspacesGroup.fromBinary(metaGroup.airspacesGroupBin);
      airspacesGroup.airspaces.forEach((airspaces, i: number) => {
        addAirspaces(rtTracks[i], airspaces);
      });
    }
    runtimeTracks.push(...rtTracks);
  });
  return runtimeTracks;
}

// Differential encoding of airspaces.
export function diffEncodeAirspaces(asp: protos.Airspaces): protos.Airspaces {
  // Use signed values as the end times are not ordered.
  return {
    ...asp,
    startSec: diffEncodeArray32bit(asp.startSec),
    endSec: diffEncodeArray32bit(asp.endSec),
  };
}

// Differential encoding of a track.
export function diffEncodeTrack(track: protos.Track): protos.Track {
  const lon = diffEncodeArray32bit(track.lon, 1e5);
  const lat = diffEncodeArray32bit(track.lat, 1e5);
  const timeSec = diffEncodeArray32bit(track.timeSec, 1, false);
  const alt = diffEncodeArray32bit(track.alt);

  return { ...track, lat, lon, alt, timeSec };
}

// Differential decoding of a track.
export function diffDecodeTrack(track: protos.Track): protos.Track {
  const lon = diffDecodeArray(track.lon, 1e5);
  const lat = diffDecodeArray(track.lat, 1e5);
  const timeSec = diffDecodeArray(track.timeSec);
  const alt = diffDecodeArray(track.alt);

  return { ...track, lat, lon, alt, timeSec };
}

// Differential decoding of airspaces.
export function diffDecodeAirspaces(asp: protos.Airspaces): protos.Airspaces {
  return {
    ...asp,
    startSec: diffDecodeArray(asp.startSec),
    endSec: diffDecodeArray(asp.endSec),
  };
}

/**
 * Result of the ground speed computation.
 */
export type GroundSpeedResult = {
  maxDistance: number;
  maxLat: number;
  maxLon: number;
  maxVx: number;
  minLat: number;
  minLon: number;
  minVx: number;
  vx: number[];
};

/**
 * Computes smoothed horizontal ground speed (km/h) using a centered sliding window.
 *
 * Optimizations:
 * - Uses a cumulative distance array so the ground distance over any window is simply
 *   `cumDist[lastIndex] - cumDist[firstIndex]`, eliminating running-sum float precision drift.
 * - Computes speed directly in km/h (* 3.6), avoiding an extra array allocation from `.map()`.
 * - Computes `minLat`, `maxLat`, `minLon`, `maxLon`, `minVx`, `maxVx`, and `maxDistance` concurrently
 *   without separate array traversals.
 *
 * @param lat - Array of latitudes in degrees.
 * @param lon - Array of longitudes in degrees.
 * @param timeSec - Monotonically increasing timestamps in seconds.
 * @param windowSec - Duration of the smoothing window in seconds (defaults to 60s).
 * @returns Object containing smoothed `vx` in km/h, bounds for coordinates and speeds, and `maxDistance`.
 */
export function computeGroundSpeed(lat: number[], lon: number[], timeSec: number[], windowSec = 60): GroundSpeedResult {
  const len = lat.length;
  if (len === 0) {
    return {
      maxDistance: 0,
      maxLat: 0,
      maxLon: 0,
      maxVx: 0,
      minLat: 0,
      minLon: 0,
      minVx: 0,
      vx: [],
    };
  }

  const cumDist = new Array<number>(len);
  cumDist[0] = 0;
  let maxDistance = 0;
  let minLat = lat[0];
  let maxLat = lat[0];
  let minLon = lon[0];
  let maxLon = lon[0];

  let prevCoord = { lat: lat[0], lon: lon[0] };
  for (let i = 1; i < len; i++) {
    const currLat = lat[i];
    const currLon = lon[i];
    if (currLat < minLat) minLat = currLat;
    if (currLat > maxLat) maxLat = currLat;
    if (currLon < minLon) minLon = currLon;
    if (currLon > maxLon) maxLon = currLon;

    const currCoord = { lat: currLat, lon: currLon };
    const stepDist = getDistance(prevCoord, currCoord);
    if (stepDist > maxDistance) {
      maxDistance = stepDist;
    }
    cumDist[i] = cumDist[i - 1] + stepDist;
    prevCoord = currCoord;
  }

  const vx = new Array<number>(len);
  let minVx = Infinity;
  let maxVx = -Infinity;

  const lookAheadSec = Math.round(windowSec / 2);
  let firstIndex = 0;
  let lastIndex = 0;

  for (let index = 0; index < len; index++) {
    const windowStart = timeSec[index] - lookAheadSec;
    const windowEnd = windowStart + windowSec;

    // Add samples to the end of the window.
    while (lastIndex < len - 1 && timeSec[lastIndex] < windowEnd) {
      lastIndex++;
    }

    // Remove samples from the beginning of the window that fall before windowStart.
    while (firstIndex < lastIndex && timeSec[firstIndex] < windowStart) {
      firstIndex++;
    }

    const deltaSec = timeSec[lastIndex] - timeSec[firstIndex];
    const speedKmH = deltaSec === 0 ? 0 : ((cumDist[lastIndex] - cumDist[firstIndex]) * 3.6) / deltaSec;
    vx[index] = speedKmH;

    if (speedKmH < minVx) {
      minVx = speedKmH;
    }
    if (speedKmH > maxVx) {
      maxVx = speedKmH;
    }
  }

  return { maxDistance, maxLat, maxLon, maxVx, minLat, minLon, minVx, vx };
}
