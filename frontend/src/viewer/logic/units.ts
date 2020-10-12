// Units for distance, altitude, speed and vario.

export interface Units {
  distance: DistanceUnit;
  altitude: DistanceUnit;
  speed: SpeedUnit;
  vario: SpeedUnit;
}

export const enum DistanceUnit {
  kilometers = 'km',
  miles = 'mi',
  meters = 'm',
  feet = 'ft',
}

export const enum SpeedUnit {
  kilometers_hour = 'km/h',
  miles_hour = 'mi/h',
  meters_second = 'm/s',
  feet_minute = 'ft/min',
}

export function formatUnit(value: number, unit?: DistanceUnit | SpeedUnit, fixed?: number): string {
  switch (unit) {
    case DistanceUnit.kilometers:
      return value.toFixed(fixed ?? 1) + DistanceUnit.kilometers;
    case DistanceUnit.miles:
      return (value / 1.60934).toFixed(fixed ?? 1) + DistanceUnit.miles;
    case DistanceUnit.meters:
      return value.toFixed(fixed ?? 0) + DistanceUnit.meters;
    case DistanceUnit.feet:
      return (value * 3.28084).toFixed(fixed ?? 0) + DistanceUnit.feet;
    case SpeedUnit.kilometers_hour:
      return value.toFixed(fixed ?? 1) + SpeedUnit.kilometers_hour;
    case SpeedUnit.miles_hour:
      return (value / 1.60934).toFixed(fixed ?? 1) + SpeedUnit.miles_hour;
    case SpeedUnit.meters_second:
      return value.toFixed(fixed ?? 1) + SpeedUnit.meters_second;
    case SpeedUnit.feet_minute:
      return (value * 3.28084 * 60).toFixed(fixed ?? 0) + SpeedUnit.feet_minute;
    default:
      return '';
  }
}
