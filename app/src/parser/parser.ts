import { Keys } from '../keys';
import { parse as parseGpx } from './gpx';
import { parse as parseIgc } from './igc';
import { parse as parseKml } from './kml';
import { parse as parseTrk } from './trk';
/* eslint-disable @typescript-eslint/no-var-requires */
const { Storage } = require('@google-cloud/storage');
const { Datastore } = require('@google-cloud/datastore');
const crypto = require('crypto');
const zlib = require('zlib');
const request = require('request-zero');
const polyline = require('google-polyline');
const simplify = require('simplify-path');
/* eslint-enable @typescript-eslint/no-var-requires */

const storage = new Storage();
const bucket = storage.bucket('srtm-data');

const datastore = new Datastore();

export interface Fix {
  lat: number;
  lon: number;
  alt: number;
  gndAlt?: number;
  ts: number;
}

export interface Track {
  fixes: Fix[];
  pilot: string;
}

// Adds:
// - starting location (city, country),
// - encoded path (path).
async function addTrackMetadata(data: any, tracks: Track[]): Promise<unknown> {
  if (tracks[0] && tracks[0].fixes.length) {
    const { lat, lon } = tracks[0].fixes[0];
    const response = await request(
      `http://api.geonames.org/findNearbyPlaceNameJSON?lat=${lat}&lng=${lon}&username=${Keys.GEONAMES}`,
    );

    if (response.code == 200) {
      const location = JSON.parse(response.body).geonames[0];
      data.city = location?.name;
      data.country = location?.countryCode;
    }

    const coords = tracks[0].fixes.map(ll => [ll.lat, ll.lon]);
    data.path = polyline.encode(simplify(coords, 0.005));
  }
  return;
}

// Return the latest submitted track from the Data Store
export async function getLastTracks(num: number): Promise<object[]> {
  if (process.env.USE_CACHE) {
    const query = datastore
      .createQuery('Track')
      .order('created', { descending: true })
      .limit(num);
    const items = (await datastore.runQuery(query))[0];
    return items.filter((i: any) => i.hash != null);
  }
  return [];
}

// Retrieve a single track from the Data Store
export async function retrieveFromHistory(id: string): Promise<Track[]> {
  if (process.env.USE_CACHE) {
    const query = datastore
      .createQuery('Track')
      .filter('hash', id)
      .limit(1);
    const entities = (await datastore.runQuery(query))[0];
    if (entities.length == 1) {
      return JSON.parse(zlib.gunzipSync(entities[0].data));
    }
  }
  return [];
}

export async function parseFromUrl(url: string): Promise<Track[]> {
  // First check the cache
  if (process.env.USE_CACHE) {
    const query = datastore
      .createQuery('Track')
      .filter('url', url)
      .filter('valid', true)
      .limit(1);
    const entities = (await datastore.runQuery(query))[0];
    if (entities.length == 1) {
      return JSON.parse(zlib.gunzipSync(entities[0].data));
    }
  }

  let tracks: Track[];
  try {
    const response = await request(url);
    tracks = response.code == 200 ? await parse(response.body) : [];
  } catch (e) {
    tracks = [];
  }

  // Save in cache
  if (process.env.USE_CACHE) {
    const data = {
      created: new Date(),
      valid: true,
      url,
      data: zlib.gzipSync(JSON.stringify(tracks), { level: 9 }),
    };
    await datastore.save({
      key: datastore.key('Track'),
      excludeFromIndexes: ['data'],
      data,
    });
  }
  return tracks;
}

export async function parse(file: string): Promise<Track[]> {
  // First check the cache
  const hash = crypto
    .createHash('md5')
    .update(file)
    .digest('hex');
  if (process.env.USE_CACHE) {
    // Note: Adding a select clause is not working
    const query = datastore
      .createQuery('Track')
      .filter('hash', hash)
      .filter('valid', true)
      .limit(1);
    const entities = (await datastore.runQuery(query))[0];
    if (entities.length == 1) {
      return JSON.parse(zlib.gunzipSync(entities[0].data));
    }
  }

  // rawTracks are not differential encoded
  let rawTracks = parseIgc(file);
  let diffTracks: Track[] = [];
  if (!rawTracks.length) {
    rawTracks = parseTrk(file);
  }
  if (!rawTracks.length) {
    rawTracks = parseGpx(file);
  }
  if (!rawTracks.length) {
    rawTracks = parseKml(file);
  }
  if (rawTracks.length) {
    for (let i = 0; i < rawTracks.length; i++) {
      await addGroundAltitude(rawTracks[i].fixes);
    }
    diffTracks = rawTracks.map((track: Track) => ({
      ...track,
      fixes: differentialEncodeFixes(track.fixes),
    }));
  }

  // Save the entity in cache
  if (process.env.USE_CACHE) {
    const data = {
      created: new Date(),
      valid: true,
      hash,
      data: zlib.gzipSync(JSON.stringify(diffTracks), { level: 9 }),
    };
    await addTrackMetadata(data, rawTracks);
    await datastore.save({
      key: datastore.key('Track'),
      excludeFromIndexes: ['data', 'path'],
      data,
    });
  }
  return diffTracks;
}

async function addGroundAltitude(fixes: Fix[]): Promise<unknown> {
  const hgtContent: Map<string, Buffer | null> = new Map();
  for (let i = 0; i < fixes.length; i++) {
    const fix = fixes[i];
    const lat = fix.lat;
    const south = Math.floor(lat);
    const lon = fix.lon;
    const west = Math.floor(lon);

    const filename = getHgtFilename(south, west);
    let buffer: Buffer | null = null;
    const hgt = bucket.file(filename);
    if (!hgtContent.has(filename)) {
      if ((await hgt.exists())[0]) {
        buffer = (await bucket.file(filename).download())[0];
      }
      hgtContent.set(filename, buffer);
    } else {
      buffer = hgtContent.get(filename) as Buffer;
    }

    let gndAlt = 0;
    if (buffer) {
      // File is 1201 lines of 1201 16b words starting from the NW towards SE
      const offset = Math.round((lon - west) * 1200) + Math.round((south + 1 - lat) * 1200) * 1201;
      gndAlt = buffer.readInt16BE(offset * 2);
    }

    fix.gndAlt = gndAlt;
  }
  return;
}

export function getHgtFilename(lat: number, lon: number): string {
  const ns = lat > 0 ? 'N' : 'S';
  const ew = lon > 0 ? 'E' : 'W';
  return `${ns}${String(Math.abs(lat)).padStart(2, '0')}${ew}${String(Math.abs(lon)).padStart(3, '0')}.hgt`;
}

export function differentialEncodeFixes(fixes: Fix[]): Fix[] {
  const lon = differentialEncoding(fixes, 'lon', 1e5);
  const lat = differentialEncoding(fixes, 'lat', 1e5);
  const alt = differentialEncoding(fixes, 'alt', 1);
  const gndAlt = differentialEncoding(fixes, 'gndAlt', 1);
  const ts = differentialEncoding(fixes, 'ts', 1e-3, false);

  return lon.map((lon, i) => ({
    lon,
    lat: lat[i],
    alt: alt[i],
    gndAlt: gndAlt[i],
    ts: ts[i],
  }));
}

function differentialEncoding(fixes: Fix[], fieldName: string, multiplier: number, signed = true): number[] {
  let previousValue: number;
  return fixes
    .map((v: any) => Math.round(v[fieldName] * multiplier))
    .map((v: number, i: number) => {
      const res = i == 0 ? v : v - previousValue;
      previousValue = v;
      return signed ? res : Math.max(0, res);
    });
}

export function fakeTime(length: number): number[] {
  const fakeTimes: number[] = [];
  let time = new Date(2000, 0, 1).getTime();
  for (let i = 0; i < length; i++) {
    fakeTimes.push(time);
    time += 10000;
  }
  return fakeTimes;
}

export function parseGeoJson(geojson: any): Track[] {
  if (geojson.type != 'FeatureCollection') {
    return [];
  }

  const tracks: Track[] = [];

  for (const feature of geojson.features) {
    const type = feature.geometry.type;
    if (type == 'LineString' || type == 'MultiLineString') {
      const coords =
        feature.geometry.type == 'LineString'
          ? feature.geometry.coordinates
          : [].concat(...feature.geometry.coordinates);
      let times: number[];
      if (feature.properties.coordTimes) {
        times = [].concat(feature.properties.coordTimes).map(t => new Date(t).getTime());
      } else {
        times = fakeTime(coords.length);
      }
      const fixes = coords.map((c: number[], i: number) => ({
        lon: c[0],
        lat: c[1],
        alt: c[2] || 0,
        ts: times[i],
      }));
      tracks.push({ fixes, pilot: geojson.name || 'unknown' });
    }
  }

  return tracks;
}
