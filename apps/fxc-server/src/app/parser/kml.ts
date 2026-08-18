import type { protos } from '@flyxc/common';
import * as toGeoJSON from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';

import { parseGeoJson } from './geojson';

export function parse(content: string): protos.Track[] {
  // Strip leading UTF-8 BOM if present; otherwise xmldom fails to parse the XML declaration.
  content = content.replace(/^\uFEFF/, '').trim();
  if (content.length === 0) {
    return [];
  }
  try {
    const geojson = toGeoJSON.kml(
      new DOMParser({
        onError: (level: string, msg: string): void => {
          if (level === 'error') {
            console.error(`KML parse error (${msg})`);
          }
        },
      }).parseFromString(content, 'text/xml'),
    );

    return parseGeoJson(geojson);
  } catch (e) {
    console.error(`KML parse error (${e})`);
    return [];
  }
}
