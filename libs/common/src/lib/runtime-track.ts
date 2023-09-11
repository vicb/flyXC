import { getDistance } from 'geolib';

import * as protos from '../protos/track';
import { diffDecodeArray, diffEncodeArray32bit } from './math';
import { Score } from '../../../../apps/fxc-front/src/app/logic/score/scorer';

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
  score?: Score;
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
  const distX: number[] = [0];

  // Pre-computes values to save time.
  let previousLatLon = { lat: track.lat[0], lon: track.lon[0] };
  for (let i = 1; i < trackLen; i++) {
    const currentLatLon = { lat: track.lat[i], lon: track.lon[i] };
    distX[i] = getDistance(previousLatLon, currentLatLon);
    previousLatLon = currentLatLon;
  }

  const vx = averagePerSeconds(distX, track.timeSec, 60).map((speed) => 3.6 * speed);

  const vz = computeVerticalSpeed(track.alt, track.timeSec);

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
    maxAlt: Math.max(...track.alt),
    minAlt: Math.min(...track.alt),
    maxLat: Math.max(...track.lat),
    minLat: Math.min(...track.lat),
    maxLon: Math.max(...track.lon),
    minLon: Math.min(...track.lon),
    maxTimeSec: Math.max(...track.timeSec),
    minTimeSec: Math.min(...track.timeSec),
    maxVz: Math.max(...vz),
    minVz: Math.min(...vz),
    maxVx: Math.max(...vx),
    minVx: Math.min(...vx),
    maxDistance: Math.max(...distX),
    isPostProcessed,
  };
}

// altitude is in meter.
// time is in seconds.
export function computeVerticalSpeed(alt: number[], timeSec: number[]): number[] {
  const trackLen = alt.length;
  const distZ: number[] = [0];

  // Pre-computes values to save time.
  for (let i = 1; i < trackLen; i++) {
    distZ[i] = alt[i] - alt[i - 1];
  }

  return averagePerSeconds(distZ, timeSec, 60);
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

// Average data per seconds.
function averagePerSeconds(data: number[], timesSec: number[], windowSec: number) {
  const len = timesSec.length;
  const average = [];

  let sum = 0;
  const lookAheadSec = Math.round(windowSec / 2);
  let firstIndex = 0;
  let lastIndex = 0;

  for (let index = 0; index < len; index++) {
    const windowStart = timesSec[index] - lookAheadSec;
    const windowEnd = windowStart + windowSec;

    // Remove samples from the beginning.
    while (timesSec[firstIndex] < windowStart) {
      sum -= data[firstIndex];
      firstIndex++;
    }

    // Add samples to the end.
    while (lastIndex < len - 1 && timesSec[lastIndex] < windowEnd) {
      sum += data[lastIndex];
      lastIndex++;
    }

    const deltaSec = timesSec[lastIndex] - timesSec[firstIndex];
    average.push(deltaSec == 0 ? 0 : sum / deltaSec);
  }

  return average;
}
