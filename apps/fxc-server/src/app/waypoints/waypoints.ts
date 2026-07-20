import type { LatLonAlt } from '@flyxc/common';
import { round } from '@flyxc/common';
import { BaseBuilder, buildGPX } from 'gpx-builder';
import printf from 'printf';
import builder from 'xmlbuilder';

export function encode(
  format: string,
  points: LatLonAlt[],
  prefix: string,
): { mime?: string; file?: string; filename?: string; error?: string } {
  switch (format) {
    case 'gpx':
      return encodeGPXWaypoints(points, prefix);
    case 'gpxRoute':
      return encodeGPXRoute(points, prefix);
    case 'kml':
      return encodeKML(points, prefix);
    case 'tsk':
      return encodeTSK(points, prefix);
    case 'wpt':
      return encodeWPT(points, prefix);
    case 'cup':
      return encodeCUP(points, prefix);
    case 'xctsk':
      return encodeXCTSK(points, prefix);

    default:
      return { error: 'Unsupported format' };
  }
}

function encodeXCTSK(
  points: LatLonAlt[],
  prefix: string,
): { mime?: string; file?: string; filename?: string; error?: string } {
  const turnpoints = points.map((p: any, i: number) => ({
    radius: 400,
    waypoint: {
      name: prefix + String(i + 1).padStart(3, '0'),
      lat: round(p.lat, 6),
      lon: round(p.lon, 6),
      altSmoothed: p.alt,
    },
  }));

  // https://xctrack.org/Competition_Interfaces.html
  const file = {
    taskType: 'CLASSIC',
    version: 1,
    turnpoints,
  };

  return { file: JSON.stringify(file), mime: 'application/xctsk', filename: 'route.xctsk' };
}

function encodeGPXWaypoints(
  points: LatLonAlt[],
  prefix: string,
): { mime?: string; file?: string; filename?: string; error?: string } {
  const Point = BaseBuilder.MODELS.Point;
  const waypoints = points.map((p: any, i: number) => {
    const attributes: { [k: string]: string } = {
      name: prefix + String(i + 1).padStart(3, '0'),
    };
    attributes.ele = p.alt.toString();
    return new Point(p.lat.toFixed(6), p.lon.toFixed(6), attributes);
  });
  const gpxData = new BaseBuilder();
  gpxData.setWayPoints(waypoints);
  return { file: buildGPX(gpxData.toObject()), mime: 'application/gpx+xml', filename: 'waypoints.gpx' };
}

export function encodeGPXRoute(
  points: LatLonAlt[],
  prefix: string,
): { mime?: string; file?: string; filename?: string; error?: string } {
  const Point = BaseBuilder.MODELS.Point;
  const Route = BaseBuilder.MODELS.Route;

  const rtept = points.map((p: any, i: number) => {
    const attributes: { [k: string]: string } = {
      name: prefix + String(i + 1).padStart(3, '0'),
    };
    attributes.ele = p.alt.toString();
    return new Point(p.lat.toFixed(6), p.lon.toFixed(6), attributes);
  });
  const route = new Route({ rtept, name: 'flyXC route' });
  const gpxData = new BaseBuilder();
  gpxData.setRoutes([route]);
  return { file: buildGPX(gpxData.toObject()), mime: 'application/gpx+xml', filename: 'route.gpx' };
}

function encodeKML(
  points: LatLonAlt[],
  prefix: string,
): { mime?: string; file?: string; filename?: string; error?: string } {
  const coordinates = points.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)},${p.alt}`);

  const kml = builder.begin().ele('kml', { xmlns: 'http://www.opengis.net/kml/2.2' });
  const document = kml.ele('Document');
  document
    .ele('Placemark')
    .ele('name', {}, 'flyXC route')
    .up()
    .ele('LineString')
    .ele('coordinates', {}, coordinates.join(' '))
    .up()
    .ele('tessellate', {}, 1);
  const folder = document.ele('Folder').ele('name', {}, 'Waypoints').up();
  coordinates.forEach((c, i) => {
    folder
      .ele('Placemark')
      .ele('name', {}, `${prefix}${String(i + 1).padStart(3, '0')}`)
      .up()
      .ele('Point')
      .ele('coordinates', {}, c);
  });
  kml.end({ pretty: true });

  return { mime: 'application/vnd.google-earth.kml+xml', file: kml.toString(), filename: 'waypoints.kml' };
}

function encodeTSK(
  points: LatLonAlt[],
  prefix: string,
): { mime?: string; file?: string; filename?: string; error?: string } {
  // See https://github.com/XCSoar/XCSoar/issues/542
  const task = builder.begin().ele('Task', { type: 'RT' });
  points.forEach((p, i) => {
    let type = 'Turn';
    if (i == 0) {
      type = 'Start';
    } else if (i == points.length - 1) {
      type = 'Finish';
    }
    const waypoint = task
      .ele('Point', { type })
      .ele('Waypoint', { comment: '', name: prefix + String(i + 1).padStart(3, '0') });
    waypoint
      .ele('Location', { latitude: p.lat.toFixed(6), longitude: p.lon.toFixed(6) })
      .up()
      .ele('ObservationZone', { type: 'Cylinder', radius: 400 })
      .att('altitude', p.alt);
  });
  task.end({ pretty: true });

  return { mime: 'application/tsk+xml', file: task.toString(), filename: 'waypoints.tsk' };
}

function encodeWPT(
  points: LatLonAlt[],
  prefix: string,
): { mime?: string; file?: string; filename?: string; error?: string } {
  const file =
    '$FormatGEO\r\n' +
    points
      .map((p, i) => {
        const { d: latD, m: latM, s: latS, h: latH } = dmsh(p.lat, 'NS');
        const { d: lonD, m: lonM, s: lonS, h: lonH } = dmsh(p.lon, 'EW');
        return printf(
          '%-6s    %c %02d %02d %05.2f    %c %03d %02d %05.2f  %4d  ',
          prefix + String(i + 1).padStart(3, '0'),
          latH,
          latD,
          latM,
          latS,
          lonH,
          lonD,
          lonM,
          lonS,
          p.alt,
        );
      })
      .join('\r\n');

  return { mime: 'application/x-wpt', file, filename: 'waypoints.wpt' };
}

// http://download.naviter.com/docs/CUP-file-format-description.pdf
function encodeCUP(
  points: LatLonAlt[],
  prefix: string,
): { mime?: string; file?: string; filename?: string; error?: string } {
  let file = 'name,code,country,lat,lon,elev,style,rwdir,rwlen,freq,desc\r\n';
  file += points
    .map((p, i) => {
      const { d: latD, m: latM, h: latH } = dmh(p.lat, 'NS');
      const { d: lonD, m: lonM, h: lonH } = dmh(p.lon, 'EW');
      const name = prefix + String(i + 1).padStart(3, '0');
      return printf(
        '"%s","%s",,%02d%06.3f%s,%03d%06.3f%s,%dm,1,,,,""',
        name,
        name,
        latD,
        latM,
        latH,
        lonD,
        lonM,
        lonH,
        p.alt,
      );
    })
    .join('\r\n');
  file += '\r\n-----Related Tasks-----\r\n"flyXC Task","???",';
  file += points.map((p, i) => `"${prefix + String(i + 1).padStart(3, '0')}"`).join(',');
  file += ',"???"\r\n';

  return { mime: 'application/x-cup', file, filename: 'waypoints.cup' };
}

function dmsh(coordinates: number, hs: string): { d: number; m: number; s: number; h: string } {
  let h = hs[0];
  if (coordinates < 0) {
    h = hs[1];
    coordinates = -coordinates;
  }
  const d = Math.floor(coordinates);
  const m = Math.floor(coordinates * 60) % 60;
  const s = (3600 * coordinates) % 60;
  return { d, m, s, h };
}

function dmh(coordinates: number, hs: string): { d: number; m: number; h: string } {
  let h = hs[0];
  if (coordinates < 0) {
    h = hs[1];
    coordinates = -coordinates;
  }
  const d = Math.floor(coordinates);
  const m = (coordinates * 60) % 60;
  return { d, m, h };
}
