import * as math from './math';

// Gas constant for dry air at the surface of the Earth
const Rd = 287;
// Specific heat at constant pressure for dry air
const Cpd = 1005;
// Molecular weight ratio
const epsilon = 18.01528 / 28.9644;
// Heat of vaporization of water
const Lv = 2501000;
// Ratio of the specific gas constant of dry air to the specific gas constant for water vapour
const satPressure0c = 6.112;
// C + CELSIUS_TO_K -> K
const CELSIUS_TO_K = 273.15;
const L = -6.5e-3;
// Gravitational acceleration.
const G = 9.80665;

export type ParcelData = {
  dry: [gh: number, temp: number][];
  wet: [gh: number, temp: number][];
  isohume: [gh: number, temp: number][];
  thermalTopPressure: number;
  cloudTopPressure?: number;
  thermalTopElev: number;
};

/**
 * Computes the temperature at the given pressure assuming dry adiabatic processes.
 *
 * @param pressure - The pressure.
 * @param tempK0 - The starting temperature in Kelvin at pressure0.
 * @param pressure0 - The starting pressure.
 * @returns The temperature in Kelvin.
 */
export function dryLapse(pressure: number, tempK0: number, pressure0: number): number {
  return tempK0 * (pressure / pressure0) ** (Rd / Cpd);
}

/**
 * Computes the mixing ratio of a gas.
 *
 * @param partialPressure - The partial pressure of the gas.
 * @param totalPressure - The total pressure.
 * @param molecularWeightRatio - The ratio of the molecular weight of the gas to the molecular weight of dry air. Defaults to the ratio for water vapor.
 * @returns The mixing ratio of the gas.
 */
export function mixingRatio(partialPressure: number, totalPressure: number, molecularWeightRatio = epsilon): number {
  return (molecularWeightRatio * partialPressure) / (totalPressure - partialPressure);
}

/**
 * Computes the saturation mixing ratio of water vapor.
 *
 * @param pressure - The pressure.
 * @param tempK - The temperature in Kelvin.
 * @returns The saturation mixing ratio of water vapor.
 */
export function saturationMixingRatio(pressure: number, tempK: number): number {
  return mixingRatio(saturationVaporPressure(tempK), pressure);
}

/**
 * Computes the saturation water vapor (partial) pressure.
 *
 * @param tempK - The temperature in Kelvin.
 * @returns The saturation water vapor pressure.
 */
export function saturationVaporPressure(tempK: number) {
  const tC = tempK - CELSIUS_TO_K;
  return satPressure0c * Math.exp((17.67 * tC) / (tC + 243.5));
}

/**
 * Computes the temperature gradient assuming liquid saturation process.
 *
 * @param pressure - The pressure.
 * @param tempK - The temperature in Kelvin.
 * @returns The temperature gradient in Kelvin per hPa.
 */

export function wetTempGradient(pressure: number, tempK: number): number {
  const rs = saturationMixingRatio(pressure, tempK);
  const n = Rd * tempK + Lv * rs;
  const d = Cpd + (Lv ** 2 * rs * epsilon) / (Rd * tempK ** 2);
  return n / d / pressure;
}

/**
 * Computes water vapor (partial) pressure.
 *
 * @param pressure - The total pressure.
 * @param mixing - The mixing ratio of water vapor.
 * @returns The water vapor pressure.
 */
export function vaporPressure(pressure: number, mixing: number): number {
  return (pressure * mixing) / (epsilon + mixing);
}

/**
 * Computes the ambient dewpoint given the vapor (partial) pressure.
 *
 * @param pressure - The vapor pressure.
 * @returns The dewpoint in Kelvin.
 */
export function dewpoint(pressure: number): number {
  const val = Math.log(pressure / satPressure0c);
  return CELSIUS_TO_K + (243.5 * val) / (17.67 - val);
}

/**
 * Computes the elevation given the pressure using the barometric formula.
 *
 * @param pressure - The pressure.
 * @param seaLevelPressure - The pressure at sea level. Defaults to 1013.25 hPa.
 * @returns The elevation in meters.
 */
export function getElevation(pressure: number, seaLevelPressure = 1013.25): number {
  // Reference temperature (T0) is typically set to 288.15 Kelvin (or 15°C)
  const T0K = 288.15;
  return (T0K / L) * ((pressure / seaLevelPressure) ** ((-L * Rd) / G) - 1);
}

/**
 * Computes the trajectory of a parcel of air, considering dry, wet, and isohume processes.
 *
 * @param levels - The pressure levels, in descending order.
 * @param ghByLevel - The geopotential heights in meters corresponding to the pressure levels.
 * @param tempByLevel - The temperatures in Kelvin corresponding to the pressure levels.
 * @param thermalDeltaTemp - Thermal start temp relative to local temp in Kelvin.
 * @param surfaceElevation - The surface elevation in meters.
 * @param surfaceDewpoint - The surface dewpoint in Kelvin.
 * @param steps - The number of steps in the output.
 * @returns The parcel trajectory, or undefined if no intersection is found.
 */
export function parcelTrajectory(
  // Descending order.
  levels: number[],
  ghByLevel: number[],
  tempByLevel: number[],
  thermalDeltaTemp: number,
  surfaceElevation: number,
  surfaceDewpoint: number,
  steps: number,
): ParcelData {
  const parcel: ParcelData = {
    dry: [],
    wet: [],
    isohume: [],
    thermalTopPressure: 0,
    thermalTopElev: 0,
    cloudTopPressure: 0,
  };

  const dryGhs: number[] = [];
  const dryPressures: number[] = [];
  const dryTemps: number[] = [];
  const dryDewpoints: number[] = [];

  const pressureToGhScale = math.scaleLog(levels, ghByLevel);

  // Do not start below the first available level.
  const startPressure = Math.min(levels[0], pressureToGhScale.invert(surfaceElevation));
  const startElevation = Math.round(pressureToGhScale(startPressure));

  const endElevation = ghByLevel.at(-1) as number;
  const elevationStep = (endElevation - startElevation) / steps;

  // Locally temp scales linearly with elevation.
  const ghToTempScale = math.scaleLinear(ghByLevel, tempByLevel);
  const startTemp = ghToTempScale(startElevation) + thermalDeltaTemp;

  const mixRatio = mixingRatio(saturationVaporPressure(surfaceDewpoint), startPressure);

  for (let elevation = startElevation; elevation <= endElevation; elevation += elevationStep) {
    const pressure = pressureToGhScale.invert(elevation);
    dryGhs.push(elevation);
    dryPressures.push(pressure);
    dryTemps.push(dryLapse(pressure, startTemp, startPressure));
    dryDewpoints.push(dewpoint(vaporPressure(pressure, mixRatio)));
  }

  const cloudBase = math.firstIntersection(dryGhs, dryTemps, dryGhs, dryDewpoints);
  let thermalTop = math.firstIntersection(dryGhs, dryTemps, ghByLevel, tempByLevel);

  if (!thermalTop) {
    return parcel;
  }

  if (cloudBase && cloudBase[0] < thermalTop[0]) {
    thermalTop = cloudBase;

    const cloudBasePressure = pressureToGhScale.invert(cloudBase[0]);
    const wetGhs: number[] = [];
    const wetPressures: number[] = [];
    const wetTemps: number[] = [];
    let temp = cloudBase[1];
    let previousPressure = cloudBasePressure;
    for (let elevation = cloudBase[0]; elevation < endElevation + elevationStep; elevation += elevationStep) {
      const pressure = pressureToGhScale.invert(elevation);
      temp += (pressure - previousPressure) * wetTempGradient(pressure, temp);
      previousPressure = pressure;
      wetGhs.push(elevation);
      wetPressures.push(pressure);
      wetTemps.push(temp);
    }

    const isohume = math.zip(dryDewpoints, dryPressures).filter((pt) => pt[1] > cloudBasePressure);
    isohume.push([cloudBase[1], cloudBasePressure]);

    let wet = math.zip(wetTemps, wetPressures);
    const equilibrium = math.firstIntersection(wetGhs, wetTemps, ghByLevel, tempByLevel);

    parcel.cloudTopPressure = levels.at(-1);
    if (equilibrium) {
      const pCloudTop = pressureToGhScale.invert(equilibrium[0]);
      wet = wet.filter((pt: any) => pt[1] >= pCloudTop);
      wet.push([equilibrium[1], pCloudTop]);
      parcel.cloudTopPressure = pCloudTop;
    }
    parcel.wet = wet;
    parcel.isohume = isohume;
  }

  const thermalTopPressure = pressureToGhScale.invert(thermalTop[0]);
  const dry = math.zip(dryTemps, dryPressures).filter((pt: any) => pt[1] > thermalTopPressure);
  dry.push([thermalTop[1], thermalTopPressure]);

  parcel.dry = dry;
  parcel.thermalTopPressure = thermalTopPressure;
  parcel.thermalTopElev = thermalTop[0];

  return parcel;
}

/**
 * Creates a scale that maps pressure to geopotential height.
 *
 * @param levels - The pressure levels, in descending order.
 * @param ghByLevel - The geopotential heights in meters corresponding to the pressure levels.
 * @param seaLevelPressure - The pressure at sea level.
 * @returns A scale that maps pressure to geopotential height.
 */
export function getPressureToGhScale(levels: number[], ghByLevel: number[], seaLevelPressure: number): math.Scale {
  return seaLevelPressure > levels[0]
    ? math.scaleLog([seaLevelPressure, ...levels], [0, ...ghByLevel])
    : math.scaleLog([...levels], [...ghByLevel]);
}
