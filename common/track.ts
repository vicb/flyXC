import { getDistance } from 'geolib';
import Pbf from 'pbf';

import { computeMaxDistance } from './distance';
import * as protos from './track_proto.js';

export type Point = {
  x: number;
  y: number;
};

export type LatLon = {
  lat: number;
  lon: number;
};

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

// Meta Track Group.
// This is the message sent over the wire for a single track group.
export interface ProtoMetaTrackGroup {
  id: number;
  num_postprocess: number;
  track_group_bin?: ArrayBuffer;
  ground_altitude_group_bin?: ArrayBuffer;
}

// Multiple Meta Track Groups.
export interface ProtoMetaTracks {
  meta_track_groups_bin: ArrayBuffer[];
}

// A fix used by the runtime.
export type RuntimeFixes = {
  lat: number[];
  lon: number[];
  alt: number[];
  gndAlt?: number[];
  vx: number[];
  vz: number[];
  ts: number[];
};

// A track used by the runtime.
export type RuntimeTrack = {
  // Datastore id.
  id?: number;
  // Index in the track group.
  groupIndex?: number;
  // Wether the track has been post-processed.
  isPostProcessed: boolean;
  name: string;
  fixes: RuntimeFixes;
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
};

// Creates a runtime track from a track proto (see track.proto).
// - decodes differential encoded fields,
// - adds computed fields (speed, ...).
export function protoToRuntimeTrack(differentialTrack: ProtoTrack): RuntimeTrack {
  const track = diffDecode(differentialTrack);

  const vx: number[] = [];
  const vz: number[] = [];
  const distX: number[] = [0];
  const distZ: number[] = [0];
  const deltaTS: number[] = [0];

  const trackLen = track.lat.length;

  // Pre-computes values to save time.
  for (let i = 1; i < track.lat.length; i++) {
    distX[i] = getDistance({ lat: track.lat[i], lon: track.lon[i] }, { lat: track.lat[i - 1], lon: track.lon[i - 1] });
    distZ[i] = track.alt[i] - track.alt[i - 1];
    deltaTS[i] = (track.ts[i] - track.ts[i - 1]) / 1000;
  }

  for (let i = 0; i < track.lat.length; i++) {
    // Compute vx.
    let distance = 0;
    let time = 0;
    for (let avg = 1; i + avg < trackLen && avg < 65; avg++) {
      distance += distX[i];
      time += deltaTS[i];
      if (time > 60) break;
    }
    vx[i] = time > 0 ? Math.round((3.6 * distance) / time) : 0;

    // Compute vz.
    distance = 0;
    time = 0;
    for (let avg = 1; i + avg < trackLen && avg < 35; avg++) {
      distance += distZ[i];
      time += deltaTS[i];
      if (time > 30) break;
    }
    vz[i] = time > 0 ? Number((distance / time).toFixed(1)) : 0;
  }

  const runtimeFixes: RuntimeFixes = {
    lat: track.lat,
    lon: track.lon,
    alt: track.alt,
    ts: track.ts,
    vx,
    vz,
  };

  return {
    name: track.pilot,
    fixes: runtimeFixes,
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
    maxDistance: computeMaxDistance(runtimeFixes),
    isPostProcessed: false,
  };
}

// Add the ground altitude to a runtime track.
export function addGroundAltitude(track: RuntimeTrack, gndAlt: ProtoGroundAltitude): void {
  const { altitudes } = gndAlt;
  if (Array.isArray(altitudes) && altitudes.length == track.fixes.lat.length) {
    track.fixes.gndAlt = diffDecodeArray(altitudes);
  }
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
    let rtTracks: RuntimeTrack[] = [];
    // Decode the TrackGroup proto and create runtime tracks.
    if (metaGroup.track_group_bin) {
      const trackGroup: ProtoTrackGroup = (protos.TrackGroup as any).read(new Pbf(metaGroup.track_group_bin));
      rtTracks = trackGroup.tracks.map(protoToRuntimeTrack);
      rtTracks.forEach((rtTrack, i) => {
        rtTrack.id = metaGroup.id;
        rtTrack.groupIndex = i;
        rtTrack.isPostProcessed = metaGroup.num_postprocess > 0;
      });
    }
    // Add the ground altitude to the tracks if available.
    if (metaGroup.ground_altitude_group_bin) {
      const altGroup = (protos.GroundAltitudeGroup as any).read(new Pbf(metaGroup.ground_altitude_group_bin));
      altGroup.ground_altitudes.forEach((gndAlt: ProtoGroundAltitude, i: number) => {
        addGroundAltitude(rtTracks[i], gndAlt);
      });
    }
    runtimeTracks.push(...rtTracks);
  });
  return runtimeTracks;
}

// Differential encoding of a track.
export function diffEncode(track: ProtoTrack): ProtoTrack {
  const lon = diffEncodeArray(track.lon, 1e5);
  const lat = diffEncodeArray(track.lat, 1e5);
  const ts = diffEncodeArray(track.ts, 1e-3, false);
  const alt = diffEncodeArray(track.alt);

  return { pilot: track.pilot, lat, lon, alt, ts };
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
export function diffDecode(track: ProtoTrack): ProtoTrack {
  const lon = diffDecodeArray(track.lon, 1e5);
  const lat = diffDecodeArray(track.lat, 1e5);
  const ts = diffDecodeArray(track.ts, 1e-3);
  const alt = diffDecodeArray(track.alt);

  return { pilot: track.pilot, lat, lon, alt, ts };
}
