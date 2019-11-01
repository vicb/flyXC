export const enum UNITS {
  kilometers = 'km',
  miles = 'mi',
  kilometers_hour = 'km/h',
  miles_hour = 'mi/h',
  meters_second = 'm/s',
  feet_minute = 'ft/min',
  meters = 'm',
  feet = 'ft',
}

export function formatUnit(value: number, unit: string, fixed?: number): string {
  switch (unit) {
    case UNITS.kilometers:
      return value.toFixed(fixed ?? 1) + UNITS.kilometers;
    case UNITS.miles:
      return (value / 1.60934).toFixed(fixed ?? 1) + UNITS.miles;
    case UNITS.kilometers_hour:
      return value.toFixed(fixed ?? 1) + UNITS.kilometers_hour;
    case UNITS.miles_hour:
      return (value / 1.60934).toFixed(fixed ?? 1) + UNITS.miles_hour;
    case UNITS.meters:
      return value.toFixed(fixed ?? 0) + UNITS.meters;
    case UNITS.feet:
      return (value * 3.28084).toFixed(fixed ?? 0) + UNITS.feet;
    case UNITS.meters_second:
      return value.toFixed(fixed ?? 1) + UNITS.meters_second;
    case UNITS.feet_minute:
      return (value * 3.28084 * 60).toFixed(fixed ?? 0) + UNITS.feet_minute;
  }
  return '';
}
