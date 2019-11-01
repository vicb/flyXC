/* eslint-disable @typescript-eslint/no-var-requires */
const { Storage } = require('@google-cloud/storage');
const zlib = require('zlib');
/* eslint-enable @typescript-eslint/no-var-requires */

import { Track, getHgtFilename, getLastTracks } from './parser/parser';

const storage = new Storage();
const bucket = storage.bucket('srtm-data');

export async function getMissingSrtm(): Promise<Set<string>> {
  const tracks: Track[][] = (await getLastTracks(500)).map((t: any): Track[] => JSON.parse(zlib.gunzipSync(t.data)));
  const hasSrtm: { [lat: string]: { [lon: string]: boolean } } = {};
  const missingFile = new Set<string>();
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i][0];
    const lats: number[] = [];
    const lons: number[] = [];
    let lat = 0;
    let lon = 0;
    track.fixes.forEach((f, i) => {
      if (i == 0) {
        lat = f.lat / 1e5;
        lon = f.lon / 1e5;
      } else {
        lat += f.lat / 1e5;
        lon += f.lon / 1e5;
      }
      lats.push(Math.floor(lat));
      lons.push(Math.floor(lon));
    });
    const maxLat = Math.max(...lats);
    const minLat = Math.min(...lats);
    const maxLon = Math.max(...lons);
    const minLon = Math.min(...lons);
    for (let lat = minLat; lat <= maxLat; lat++) {
      for (let lon = minLon; lon <= maxLon; lon++) {
        if (hasSrtm[lat] == null) {
          hasSrtm[lat] = {};
        }
        if (hasSrtm[lat][lon] == null) {
          const exists = (await bucket.file(getHgtFilename(lat, lon)).exists())[0];
          hasSrtm[lat][lon] = exists;
        }
        if (!hasSrtm[lat][lon]) {
          missingFile.add(getSrtmFilename(lat, lon));
        }
      }
    }
  }
  return missingFile;
}

function getSrtmFilename(lat: number, lon: number): string {
  let filename = lat < 0 ? 'S' : '';
  filename += String.fromCharCode(65 + Math.floor(Math.abs(lat) / 4));
  filename += String(1 + Math.floor((lon + 180) / 6)).padStart(2, '0');
  return filename;
}
