import { protos } from '@flyxc/common';
import { parseXmlDocument } from '@flyxc/common-node';
import * as toGeoJSON from '@tmcw/togeojson';

import { parseGeoJson } from './geojson';

export function parse(content: string): protos.Track[] {
  const doc = parseXmlDocument(content, { label: 'GPX' });
  if (!doc) {
    return [];
  }
  try {
    const geojson = toGeoJSON.gpx(doc);
    return parseGeoJson(geojson);
  } catch (e) {
    console.error(`GPX parse error (${e})`);
    return [];
  }
}

export function parseRoute(content: string): protos.Route | null {
  const doc = parseXmlDocument(content, {
    onError: (): void => {
      // Ignore route parse errors.
    },
  });
  if (!doc) {
    return null;
  }

  const routes = doc.getElementsByTagName('rte');
  if (routes.length < 1) {
    return null;
  }

  const points = routes[0].getElementsByTagName('rtept');
  if (points.length < 2) {
    return null;
  }

  const route = protos.Route.create();

  for (let i = 0; i < points.length; i++) {
    route.lat.push(Number(points[i].getAttribute('lat') ?? 0));
    route.lon.push(Number(points[i].getAttribute('lon') ?? 0));
    route.alt.push(0);
  }

  return route;
}
