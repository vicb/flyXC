import type { protos } from '@flyxc/common';
import { parseXmlDocument } from '@flyxc/common-node';
import * as toGeoJSON from '@tmcw/togeojson';

import { parseGeoJson } from './geojson';

export function parse(content: string): protos.Track[] {
  const doc = parseXmlDocument(content, { label: 'KML' });
  if (!doc) {
    return [];
  }
  try {
    const geojson = toGeoJSON.kml(doc);
    return parseGeoJson(geojson);
  } catch (e) {
    console.error(`KML parse error (${e})`);
    return [];
  }
}
