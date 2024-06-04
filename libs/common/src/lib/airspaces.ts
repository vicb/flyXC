import type { Feature } from 'mapbox-vector-tile';

import type { Point } from './runtime-track';

// Maximium zoom level for the airspaces.
export const MAX_AIRSPACE_TILE_ZOOM = 10;
export const AIRSPACE_TILE_SIZE = 256;

// Pseudo type (legacy) that is now only use for the color.
export enum AirspaceColorCategory {
  Prohibited,
  Restricted,
  Danger,
  Other,
}

// Flags of the airspaces.
export enum Flags {
  // Pseudo-type of the airspace
  AirspaceProhibited = 1 << 0,
  AirspaceRestricted = 1 << 1,
  AirspaceDanger = 1 << 2,
  AirspaceOther = 1 << 3,
  FloorRefGnd = 1 << 4,
  TopRefGnd = 1 << 5,
}

// https://docs.openaip.net/#/Airspaces/get_airspaces__id_
export enum Type {
  Other = 0,
  Restricted = 1,
  Danger = 2,
  Prohibited = 3,
  CTR = 4,
  TMZ = 5,
  RMZ = 6,
  TMA = 7,
  TRA = 8,
  TSA = 9,
  FIR = 10,
  UIR = 11,
  ADIZ = 12,
  ATZ = 13,
  MATZ = 14,
  Airway = 15,
  MTR = 16,
  AlertArea = 17,
  WarningArea = 18,
  ProtectedArea = 19,
  HTZ = 20,
  GlidingSector = 21,
  TRP = 22,
  TIZ = 23,
  TIA = 24,
  MTA = 25,
  CTA = 26,
  ACC = 27,
  RecreationalActivity = 28,
  LowAltitudeOverflightRestriction = 29,
  MRT = 30,
  TFR = 31,
  VFRSector = 32,
  FISSector = 33,
  LastValue,
}

// https://docs.openaip.net/#/Airspaces/get_airspaces__id_
export enum Class {
  A = 0,
  B = 1,
  C = 2,
  D = 3,
  E = 4,
  F = 5,
  G = 6,
  SUA = 8,
  LastValue = SUA,
}

// https://docs.openaip.net/#/Airspaces/get_airspaces__id_
export enum Activity {
  None = 0,
  Parachuting = 1,
  Aerobatics = 2,
  Aeroclub = 3,
  ULM = 4,
  HgPg = 5,
  LastValue = HgPg,
}

// Any update in this function should be reflected for the 3D airspaces.
export function isAirspaceVisible(
  icaoClass: Class,
  visibleClasses: Class[],
  type: Type,
  visibleTypes: Type[],
): boolean {
  if (visibleClasses.indexOf(icaoClass) > -1) {
    return true;
  }
  if (visibleTypes.indexOf(type) > -1) {
    return true;
  }
  // LowAltitudeOverflightRestriction is displayed with Restricted.
  if (visibleTypes.indexOf(Type.Restricted) > -1 && type == Type.LowAltitudeOverflightRestriction) {
    return true;
  }
  // Type.Other include all the types.
  if (visibleTypes.indexOf(Type.Other) > -1) {
    return true;
  }
  return false;
}

export function decodeClass(className: string): Class {
  switch (className.toUpperCase()) {
    case 'A':
      return Class.A;
    case 'B':
      return Class.B;
    case 'C':
      return Class.C;
    case 'D':
      return Class.D;
    case 'E':
      return Class.E;
    case 'F':
      return Class.F;
    case 'G':
      return Class.G;
    case 'SUA':
      return Class.SUA;
    default:
      throw new Error(`Unknown class ${className}`);
  }
}

export function getClassName(icaoClass: Class): string {
  switch (icaoClass) {
    case Class.A:
      return 'A';
    case Class.B:
      return 'B';
    case Class.C:
      return 'C';
    case Class.D:
      return 'D';
    case Class.E:
      return 'E';
    case Class.F:
      return 'F';
    case Class.G:
      return 'G';
    case Class.SUA:
      return '';
  }
}

export function getTypeName(type: Type): string {
  switch (type) {
    case Type.Other:
      return '';
    case Type.Restricted:
      return 'Restricted';
    case Type.Danger:
      return 'Danger';
    case Type.Prohibited:
      return 'Prohibited';
    case Type.CTR:
      return 'CTR';
    case Type.TMZ:
      return 'TMZ';
    case Type.RMZ:
      return 'RMZ';
    case Type.TMA:
      return 'TMA';
    case Type.TRA:
      return 'TRA';
    case Type.TSA:
      return 'TSA';
    case Type.FIR:
      return 'FIR';
    case Type.UIR:
      return 'UIR';
    case Type.ADIZ:
      return 'ADIZ';
    case Type.ATZ:
      return 'ATZ';
    case Type.MATZ:
      return 'MATZ';
    case Type.Airway:
      return 'Airway';
    case Type.MTR:
      return 'MTR';
    case Type.AlertArea:
      return 'Alert area';
    case Type.WarningArea:
      return 'Warning area';
    case Type.ProtectedArea:
      return 'Protected area';
    case Type.HTZ:
      return 'HTZ';
    case Type.GlidingSector:
      return 'Gliding';
    case Type.TRP:
      return 'TRP';
    case Type.TIZ:
      return 'TIZ';
    case Type.TIA:
      return 'TIA';
    case Type.MTA:
      return 'MTA';
    case Type.CTA:
      return 'CTA';
    case Type.ACC:
      return 'ACC';
    case Type.RecreationalActivity:
      return 'Recreational activity';
    case Type.LowAltitudeOverflightRestriction:
      return 'Low altitude restriction';
    case Type.MRT:
      return 'MRT';
    case Type.TFR:
      return 'TFR';
    case Type.VFRSector:
      return 'VFR';
    case Type.FISSector:
      return 'FIS';
    case Type.LastValue:
      throw new Error('Invalid type');
  }
}

export interface AirspaceTyped {
  name: string;
  country: string;
  type: Type;
  icaoClass: Class;
  activity: Activity;
  floorM: number;
  floorLabel: string;
  // Whether the ref is GND (vs MSL)
  floorRefGnd: boolean;
  topM: number;
  topLabel: string;
  // Whether the ref is GND (vs MSL)
  topRefGnd: boolean;
}

export type AirspaceString = Record<keyof AirspaceTyped, string>;

export function toTypedAirspace(airspaceStr: AirspaceString): AirspaceTyped {
  return {
    name: airspaceStr.name,
    country: airspaceStr.country,
    type: Number(airspaceStr.type) as Type,
    icaoClass: Number(airspaceStr.icaoClass) as Class,
    activity: Number(airspaceStr.activity) as Activity,
    floorM: Number(airspaceStr.floorM),
    floorLabel: airspaceStr.floorLabel,
    floorRefGnd: Boolean(airspaceStr.floorRefGnd),
    topM: Number(airspaceStr.topM),
    topLabel: airspaceStr.topLabel,
    topRefGnd: Boolean(airspaceStr.topRefGnd),
  };
}

// Pseudo type is legacy and only used for the color of the airspace as of now.
// Any update in this function should be reflected in the 3D airspaces.
export function getAirspaceColorCategory(airspace: AirspaceTyped): AirspaceColorCategory {
  switch (airspace.icaoClass) {
    case Class.A:
    case Class.B:
    case Class.C:
    case Class.D:
      return AirspaceColorCategory.Prohibited;
    case Class.E:
    case Class.F:
    case Class.G:
      return AirspaceColorCategory.Restricted;
  }

  switch (airspace.type) {
    case Type.CTR:
    case Type.TMA:
    case Type.ATZ:
    case Type.CTA:
    case Type.Prohibited:
      return AirspaceColorCategory.Prohibited;
    case Type.RMZ:
    case Type.TMZ:
    case Type.GlidingSector:
    case Type.Restricted:
    case Type.LowAltitudeOverflightRestriction:
      return AirspaceColorCategory.Restricted;
    case Type.Danger:
      return AirspaceColorCategory.Danger;
  }

  return AirspaceColorCategory.Other;
}

export const ASP_COLOR_PROHIBITED = '#bf4040';
export const ASP_COLOR_RESTRICTED = '#bfbf40';
export const ASP_COLOR_DANGER = '#bf8040';
export const ASP_COLOR_OTHER = '#808080';

export function getAirspaceColor(airspace: AirspaceTyped, alpha: number): string {
  const alphaStr = String(alpha).padStart(2, '0');

  switch (getAirspaceColorCategory(airspace)) {
    case AirspaceColorCategory.Prohibited:
      return `${ASP_COLOR_PROHIBITED}${alphaStr}`;
    case AirspaceColorCategory.Restricted:
      return `${ASP_COLOR_RESTRICTED}${alphaStr}`;
    case AirspaceColorCategory.Danger:
      return `${ASP_COLOR_DANGER}${alphaStr}`;
    case AirspaceColorCategory.Other:
      return `${ASP_COLOR_OTHER}${alphaStr}`;
  }
}

// Returns whether the point is inside the polygon feature.
export function isInFeature(point: Point, feature: Feature): boolean {
  const ratio = 256 / feature.extent;
  const polygons = feature.asPolygons() ?? [];
  for (const rings of polygons) {
    // The point must be in the outer ring.
    let isIn = isInPolygon(point, rings[0], ratio);
    if (isIn) {
      for (let i = 1; i < rings.length; ++i) {
        // The point must not be in any hole.
        isIn = isIn && !isInPolygon(point, rings[i], ratio);
      }
    }
    if (isIn) {
      return true;
    }
  }

  return false;
}

export type AirspaceServer = 'local' | 'cloud';

export function getAirspaceTilesUrlTemplate(server: AirspaceServer): string {
  return server == 'local'
    ? 'http://localhost:8084/{z}/{x}/{y}.pbf'
    : 'https://airspaces.storage.googleapis.com/tiles/{z}/{x}/{y}.pbf';
}

export function getAirspaceTileUrl(x: number, y: number, z: number, server: AirspaceServer): string {
  const url = getAirspaceTilesUrlTemplate(server);
  return url.replace('{x}', String(x)).replace('{y}', String(y)).replace('{z}', String(z));
}

// Return a label for the class and the type, i.e. "E TMA", "E", "TMA" or "".
export function getAirspaceCategory(airspace: AirspaceTyped) {
  const parts = [getClassName(airspace.icaoClass), getTypeName(airspace.type)].filter((s) => s !== '');
  return parts.join(' ');
}

// Returns whether the point is in the polygon.
function isInPolygon(point: Point, polygon: Point[], ratio: number): boolean {
  const { x, y } = { x: point.x / ratio, y: point.y / ratio };

  let isIn = false;

  let [xa, ya] = [polygon[0].x, polygon[0].y];
  for (let j = 1; j < polygon.length; j++) {
    const [xb, yb] = [polygon[j].x, polygon[j].y];

    if (ya > y != yb > y && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) {
      isIn = !isIn;
    }
    [xa, ya] = [xb, yb];
  }

  return isIn;
}
