import { getDistance } from 'geolib';
import Pbf from 'pbf';

import { Flags } from './airspaces';
import * as protos from './track_proto.js';

export type Point = {
  x: number;
  y: number;
};

export type LatLonZ = {
  alt: number;
  lat: number;
  lon: number;
};

export type LatLon = Omit<LatLonZ, 'alt'>;

// A track.
export interface ProtoTrack {
  pilot: string;
  lat: number[];
  lon: number[];
  alt: number[];
  ts: number[];
}

// A group of tracks.
// Corresponds to the content of one file / one DB row.
export interface ProtoTrackGroup {
  tracks: ProtoTrack[];
}

// Ground altitude for a single track.
export interface ProtoGroundAltitude {
  altitudes: number[];
  has_errors: boolean;
}

// Ground altitudes for all tracks in a group.
export interface ProtoGroundAltitudeGroup {
  ground_altitudes: ProtoGroundAltitude[];
}

// Airspaces along a single track.
export interface ProtoAirspaces {
  start_ts: number[];
  end_ts: number[];
  name: string[];
  category: string[];
  top: number[];
  bottom: number[];
  flags: Flags[];
  has_errors: boolean;
}

// Airspaces for all the tracks in a group.
export interface ProtoAirspacesGroup {
  airspaces: ProtoAirspaces[];
}

// Meta Track Group.
// This is the message sent over the wire for a single track group.
export interface ProtoMetaTrackGroup {
  id: number;
  num_postprocess: number;
  track_group_bin?: ArrayBuffer;
  ground_altitude_group_bin?: ArrayBuffer;
  airspaces_group_bin?: ArrayBuffer;
}

// Multiple Meta Track Groups.
export interface ProtoMetaTracks {
  meta_track_groups_bin: ArrayBuffer[];
}

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
  ts: number[];
  // Computed async in a web worker.
  heading: number[];
  maxAlt: number;
  minAlt: number;
  maxTs: number;
  minTs: number;
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
  airspaces?: ProtoAirspaces;
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
export function protoToRuntimeTrack(id: string, differentialTrack: ProtoTrack, isPostProcessed: boolean): RuntimeTrack {
  const track = diffDecodeTrack(differentialTrack);
  const trackLen = track.lat.length;

  const distX: number[] = [0];
  const distZ: number[] = [0];
  const deltaSeconds: number[] = [0];

  // Pre-computes values to save time.
  let previousLatLon = { lat: track.lat[0], lon: track.lon[0] };
  for (let i = 1; i < trackLen; i++) {
    const currentLatLon = { lat: track.lat[i], lon: track.lon[i] };
    distX[i] = getDistance(previousLatLon, currentLatLon);
    previousLatLon = currentLatLon;
    distZ[i] = track.alt[i] - track.alt[i - 1];
    deltaSeconds[i] = (track.ts[i] - track.ts[i - 1]) / 1000;
  }

  const vx: number[] = [];

  for (let i = 0; i < trackLen; i++) {
    // Compute vx.
    let distance = 0;
    let time = 0;
    for (let avg = 1; i + avg < trackLen && avg < 65; avg++) {
      distance += distX[i];
      time += deltaSeconds[i];
      if (time > 60) break;
    }
    vx[i] = time > 0 ? Math.round((3.6 * distance) / time) : 0;
  }

  const vz = computeVerticalSpeed(track.alt, track.ts);

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
    ts: track.ts,
    vx,
    vz,
    heading: new Array(trackLen).fill(0),
    maxAlt: Math.max(...track.alt),
    minAlt: Math.min(...track.alt),
    maxLat: Math.max(...track.lat),
    minLat: Math.min(...track.lat),
    maxLon: Math.max(...track.lon),
    minLon: Math.min(...track.lon),
    maxTs: Math.max(...track.ts),
    minTs: Math.min(...track.ts),
    maxVz: Math.max(...vz),
    minVz: Math.min(...vz),
    maxVx: Math.max(...vx),
    minVx: Math.min(...vx),
    maxDistance: Math.max(...distX),
    isPostProcessed,
  };
}

export function computeVerticalSpeed(alt: number[], ts: number[]): number[] {
  const trackLen = alt.length;
  const distZ: number[] = [0];
  const deltaTS: number[] = [0];

  // Pre-computes values to save time.
  for (let i = 1; i < trackLen; i++) {
    distZ[i] = alt[i] - alt[i - 1];
    deltaTS[i] = (ts[i] - ts[i - 1]) / 1000;
  }

  const vz: number[] = [];

  for (let i = 0; i < trackLen; i++) {
    // Compute vz.
    let distance = 0;
    let time = 0;
    for (let avg = 1; i + avg < trackLen && avg < 35; avg++) {
      distance += distZ[i];
      time += deltaTS[i];
      if (time > 30) break;
    }
    vz[i] = time > 0 ? Number((distance / time).toFixed(1)) : 0;
  }

  return vz;
}

// Add the ground altitude to a runtime track.
export function addGroundAltitude(track: RuntimeTrack, gndAlt: ProtoGroundAltitude): void {
  const { altitudes } = gndAlt;
  if (Array.isArray(altitudes) && altitudes.length == track.lat.length) {
    track.gndAlt = diffDecodeArray(altitudes);
  }
}

// Add the airspaces to a runtime track
export function addAirspaces(track: RuntimeTrack, airspaces: ProtoAirspaces): void {
  track.airspaces = diffDecodeAirspaces(airspaces);
}

// Creates tracks from a MetaTracks protocol buffer.
export function createRuntimeTracks(metaTracks: ArrayBuffer): RuntimeTrack[] {
  const metaGroups: ProtoMetaTrackGroup[] = (protos.MetaTracks as any)
    .read(new Pbf(metaTracks))
    .meta_track_groups_bin.map((metaGroupBin: any) => {
      return (protos.MetaTrackGroup as any).read(new Pbf(metaGroupBin));
    });

  const runtimeTracks: RuntimeTrack[] = [];

  metaGroups.forEach((metaGroup: ProtoMetaTrackGroup) => {
    const rtTracks: RuntimeTrack[] = [];
    // Decode the TrackGroup proto and create runtime tracks.
    if (metaGroup.track_group_bin) {
      const trackGroup: ProtoTrackGroup = (protos.TrackGroup as any).read(new Pbf(metaGroup.track_group_bin));
      trackGroup.tracks.forEach((protoTrack, i) => {
        rtTracks.push(protoToRuntimeTrack(createTrackId(metaGroup.id, i), protoTrack, metaGroup.num_postprocess > 0));
      });
    }
    // Add the ground altitude to the tracks if available.
    if (metaGroup.ground_altitude_group_bin) {
      const altGroup = (protos.GroundAltitudeGroup as any).read(new Pbf(metaGroup.ground_altitude_group_bin));
      altGroup.ground_altitudes.forEach((gndAlt: ProtoGroundAltitude, i: number) => {
        addGroundAltitude(rtTracks[i], gndAlt);
      });
    }
    // Add the airspaces to the tracks if available.
    if (metaGroup.airspaces_group_bin) {
      const airspacesGroup = (protos.AirspacesGroup as any).read(new Pbf(metaGroup.airspaces_group_bin));
      airspacesGroup.airspaces.forEach((airspaces: ProtoAirspaces, i: number) => {
        addAirspaces(rtTracks[i], airspaces);
      });
    }
    runtimeTracks.push(...rtTracks);
  });
  return runtimeTracks;
}

// Differential encoding of a track.
export function diffEncodeTrack(track: ProtoTrack): ProtoTrack {
  const lon = diffEncodeArray(track.lon, 1e5);
  const lat = diffEncodeArray(track.lat, 1e5);
  const ts = diffEncodeArray(track.ts, 1e-3, false);
  const alt = diffEncodeArray(track.alt);

  return { ...track, lat, lon, alt, ts };
}

// Differential encoding of airspaces.
export function diffEncodeAirspaces(asp: ProtoAirspaces): ProtoAirspaces {
  // Use signed values as the end are not ordered.
  const start_ts = diffEncodeArray(asp.start_ts, 1e-3);
  const end_ts = diffEncodeArray(asp.end_ts, 1e-3);
  return { ...asp, start_ts, end_ts };
}

export function diffEncodeArray(data: number[], multiplier = 1, signed = true): number[] {
  let previousValue: number;
  return data.map((v: number, i: number) => {
    v = Math.round(v * multiplier);
    const res = i == 0 ? v : v - previousValue;
    previousValue = v;
    return signed ? res : Math.max(0, res);
  });
}

export function diffDecodeArray(data: number[], multiplier = 1): number[] {
  let value: number;
  return data.map((delta: number, i: number) => {
    value = i == 0 ? delta : value + delta;
    return value / multiplier;
  });
}

// Differential decoding of a track.
export function diffDecodeTrack(track: ProtoTrack): ProtoTrack {
  const lon = diffDecodeArray(track.lon, 1e5);
  const lat = diffDecodeArray(track.lat, 1e5);
  const ts = diffDecodeArray(track.ts, 1e-3);
  const alt = diffDecodeArray(track.alt);

  return { ...track, lat, lon, alt, ts };
}

// Differential decoding of airspaces.
export function diffDecodeAirspaces(asp: ProtoAirspaces): ProtoAirspaces {
  const start_ts = diffDecodeArray(asp.start_ts, 1e-3);
  const end_ts = diffDecodeArray(asp.end_ts, 1e-3);
  return { ...asp, start_ts, end_ts };
}
