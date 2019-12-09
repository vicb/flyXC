import { IncomingMessage } from 'http';
import { Keys } from '../keys';
import { Stream } from 'stream';
import { parse as parseGpx } from './gpx';
import { parse as parseIgc } from './igc';
import { parse as parseKml } from './kml';
import { parse as parseTrk } from './trk';
/* eslint-disable @typescript-eslint/no-var-requires */
const { Datastore } = require('@google-cloud/datastore');
const crypto = require('crypto');
const zlib = require('zlib');
const request = require('request-zero');
const polyline = require('google-polyline');
const simplify = require('simplify-path');
const {get} = require('https');
const lru = require('tiny-lru');
/* eslint-enable @typescript-eslint/no-var-requires */

const datastore = new Datastore();
const hgtCache = lru(300);

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
      console.log(`Cache hit (url = ${url})`);
      return JSON.parse(zlib.gunzipSync(entities[0].data));
    } else {
      console.log(`Cache miss (url = ${url})`);
    }
  }

  let tracks: Track[];
  try {
    const response = await request(url);
    tracks = response.code == 200 ? await parse(response.body, url) : [];
  } catch (e) {
    tracks = [];
  }

  return tracks;
}

export async function parse(file: string, srcUrl: string | null = null): Promise<Track[]> {
  // First check the cache
  const hash = crypto
    .createHash('md5')
    .update(file)
    .digest('hex');
  console.log(`hash = ${hash}`);
  if (process.env.USE_CACHE) {
    // Note: Adding a select clause is not working
    const query = datastore
      .createQuery('Track')
      .filter('hash', hash)
      .filter('valid', true)
      .limit(1);
    const entities = (await datastore.runQuery(query))[0];
    if (entities.length == 1) {
      console.log(`Cache hit (${hash})`);
      return JSON.parse(zlib.gunzipSync(entities[0].data));
    } else {
      console.log(`Cache miss (${hash})`);
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
  } else {
    console.log(`Can not parse track`);
  }

  // Save the entity in cache
  if (process.env.USE_CACHE) {
    const data: {[key: string]: any} = {
      created: new Date(),
      valid: true,
      hash,
      data: zlib.gzipSync(JSON.stringify(diffTracks), { level: 9 }),
    };
    if (srcUrl != null) {
      data.url = srcUrl;
    }
    await addTrackMetadata(data, rawTracks);
    await datastore.save({
      key: datastore.key('Track'),
      excludeFromIndexes: ['data', 'path'],
      data,
    });
  }
  return diffTracks;
}

function httpsGet(url: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    console.log(`SRTM download ${url}`);
    const req = get(url, (incomingMessage: IncomingMessage) => {
      const statusCode = incomingMessage.statusCode || -1;
      if (statusCode < 200 || statusCode > 300) {
        reject(`SRTM status code = ${statusCode}`);
      } else {
        console.log(`SRTM connection ${(Date.now() - start) / 1000}s`)
        resolve(incomingMessage);
      }  
      req.on("error", (e: any) => reject(e));
    });
  });
}

async function addGroundAltitude(fixes: Fix[]): Promise<unknown> {
  let numErrors = 0;
  for (let i = 0; i < fixes.length; i++) {
    const fix = fixes[i];
    const lat = fix.lat;
    const south = Math.floor(lat);
    const lon = fix.lon;
    const west = Math.floor(lon);
    let buffer: Buffer | null = null;
    const url = getHgtUrl(south, west);
    if (!hgtCache.has(url)) {
      try {
        const message: IncomingMessage = await httpsGet(url);
        buffer = await bufferStream(message.pipe(zlib.createGunzip()));
        hgtCache.set(url, buffer);
      } catch (e) {
        if (numErrors++ > 5) {
          return;
        }
        console.error(e);
      }
    } else {
      buffer = hgtCache.get(url) as Buffer;
    }

    let gndAlt = 0;
    if (buffer) {
      // File is 3600 lines of 3601 16b words starting from the NW towards SE
      const offset = Math.round((lon - west) * 3600) + Math.round((south + 1 - lat) * 3600) * 3601;
      gndAlt = buffer.readInt16BE(offset * 2);
    }

    fix.gndAlt = gndAlt;
  }
  return;
}

async function bufferStream(stream: Stream): Promise<Buffer> {
  const start = Date.now();
  return new Promise(resolve => {
    const data: any[] = [];
    stream.on("data", d => {
      data.push(d);
    });
    stream.on("end", () => {
      console.log(`SRTM download ${(Date.now() - start) / 1000}s`)
      resolve(Buffer.concat(data));
    });
  });
}

export function getHgtUrl(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  const nsLat = `${ns}${String(Math.abs(lat)).padStart(2, '0')}`
  return `https://elevation-tiles-prod.s3.amazonaws.com/skadi/${nsLat}/${nsLat}${ew}${String(Math.abs(lon)).padStart(3, '0')}.hgt.gz`;
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
