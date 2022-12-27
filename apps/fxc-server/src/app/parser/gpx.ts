import { protos } from '@flyxc/common';

import * as toGeoJSON from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';

import { parseGeoJson } from './geojson';

export function parse(content: string): protos.Track[] {
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

export function parseRoute(content: string): protos.Route | null {
  const routes = new DOMParser().parseFromString(content).getElementsByTagName('rte');

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
