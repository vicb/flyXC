import { protos } from '@flyxc/common';
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
    const geojson = toGeoJSON.gpx(
      new DOMParser({
        onError: (level: string, msg: string): void => {
          if (level === 'error') {
            console.error(`GPX parse error (${msg})`);
          }
        },
      }).parseFromString(content, 'text/xml'),
    );

    return parseGeoJson(geojson);
  } catch (e) {
    console.error(`GPX parse error (${e})`);
    return [];
  }
}

export function parseRoute(content: string): protos.Route | null {
  // Strip leading UTF-8 BOM if present; otherwise xmldom fails to parse the XML declaration.
  content = content.replace(/^\uFEFF/, '').trim();
  if (content.length === 0) {
    return null;
  }
  try {
    const routes = new DOMParser({
      onError: (): void => {
        // Ignore route parse errors.
      },
    })
      .parseFromString(content, 'text/xml')
      .getElementsByTagName('rte');

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
  } catch {
    return null;
  }
}
