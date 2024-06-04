import type { protos } from '@flyxc/common';

import * as toGeoJSON from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';

import { parseGeoJson } from './geojson';

export function parse(content: string): protos.Track[] {
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
