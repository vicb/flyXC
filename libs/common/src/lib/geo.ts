export type DegreesMinutes = {
  degrees: number;
  minutes: number;
};

export function decimalDegreeToDegreesMinutes(dd: number): DegreesMinutes {
  if (dd < 0) {
    throw new Error(`dd should be >= 0`);
  }
  const degrees = Math.floor(dd);
  const minutes = (dd - degrees) * 60;
  return { degrees, minutes };
}

export function degreesMinutesToDecimalDegrees(dm: DegreesMinutes): number {
  if (dm.degrees < 0 || dm.minutes < 0) {
    throw new Error(`degrees and minutes should be >= 0`);
  }

  return dm.degrees + dm.minutes / 60;
}

export function getLatitudeCardinal(latitude: number): string {
  return latitude >= 0 ? 'N' : 'S';
}

export function getLatitudeSign(cardinal: string): number {
  return cardinal.toUpperCase() == 'N' ? 1 : -1;
}

export function getLongitudeCardinal(longitude: number): string {
  return longitude >= 0 ? 'E' : 'W';
}

export function getLongitudeSign(cardinal: string): number {
  return cardinal.toUpperCase() == 'E' ? 1 : -1;
}
