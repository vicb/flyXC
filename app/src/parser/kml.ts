// eslint-disable-next-line @typescript-eslint/no-var-requires
const toGeoJSON = require('@tmcw/togeojson');

import { Track, parseGeoJson } from './parser';
const DOMParser = require('xmldom').DOMParser;

export function parse(content: string): Track[] {
  const geojson = toGeoJSON.kml(
    new DOMParser({
      errorHandler: (level: string, msg: string): void => {
        if (level === 'error') {
          console.error(`KML parse error (${msg})`);
        }
      },
    }).parseFromString(content),
  );

  return parseGeoJson(geojson);
}
