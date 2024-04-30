import { Activity, Class, Type } from '@flyxc/common';
import { Airspace, METER_PER_FEET, roundCoords } from './parser';

enum Unit {
  Meter = 0,
  Feet = 1,
  FlightLevel = 6,
}

enum Datum {
  Gnd = 0,
  Msl = 1,
  Std = 2,
}

interface Limit {
  value: number;
  unit: Unit;
  referenceDatum: Datum;
}

function toMeter(limit: Limit) {
  switch (limit.unit) {
    case Unit.Meter:
      return limit.value;
    case Unit.FlightLevel:
      return 100 * METER_PER_FEET * limit.value;
    case Unit.Feet:
      return METER_PER_FEET * limit.value;
    default:
      throw new Error(`Invalid unit (${limit.unit})`);
  }
}

function getLabel(limit: Limit) {
  if (limit.referenceDatum == Datum.Gnd && limit.value == 0) {
    return 'GND';
  }

  let label = String(Math.round(limit.value));

  switch (limit.unit) {
    case Unit.Meter:
      label += 'm';
      break;
    case Unit.Feet:
      label += 'ft';
      break;
    case Unit.FlightLevel:
      return `FL ${Math.round(limit.value)}`;
    default:
      throw new Error(`Invalid unit (${limit.unit})`);
  }

  switch (limit.referenceDatum) {
    case Datum.Gnd:
      label += ' GND';
      break;
    case Datum.Msl:
      label += ' MSL';
      break;
    case Datum.Std:
      label += ' STD';
      break;
    default:
      throw new Error(`Invalid datum (${limit.referenceDatum})`);
  }

  return label;
}

export function parse(openaip: any): Airspace | null {
  if (openaip.type < 0 || openaip.type >= Type.LastValue) {
    throw new Error(`Invalid type (${openaip.type})`);
  }
  if (openaip.icaoClass < 0 || openaip.icaoClass > Class.LastValue) {
    throw new Error(`Invalid class (${openaip.icaoClass})`);
  }
  if (openaip.activity < 0 || openaip.activity > Activity.LastValue) {
    throw new Error(`Invalid activity (${openaip.activity})`);
  }

  if (openaip.geometry.coordinates[0].length == 0) {
    console.error(`Invalid Airspace (no geometry): ${openaip.name} (${openaip.country})`);
    return null;
  }

  return {
    name: openaip.name,
    country: openaip.country,
    type: openaip.type,
    icaoClass: openaip.icaoClass,
    activity: openaip.activity,
    floorM: Math.round(toMeter(openaip.lowerLimit)),
    floorLabel: getLabel(openaip.lowerLimit),
    floorRefGnd: openaip.lowerLimit.referenceDatum == Datum.Gnd,
    topM: Math.round(toMeter(openaip.upperLimit)),
    topLabel: getLabel(openaip.upperLimit),
    topRefGnd: openaip.upperLimit.referenceDatum == Datum.Gnd,
    polygon: [roundCoords(openaip.geometry.coordinates[0])],
  };
}

export function parseAll(openaip: any[]): Airspace[] {
  return openaip.map((a) => parse(a)).filter((a) => a != null);
}
