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
// C + celsiusToK -> K
const celsiusToK = 273.15;
const L = -6.5e-3;
const g = 9.80665;

/**
 * Computes the temperature at the given pressure assuming dry processes.
 *
 * t0 is the starting temperature at p0 (degree Celsius).
 */
export function dryLapse(p: any, tK0: any, p0: any) {
  return tK0 * Math.pow(p / p0, Rd / Cpd);
}

// Computes the mixing ration of a gas.
export function mixingRatio(partialPressure: any, totalPressure: any, molecularWeightRatio = epsilon) {
  return (molecularWeightRatio * partialPressure) / (totalPressure - partialPressure);
}

// Computes the saturation mixing ratio of water vapor.
function saturationMixingRatio(p: any, tK: any) {
  return mixingRatio(saturationVaporPressure(tK), p);
}

// Computes the saturation water vapor (partial) pressure
export function saturationVaporPressure(tK: any) {
  const tC = tK - celsiusToK;
  return satPressure0c * Math.exp((17.67 * tC) / (tC + 243.5));
}

// Computes the temperature gradient assuming liquid saturation process.
export function moistGradientT(p: any, tK: any) {
  const rs = saturationMixingRatio(p, tK);
  const n = Rd * tK + Lv * rs;
  const d = Cpd + (Math.pow(Lv, 2) * rs * epsilon) / (Rd * Math.pow(tK, 2));
  return (1 / p) * (n / d);
}

// Computes water vapor (partial) pressure.
export function vaporPressure(p: any, mixing: any) {
  return (p * mixing) / (epsilon + mixing);
}

// Computes the ambient dewpoint given the vapor (partial) pressure.
export function dewpoint(p: any) {
  const val = Math.log(p / satPressure0c);
  return celsiusToK + (243.5 * val) / (17.67 - val);
}

export function getElevation(p: any) {
  const t0 = 288.15;
  const p0 = 1013.25;
  return (t0 / L) * (Math.pow(p / p0, (-L * Rd) / g) - 1);
}

export function parcelTrajectory(params: any, steps: any, sfcT: any, sfcP: any, sfcDewpoint: any) {
  const parcel = {};
  const dryGhs = [];
  const dryPressures = [];
  const dryTemps = [];
  const dryDewpoints = [];

  const mRatio = mixingRatio(saturationVaporPressure(sfcDewpoint), sfcP);

  const pToEl = math.scaleLog(params.level, params.gh);
  const minEl = pToEl(sfcP);
  const maxEl = Math.max(minEl, params.gh.at(-1));
  const stepEl = (maxEl - minEl) / steps;

  for (let elevation = minEl; elevation <= maxEl; elevation += stepEl) {
    const p = pToEl.invert(elevation);
    const t = dryLapse(p, sfcT, sfcP);
    const dp = dewpoint(vaporPressure(p, mRatio));
    dryGhs.push(elevation);
    dryPressures.push(p);
    dryTemps.push(t);
    dryDewpoints.push(dp);
  }

  const cloudBase = math.firstIntersection(dryGhs, dryTemps, dryGhs, dryDewpoints);
  let thermalTop = math.firstIntersection(dryGhs, dryTemps, params.gh, params.temp);

  if (!thermalTop) {
    return null;
  }

  if (cloudBase && cloudBase[0] < thermalTop[0]) {
    thermalTop = cloudBase;

    const pCloudBase = pToEl.invert(cloudBase[0]);
    const moistGhs = [];
    const moistPressures = [];
    const moistTemps = [];
    let t = cloudBase[1];
    let previousP = pCloudBase;
    for (let elevation = cloudBase[0]; elevation < maxEl + stepEl; elevation += stepEl) {
      const p = pToEl.invert(elevation);
      t += (p - previousP) * moistGradientT(p, t);
      previousP = p;
      moistGhs.push(elevation);
      moistPressures.push(p);
      moistTemps.push(t);
    }

    const isohume = math.zip(dryDewpoints, dryPressures).filter((pt: any) => pt[1] > pCloudBase);
    isohume.push([cloudBase[1], pCloudBase]);

    let moist = math.zip(moistTemps, moistPressures);
    const equilibrium = math.firstIntersection(moistGhs, moistTemps, params.gh, params.temp);

    // @ts-expect-error TS(2339): Property 'pCloudTop' does not exist on type '{}'.
    parcel.pCloudTop = params.level.at(-1);
    if (equilibrium) {
      const pCloudTop = pToEl.invert(equilibrium[0]);
      moist = moist.filter((pt: any) => pt[1] >= pCloudTop);
      moist.push([equilibrium[1], pCloudTop]);
      // @ts-expect-error TS(2339): Property 'pCloudTop' does not exist on type '{}'.
      parcel.pCloudTop = pCloudTop;
    }
    // @ts-expect-error TS(2339): Property 'moist' does not exist on type '{}'.
    parcel.moist = moist;
    // @ts-expect-error TS(2339): Property 'isohume' does not exist on type '{}'.
    parcel.isohume = isohume;
  }

  const pThermalTop = pToEl.invert(thermalTop[0]);
  const dry = math.zip(dryTemps, dryPressures).filter((pt: any) => pt[1] > pThermalTop);
  dry.push([thermalTop[1], pThermalTop]);

  // @ts-expect-error TS(2339): Property 'dry' does not exist on type '{}'.
  parcel.dry = dry;
  // @ts-expect-error TS(2339): Property 'pThermalTop' does not exist on type '{}'... Remove this comment to see the full error message
  parcel.pThermalTop = pThermalTop;
  // @ts-expect-error TS(2339): Property 'elevThermalTop' does not exist on type '... Remove this comment to see the full error message
  parcel.elevThermalTop = thermalTop[0];

  return parcel;
}
