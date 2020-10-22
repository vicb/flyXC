import { Track } from 'flyxc/common/protos/track';
import IGCParser from 'igc-parser';

const MAX_PRESSURE_OFFSET_METER = 100;

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
  const ts: number[] = [];

  // The pressure altitude is smoother.
  // We use it when it exists and is close enough to the GPS altitude at start.
  const { gpsAltitude, pressureAltitude } = igc.fixes[0];
  const usePressureAltitude =
    pressureAltitude != null && Math.abs((gpsAltitude ?? 0) - pressureAltitude) < MAX_PRESSURE_OFFSET_METER;

  igc.fixes.forEach((fix) => {
    lat.push(fix.latitude);
    lon.push(fix.longitude);
    // The pressure altitude has
    alt.push((usePressureAltitude ? fix.pressureAltitude : fix.gpsAltitude) || 0);
    ts.push(fix.timestamp);
  });

  const pilot = igc.pilot || 'unknown';
  return [{ pilot, lat, lon, alt, ts }];
}
