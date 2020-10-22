import { Track } from 'flyxc/common/protos/track';
import { DOMParser } from 'xmldom';

import * as toGeoJSON from '@tmcw/togeojson';

import { parseGeoJson } from './geojson';

export function parse(content: string): Track[] {
  const geojson = toGeoJSON.gpx(
    new DOMParser({
      errorHandler: (level: string, msg: string): void => {
        if (level === 'error') {
          console.error(`GPX parse error (${msg})`);
        }
      },
    }).parseFromString(content),
  );

  return parseGeoJson(geojson);
}
