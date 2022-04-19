/* eslint-disable @typescript-eslint/no-var-requires */
const { buildGPX, BaseBuilder } = require('gpx-builder');
const builder = require('xmlbuilder');

import { LatLonZ } from 'flyxc/common/src/runtime-track';
import printf from 'printf';

export function encode(
  format: string,
  points: LatLonZ[],
  prefix: string,
): { mime?: string; file?: string; ext?: string; error?: string } {
  switch (format) {
    case 'gpx':
      return encodeGPX(points, prefix);
    case 'kml':
      return encodeKML(points, prefix);
    case 'tsk':
      return encodeTSK(points, prefix);
    case 'wpt':
      return encodeWPT(points, prefix);
    case 'cup':
      return encodeCUP(points, prefix);

    default:
      return { error: 'Unsupported format' };
  }
}

function encodeGPX(points: LatLonZ[], prefix: string): { mime?: string; file?: string; ext?: string; error?: string } {
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
  return { file: buildGPX(gpxData), mime: 'application/gpx+xml', ext: 'gpx' };
}

function encodeKML(points: LatLonZ[], prefix: string): { mime?: string; file?: string; ext?: string; error?: string } {
  const coordinates = points.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)},${p.alt}`);

  const kml = builder.begin().ele('kml', { xmlns: 'http://www.opengis.net/kml/2.2' });
  const document = kml.ele('Document');
  document
    .ele('Placemark')
    .ele('name', {}, 'FlyXC route')
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

  return { mime: 'application/vnd.google-earth.kml+xml', file: kml.toString(), ext: 'kml' };
}

function encodeTSK(points: LatLonZ[], prefix: string): { mime?: string; file?: string; ext?: string; error?: string } {
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

  return { mime: 'application/tsk+xml', file: task.toString(), ext: 'tsk' };
}

function encodeWPT(points: LatLonZ[], prefix: string): { mime?: string; file?: string; ext?: string; error?: string } {
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

  return { mime: 'application/x-wpt', file, ext: 'wpt' };
}

// http://download.naviter.com/docs/CUP-file-format-description.pdf
function encodeCUP(points: LatLonZ[], prefix: string): { mime?: string; file?: string; ext?: string; error?: string } {
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
  file += '\r\n-----Related Tasks-----\r\n"FlyXC Task","???",';
  file += points.map((p, i) => `"${prefix + String(i + 1).padStart(3, '0')}"`).join(',');
  file += ',"???"\r\n';

  return { mime: 'application/x-cup', file, ext: 'cup' };
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
