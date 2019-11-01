import IGCParser from 'igc-parser';
import { Track } from './parser';

export function parse(content: string): Track[] {
  let igc: IGCParser.IGCFile;
  try {
    igc = IGCParser.parse(content, { lenient: true });
  } catch (e) {
    return [];
  }

  const fixes = igc.fixes.map(f => ({
    lat: f.latitude,
    lon: f.longitude,
    alt: f.gpsAltitude || f.pressureAltitude || 0,
    ts: f.timestamp,
  }));

  const pilot = igc.pilot || 'unknown';
  return [{ fixes, pilot }];
}
