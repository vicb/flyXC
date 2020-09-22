import IGCParser from 'igc-parser';

import { ProtoTrack } from '../../../common/track';

export function parse(content: string): ProtoTrack[] {
  let igc: IGCParser.IGCFile;
  try {
    igc = IGCParser.parse(content, { lenient: true });
  } catch (e) {
    return [];
  }

  const lat: number[] = [];
  const lon: number[] = [];
  const alt: number[] = [];
  const ts: number[] = [];

  igc.fixes.forEach((fix) => {
    lat.push(fix.latitude);
    lon.push(fix.longitude);
    // The pressure altitude has
    alt.push(fix.pressureAltitude || fix.gpsAltitude || 0);
    ts.push(fix.timestamp);
  });

  const pilot = igc.pilot || 'unknown';
  return [{ pilot, lat, lon, alt, ts }];
}
