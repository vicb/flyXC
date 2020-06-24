import { DOMParser } from 'xmldom';

import * as toGeoJSON from '@tmcw/togeojson';

import { ProtoTrack } from '../../../common/track';
import { parseGeoJson } from './geojson';

export function parse(content: string): ProtoTrack[] {
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
