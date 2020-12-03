// Units for distance, altitude, speed and vario.

export interface Units {
  distance: DistanceUnit;
  altitude: DistanceUnit;
  speed: SpeedUnit;
  vario: SpeedUnit;
}

export const enum DistanceUnit {
  Kilometers = 'km',
  Miles = 'mi',
  Meters = 'm',
  Feet = 'ft',
}

export const enum SpeedUnit {
  KilometersPerHour = 'km/h',
  MilesPerHour = 'mi/h',
  MetersPerSecond = 'm/s',
  FeetPerMinute = 'ft/min',
}

export function formatUnit(value: number, unit?: DistanceUnit | SpeedUnit, fixed?: number): string {
  switch (unit) {
    case DistanceUnit.Kilometers:
      return value.toFixed(fixed ?? 1) + DistanceUnit.Kilometers;
    case DistanceUnit.Miles:
      return (value / 1.60934).toFixed(fixed ?? 1) + DistanceUnit.Miles;
    case DistanceUnit.Meters:
      return value.toFixed(fixed ?? 0) + DistanceUnit.Meters;
    case DistanceUnit.Feet:
      return (value * 3.28084).toFixed(fixed ?? 0) + DistanceUnit.Feet;
    case SpeedUnit.KilometersPerHour:
      return value.toFixed(fixed ?? 1) + SpeedUnit.KilometersPerHour;
    case SpeedUnit.MilesPerHour:
      return (value / 1.60934).toFixed(fixed ?? 1) + SpeedUnit.MilesPerHour;
    case SpeedUnit.MetersPerSecond:
      return value.toFixed(fixed ?? 1) + SpeedUnit.MetersPerSecond;
    case SpeedUnit.FeetPerMinute:
      return (value * 3.28084 * 60).toFixed(fixed ?? 0) + SpeedUnit.FeetPerMinute;
    default:
      return '';
  }
}
