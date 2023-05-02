// Generate and parse (OGN) APRS position

import {
  decimalDegreeToDegreesMinutes,
  degreesMinutesToDecimalDegrees,
  getLatitudeCardinal,
  getLatitudeSign,
  getLongitudeCardinal,
  getLongitudeSign,
} from './geo';
import { round } from './math';

// Derived from https://github.com/glidernet/python-ogn-client/blob/master/ogn/parser/pattern.py
const POSITION_REGEXP = new RegExp(
  '^(?<time>([0-1]\\d|2[0-3])[0-5]\\d[0-5]\\d)h' +
    '(?<lat>9000\\.00|[0-8]\\d{3}\\.\\d{2})(?<lat_sign>N|S).' +
    '(?<lon>18000\\.00|1[0-7]\\d{3}\\.\\d{2}|0\\d{4}\\.\\d{2})(?<lon_sign>E|W).' +
    '((?<course>\\d{3})/(?<speed>\\d{3}))?' +
    '(/A=(?<alt>(-\\d{5}|\\d{6})))?' +
    '(\\s!W((?<lat_ext>\\d)(?<lon_ext>\\d))!)?' +
    '(\\s(?<comment>.*))?$',
);

const KNOT_IN_KMH = 1.852;
const FT_IN_METER = 0.3048;

export interface AprsPosition {
  lat: number;
  lon: number;
  timeSec: number;
  alt: number;
  // speed in km/h
  speed: number;
  // course in degrees
  course: number;
  comment?: string;
}

// http://wiki.glidernet.org/wiki:ogn-flavoured-aprs
// https://github.com/svoop/ogn_client-ruby/wiki/SenderBeacon
export function parseAprsPosition(position: string, nowSec = Math.round(Date.now() / 1000)): AprsPosition | null {
  const match = position.match(POSITION_REGEXP);
  if (match == null || match.groups == null) {
    return null;
  }
  const timeStr = match.groups['time'] ?? '000000';
  const [h, m, s] = [timeStr.substring(0, 2), timeStr.substring(2, 4), timeStr.substring(4, 6)].map((s) => Number(s));
  const date = new Date(nowSec * 1000);
  date.setUTCHours(h);
  date.setUTCMinutes(m);
  date.setUTCSeconds(s);
  let timeSec = Math.round(date.getTime() / 1000);
  if (timeSec > nowSec) {
    // We assume that the parsed time is before now.
    // If now we have crossed midnight, subtract one day.
    timeSec -= 24 * 3600;
  }
  const latStr = (match.groups['lat'] + (match.groups['lat_ext'] ?? '0')).replace('.', '');
  let degrees = Number(latStr.substring(0, 2));
  let minutes = Number(`${latStr.substring(2, 4)}.${latStr.substring(4)}`);
  const lat = round(
    degreesMinutesToDecimalDegrees({ degrees, minutes }) * getLatitudeSign(match.groups['lat_sign']),
    5,
  );
  const lonStr = (match.groups['lon'] + (match.groups['lon_ext'] ?? '0')).replace('.', '');
  degrees = Number(lonStr.substring(0, 3));
  minutes = Number(`${lonStr.substring(3, 5)}.${lonStr.substring(5)}`);
  const lon = round(
    degreesMinutesToDecimalDegrees({ degrees, minutes }) * getLongitudeSign(match.groups['lon_sign']),
    5,
  );
  const speed = Math.round(Number(match.groups['speed'] ?? '0') * KNOT_IN_KMH);
  const course = Number(match.groups['course'] ?? '0');
  const alt = Math.round(Number(match.groups['alt'] ?? '0') * FT_IN_METER);
  const comment = match.groups['comment'];
  return {
    lat,
    lon,
    timeSec,
    alt,
    speed,
    course,
    comment,
  };
}

export function generateAprsPosition(position: AprsPosition, ognId: string): string {
  const idStr = ognId.substring(0, 6).toUpperCase().padStart(6, '0');
  const date = new Date(position.timeSec * 1000);
  const [h, m, s] = [date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()].map((n) =>
    String(n).padStart(2, '0'),
  );
  let dm = decimalDegreeToDegreesMinutes(Math.abs(position.lat));
  const latStr = (dm.degrees * 100 + dm.minutes).toFixed(3).padStart(8, '0');
  dm = decimalDegreeToDegreesMinutes(Math.abs(position.lon));
  const lonStr = (dm.degrees * 100 + dm.minutes).toFixed(3).padStart(9, '0');
  const courseStr = String(Math.round(position.course % 360)).padStart(3, '0');
  const speedStr = String(Math.min(999, Math.round(position.speed / KNOT_IN_KMH))).padStart(3, '0');
  const altStr = String(Math.min(999999, Math.round(Math.max(0, position.alt) / FT_IN_METER))).padStart(6, '0');

  return (
    `FXC${idStr}>FXCAPP:/` +
    `${h}${m}${s}h` +
    `${latStr.substring(0, 7)}${getLatitudeCardinal(position.lat)}/` +
    `${lonStr.substring(0, 8)}${getLongitudeCardinal(position.lon)}g` +
    `${courseStr}/${speedStr}` +
    `/A=${altStr}` +
    ` !W${latStr.substring(7, 8)}${lonStr.substring(8, 9)}!` +
    ` id1E${idStr}` +
    `${position.comment ? ` ${position.comment}` : ''}`
  );
}
