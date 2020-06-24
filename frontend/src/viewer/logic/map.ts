import * as mapActions from '../actions/map';

import Pbf from 'pbf';
import { Tracks as PbfTracks } from '../logic/track.js';
import getDistance from 'geolib/es/getDistance';
import { schemeCategory10 } from 'd3-scale-chromatic';
import { store } from '../store';

export type Fixes = {
  lat: number[];
  lon: number[];
  alt: number[];
  gndAlt: number[];
  vx: number[];
  vz: number[];
  ts: number[];
};

export type Track = {
  name: string;
  fixes: Fixes;
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
  // maximum distance bewteen two consecutive points
  maxDistance: number;
};

// Uploads files to the server and adds the tracks.
export function uploadTracks(tracks: File[]): Promise<unknown> {
  if (tracks.length == 0) {
    return Promise.resolve();
  }
  const formData = new FormData();
  tracks.forEach((track) => formData.append('track', track));

  store.dispatch(mapActions.setLoading(true));

  return fetch('/_upload', { method: 'POST', body: formData })
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((buffer) => {
      if (buffer) {
        store.dispatch(mapActions.addTracks(buffer));
        store.dispatch(mapActions.zoomTracks());
      }
      store.dispatch(mapActions.setLoading(false));
    });
}

// Download files given then urls.
export function downloadTracks(tracks: string[]): Promise<unknown> {
  if (tracks.length == 0) {
    return Promise.resolve();
  }

  const params = new URLSearchParams();
  tracks.forEach((track) => params.append('track', track));

  store.dispatch(mapActions.setLoading(true));

  return fetch(`/_download?${params}`)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((buffer) => {
      if (buffer) {
        store.dispatch(mapActions.addTracks(buffer));
        store.dispatch(mapActions.zoomTracks());
      }
      store.dispatch(mapActions.setLoading(false));
    });
}

// Download files given then datastore ids
export function downloadTracksFromHistory(ids: string[]): Promise<unknown> {
  if (ids.length == 0) {
    return Promise.resolve();
  }

  const params = new URLSearchParams();
  ids.forEach((id) => params.append('h', id));

  store.dispatch(mapActions.setLoading(true));

  return fetch(`/_history?${params}`)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((buffer) => {
      if (buffer) {
        store.dispatch(mapActions.addTracks(buffer));
        store.dispatch(mapActions.zoomTracks());
      }
      store.dispatch(mapActions.setLoading(false));
    });
}

// Creates tracks from a protocol buffer.
export function createTracks(buffer: ArrayBuffer): Track[] {
  const pbfTracks = (PbfTracks as any).read(new Pbf(buffer));
  return pbfTracks.track.map((t: any): Track => createTrack(t));
}

// Creates a track:
// - decodes differential encoded fields,
// - adds computed fields (speed, ...).
function createTrack(track: any): Track {
  let lat: number[] = [];
  let lon: number[] = [];
  const alt: number[] = [];
  const gndAlt: number[] = [];
  let ts: number[] = [];

  track.fixes.forEach((f: any, i: number): void => {
    if (i == 0) {
      lat.push(f.lat);
      lon.push(f.lon);
      alt.push(f.alt);
      gndAlt.push(f.gndAlt);
      ts.push(f.ts);
    } else {
      lat.push(lat[i - 1] + f.lat);
      lon.push(lon[i - 1] + f.lon);
      alt.push(alt[i - 1] + f.alt);
      gndAlt.push(gndAlt[i - 1] + f.gndAlt);
      ts.push(ts[i - 1] + f.ts);
    }
  });
  lat = lat.map((v) => v / 1e5);
  lon = lon.map((v) => v / 1e5);
  ts = ts.map((v) => v * 1e3);

  const len = lat.length;
  const vx = lat.map((_, i) => {
    let distance = 0;
    let time = 0;
    for (let avg = 1; i + avg < len && avg < 65; avg++) {
      distance += getDistance(
        { lat: lat[i + avg], lon: lon[i + avg] },
        { lat: lat[i + avg - 1], lon: lon[i + avg - 1] },
      );
      time += (ts[i + avg] - ts[i + avg - 1]) / 1000;
      if (time > 60) break;
    }
    return time > 0 ? Math.round((3.6 * distance) / time) : 0;
  });

  const vz = alt.map((_, i) => {
    let distance = 0;
    let time = 0;
    for (let avg = 1; i + avg < len && avg < 35; avg++) {
      distance += alt[i + avg] - alt[i + avg - 1];
      time += (ts[i + avg] - ts[i + avg - 1]) / 1000;
      if (time > 30) break;
    }
    return time > 0 ? Number((distance / time).toFixed(1)) : 0;
  });

  const fixes = {
    lat,
    lon,
    alt,
    gndAlt,
    ts,
    vx,
    vz,
  };

  return {
    name: track.pilot,
    fixes,
    maxAlt: Math.max(...alt),
    minAlt: Math.min(...alt),
    maxLat: Math.max(...lat),
    minLat: Math.min(...lat),
    maxLon: Math.max(...lon),
    minLon: Math.min(...lon),
    maxTs: Math.max(...ts),
    minTs: Math.min(...ts),
    maxVz: Math.max(...vz),
    minVz: Math.min(...vz),
    maxVx: Math.max(...vx),
    minVx: Math.min(...vx),
    maxDistance: computeMaxDistance(fixes),
  };
}

export function zoomTracks(map: google.maps.Map, minLat: number, minLon: number, maxLat: number, maxLon: number): void {
  const bounds = new google.maps.LatLngBounds({ lat: minLat, lng: minLon }, { lat: maxLat, lng: maxLon });
  map.fitBounds(bounds);
}

// Computes the maximum distance between two consecutive fixes of a track.
export function computeMaxDistance(fixes: Fixes): number {
  let max = 0;
  for (let i = 1; i < fixes.lat.length; i++) {
    const a = { lat: fixes.lat[i - 1], lon: fixes.lon[i - 1] };
    const b = { lat: fixes.lat[i], lon: fixes.lon[i] };
    max = Math.max(getDistance(a, b), max);
  }
  return max;
}

// Finds the closest fix to src in any of the tracks.
export function findClosestFix(tracks: Track[], srcLat: number, srcLon: number): { track: number; ts: number } | null {
  let track = 0;
  let ts: number | null = null;
  let distance = 10000;
  const ref = { lat: srcLat, lon: srcLon };
  tracks.forEach((t, tIdx) => {
    for (let fixIdx = 0; fixIdx < t.fixes.lat.length; ) {
      const lat = t.fixes.lat[fixIdx];
      const lon = t.fixes.lon[fixIdx];
      const d = getDistance(ref, { lat, lon });
      if (d < distance) {
        ts = t.fixes.ts[fixIdx];
        track = tIdx;
        distance = d;
        fixIdx++;
      } else {
        fixIdx += Math.max(1, Math.floor((d - distance) / t.maxDistance));
      }
    }
  });

  return ts ? { track, ts } : null;
}

export function trackColor(index: number): string {
  return schemeCategory10[(index + 3) % 10];
}
