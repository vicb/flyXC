import { Track } from 'flyxc/common/protos/track';
import IGCParser from 'igc-parser';

export function parse(content: string): Track[] {
  let igc: IGCParser.IGCFile;
  try {
    igc = IGCParser.parse(content, { lenient: true });
  } catch (e) {
    return [];
  }

  const lat: number[] = [];
  const lon: number[] = [];
  const alt: number[] = [];
  const timeSec: number[] = [];

  igc.fixes.forEach((fix) => {
    lat.push(fix.latitude);
    lon.push(fix.longitude);
    alt.push(fix.gpsAltitude || 0);
    timeSec.push(Math.round(fix.timestamp / 1000));
  });

  const pilot = igc.pilot || 'unknown';
  return [{ pilot, lat, lon, alt, timeSec }];
}
