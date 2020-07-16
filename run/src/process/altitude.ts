// Retrieves the altitude information for a track.

import async from 'async';
import lru from 'tiny-lru';

import { diffEncodeArray, ProtoGroundAltitude, ProtoTrack } from '../../../common/track';
import { httpsGetUnzip } from './request';

const hgtCache = lru(400);

// Returns the ground altitudes for the track (differential encoded).
export async function fetchGroundAltitude(track: ProtoTrack): Promise<ProtoGroundAltitude> {
  // Retrieve the list of files to download.
  const files = track.lat.reduce((files: Set<string>, lat: number, i: number) => {
    const lon = track.lon[i];
    const south = Math.floor(lat);
    const west = Math.floor(lon);
    return files.add(getHgtUrl(south, west));
  }, new Set<string>());

  // Download the files.
  let hasErrors = false;
  const hgts = new Map<string, Buffer>();
  await async.eachLimit(Array.from(files), 5, async (url: string) => {
    try {
      let buffer = hgtCache.get(url);
      if (buffer == null) {
        buffer = await httpsGetUnzip(url);
        hgtCache.set(url, buffer);
      }
      hgts.set(url, buffer);
    } catch (error) {
      console.log('Error retrieving hgt:', error);
      hasErrors = true;
    }
  });

  // Retrieve the fixes altitude.
  const altitudes = track.lat.map((lat: number, i: number) => {
    const lon = track.lon[i];
    const south = Math.floor(lat);
    const west = Math.floor(lon);
    const url = getHgtUrl(south, west);
    const buffer = hgts.get(url);
    let gndAlt = 0;
    if (buffer) {
      const offset = Math.round((lon - west) * 3600) + Math.round((south + 1 - lat) * 3600) * 3601;
      gndAlt = buffer.readInt16BE(offset * 2);
    }
    return gndAlt;
  });

  return {
    altitudes: diffEncodeArray(altitudes),
    has_errors: hasErrors,
  };
}

// Returns the url of an HGT file on the public amazon dataset.
function getHgtUrl(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  const nsLat = `${ns}${String(Math.abs(lat)).padStart(2, '0')}`;
  return `https://elevation-tiles-prod.s3.amazonaws.com/skadi/${nsLat}/${nsLat}${ew}${String(Math.abs(lon)).padStart(
    3,
    '0',
  )}.hgt.gz`;
}
