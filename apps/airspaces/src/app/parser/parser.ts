import type { AirspaceTyped } from '@flyxc/common';
import { round } from '@flyxc/common';

export interface Airspace extends AirspaceTyped {
  polygon: [number, number][][];
}

export function roundCoords(coords: [number, number][]): [number, number][] {
  return coords.map(([lon, lat]) => [round(lon, 6), round(lat, 6)]);
}

export const METER_PER_FEET = 0.3048;
