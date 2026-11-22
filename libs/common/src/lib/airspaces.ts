import { TZDate } from '@date-fns/tz';
import { addDays, isAfter, isBefore, isFriday, isMonday, isSaturday, isSunday, nextFriday, nextMonday } from 'date-fns';
import type { Feature } from 'mapbox-vector-tile';

import { getPointX, getPointY, pointInPolygonRings, pointToSegmentSquared2D } from './geometry';
import type { Point } from './runtime-track';

// Maximum zoom level for the airspaces.
export const MAX_AIRSPACE_TILE_ZOOM = 10;
export const AIRSPACE_3D_TILE_ZOOM = 6;
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
  LowerTrafficArea = 34,
  UpperTrafficArea = 35,
  MilitaryControlledTowerRegion = 36,
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
  Unknown = 6,
  LastValue = Unknown,
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
    case Type.LowerTrafficArea:
      return 'Lower traffic area';
    case Type.UpperTrafficArea:
      return 'Upper traffic area';
    case Type.MilitaryControlledTowerRegion:
      return 'Military controlled tower region';
    case Type.LastValue:
      throw new Error('Invalid type');
  }
}

export interface AirspaceTyped {
  id: number;
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

/**
 * Properties of an airspace feature in GeoJSON or vector tiles.
 */
export interface AirspaceFeatureProperties {
  icaoClass: Class | number;
  type: Type | number;
  floorM: number;
  topM: number;
  floorRefGnd: boolean;
  topRefGnd: boolean;
  flags?: Flags | number;
  id?: number;
  name?: string;
  country?: string;
  activity?: Activity | number;
  floorLabel?: string;
  topLabel?: string;
  [key: string]: any;
}

/**
 * GeoJSON Feature representing an airspace polygon or multipolygon.
 */
export interface AirspaceFeature {
  type: 'Feature';
  id?: number | string;
  properties: AirspaceFeatureProperties;
  geometry: {
    type: 'Polygon' | 'MultiPolygon' | string;
    coordinates: any;
  };
}

export type AirspaceString = Record<keyof AirspaceTyped, string>;

export function toTypedAirspace(airspace: Partial<AirspaceString | AirspaceFeatureProperties>): AirspaceTyped {
  return {
    id: Number(airspace.id),
    name: airspace.name ?? '',
    country: airspace.country ?? '',
    type: Number(airspace.type) as Type,
    icaoClass: Number(airspace.icaoClass) as Class,
    activity: Number(airspace.activity) as Activity,
    floorM: Number(airspace.floorM),
    floorLabel: airspace.floorLabel ?? '',
    floorRefGnd: Boolean(airspace.floorRefGnd),
    topM: Number(airspace.topM),
    topLabel: airspace.topLabel ?? '',
    topRefGnd: Boolean(airspace.topRefGnd),
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

export const ASP_CATEGORY_COLOR: Record<AirspaceColorCategory, string> = {
  [AirspaceColorCategory.Prohibited]: ASP_COLOR_PROHIBITED,
  [AirspaceColorCategory.Restricted]: ASP_COLOR_RESTRICTED,
  [AirspaceColorCategory.Danger]: ASP_COLOR_DANGER,
  [AirspaceColorCategory.Other]: ASP_COLOR_OTHER,
};

// Returns the color of the airspace with the given opacity percentage (0-100).
export function getAirspaceColor(airspace: AirspaceTyped, opacityPercent: number): string {
  const alpha255 = Math.min(255, Math.max(0, Math.round((opacityPercent * 255) / 100)));
  const alphaHex = alpha255.toString(16).padStart(2, '0');
  return `${ASP_CATEGORY_COLOR[getAirspaceColorCategory(airspace)]}${alphaHex}`;
}

// Returns whether the point is inside the polygon feature (within optional `marginPx` of the outer boundary).
export function isInFeature(point: Point, feature: Feature, marginPx = 0): boolean {
  const ratio = 256 / feature.extent;
  const px = point.x / ratio;
  const py = point.y / ratio;
  const margin = marginPx > 0 ? marginPx / ratio : 0;

  // Fast bounding-box check (O(1), cached on feature)
  if (typeof feature.bbox === 'function') {
    const [minX, minY, maxX, maxY] = feature.bbox();
    if (px < minX - margin || px > maxX + margin || py < minY - margin || py > maxY + margin) {
      return false;
    }
  }

  const polygons = feature.asPolygons() ?? [];
  const margin2 = margin * margin;
  for (const rings of polygons) {
    if (pointInPolygonRings(px, py, rings)) {
      return true;
    }
    if (margin > 0 && rings[0]) {
      const outer = rings[0];
      for (let i = 0; i < outer.length - 1; i++) {
        const p1 = outer[i];
        const p2 = outer[i + 1];
        if (
          pointToSegmentSquared2D(px, py, getPointX(p1), getPointY(p1), getPointX(p2), getPointY(p2)) <= margin2
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

export type AirspaceServer = 'local' | 'cloud';

export const LOCAL_AIRSPACE_BASE_URL = 'http://localhost:8084';
export const CLOUD_AIRSPACE_BASE_URL = 'https://airspaces.storage.googleapis.com';

export function getAirspaceDateUrl(server: AirspaceServer): string {
  const base = server === 'local' ? LOCAL_AIRSPACE_BASE_URL : CLOUD_AIRSPACE_BASE_URL;
  return `${base}/airspaces-date.json`;
}

export function getAirspaceTilesBaseUrl(server: AirspaceServer): string {
  return server === 'local' ? LOCAL_AIRSPACE_BASE_URL : `${CLOUD_AIRSPACE_BASE_URL}/tiles`;
}

export function getAirspaceTilesUrlTemplate(server: AirspaceServer): string {
  return `${getAirspaceTilesBaseUrl(server)}/{z}/{x}/{y}.pbf`;
}

export function getAirspaceTileUrl(x: number, y: number, z: number, server: AirspaceServer): string {
  const url = getAirspaceTilesUrlTemplate(server);
  return url.replace('{x}', String(x)).replace('{y}', String(y)).replace('{z}', String(z));
}

export function getAirspace3dTilesUrlTemplate(server: AirspaceServer): string {
  return `${getAirspaceTilesBaseUrl(server)}/${AIRSPACE_3D_TILE_ZOOM}/{x}/{y}-unclipped.pbf`;
}

export function getAirspace3dTileUrl(x: number, y: number, server: AirspaceServer): string {
  const url = getAirspace3dTilesUrlTemplate(server);
  return url.replace('{x}', String(x)).replace('{y}', String(y));
}

// Return a label for the class and the type, i.e. "E TMA", "E", "TMA" or "".
export function getAirspaceCategory(airspace: AirspaceTyped) {
  const parts = [getClassName(airspace.icaoClass), getTypeName(airspace.type)].filter(Boolean);
  return parts.join(' ');
}

/**
 * Maximum reserved integer ID for airspaces with date/schedule overrides.
 * Standard airspaces without overrides are assigned IDs > 100.
 */
export const RESERVED_AIRSPACE_ID_MAX = 100;

/**
 * Full name and class specifications for airspaces with date/schedule overrides.
 * Matched during tile generation to assign reserved IDs 1..RESERVED_AIRSPACE_ID_MAX.
 *
 * Airspace names are not guaranteed to be unique in OpenAIP: multiple vertical
 * layers or sectors can share the exact same name under different ICAO classes
 * (e.g., "TMA CLERMONT 2.3 ORCINES" exists as both Class D and Class E).
 * Matching by both `name` and `icaoClass` ensures the override is assigned to
 * the correct airspace layer.
 */
export interface AirspaceOverrideTarget {
  id: number;
  name: string;
  icaoClass: Class;
}

export const AIRSPACE_OVERRIDE_TARGETS: AirspaceOverrideTarget[] = [
  // Inactive from July to Oct
  // https://www.ecrins-parcnational.fr/les-survols-non-motorises
  { id: 1, name: 'PARC/RESERVE ECRINS', icaoClass: Class.SUA },
  // See https://www.freedom-parapente.fr/site/puy-de-dome
  { id: 2, name: 'TMA CLERMONT 2.1 (VOL LIBRE)', icaoClass: Class.D },
  { id: 3, name: 'TMA CLERMONT 2.2 CHAMPEIX', icaoClass: Class.D },
  { id: 4, name: 'TMA CLERMONT 2.3 ORCINES', icaoClass: Class.D },
  { id: 5, name: 'TMA CLERMONT 4.1 JOB', icaoClass: Class.D },
  { id: 6, name: 'TMA CLERMONT 5.1 PUY DE DOME', icaoClass: Class.D },
  // Mont Blanc restricted areas (AIP ENR 5.1)
  // - 30A: inactive in July and August (replaced by 30B)
  // - 30B: active in July and August
  // - 30C: active June 1 to October 15
  { id: 7, name: 'LF-R30A MONT BLANC', icaoClass: Class.SUA },
  { id: 8, name: 'LF-R30B MONT BLANC (JULY+AUG)', icaoClass: Class.SUA },
  { id: 9, name: 'LF-R30C MONT BLANC (JUNE - 15 OCT)', icaoClass: Class.SUA },
  // Class E
  // - 2nd Monday of April to 2nd Friday of December
  // - outside the above period: Monday 11:00UTC to Thursday 23:59UTC
  { id: 10, name: 'TMA CHAMBERY 1', icaoClass: Class.E },
  { id: 11, name: 'TMA CHAMBERY 2', icaoClass: Class.E },
  { id: 12, name: 'TMA CHAMBERY 3', icaoClass: Class.E },
  // Disabled
  // - 2nd Monday of April to 2nd Friday of December
  // - outside the above period: Monday 11:00UTC to Thursday 23:59UTC
  { id: 13, name: 'CTR CHAMBERY 2 (ACTIVE MID DEC -> MID APRIL)', icaoClass: Class.D },
];

/**
 * Bidirectional mapping between reserved airspace IDs and canonical override names.
 * Allows 3D vector tile features (which strip string names) to match override rules by ID.
 *
 * @see RESERVED_AIRSPACE_ID_MAX
 */
export const AIRSPACE_OVERRIDE_ID_TO_NAME: Record<number, string> = Object.fromEntries(
  AIRSPACE_OVERRIDE_TARGETS.map((t) => [t.id, t.name]),
);

export const AIRSPACE_OVERRIDE_KEY_TO_ID: Record<string, number> = Object.fromEntries(
  AIRSPACE_OVERRIDE_TARGETS.map((t) => [`${t.name}|${t.icaoClass}`, t.id]),
);

export const AIRSPACE_OVERRIDE_NAME_TO_ID: Record<string, number> = Object.fromEntries(
  AIRSPACE_OVERRIDE_TARGETS.map((t) => [t.name, t.id]),
);

/**
 * Returns the date-resolved overrides for all overridable airspaces.
 */
export function getAirspaceOverrides(date: Date): Map<number, Partial<AirspaceTyped>> {
  const overrides = new Map<number, Partial<AirspaceTyped>>();
  for (const idStr of Object.keys(AIRSPACE_OVERRIDE_ID_TO_NAME)) {
    const id = Number(idStr);
    const override = getAirspaceOverride(id, date);
    if (override) {
      overrides.set(id, override);
    }
  }
  return overrides;
}

/**
 * Applies any date-specific overrides to an airspace.
 */
export function applyOverrides(airspace: AirspaceTyped, date: Date): AirspaceTyped {
  const override = getAirspaceOverride(airspace.id, date);
  return override ? { ...airspace, ...override } : airspace;
}

/**
 * Returns the overridden fields for an airspace on the given date, or undefined if no override applies.
 */
function getAirspaceOverride(id: number, date: Date): Partial<AirspaceTyped> | undefined {
  if (!id || id <= 0 || id > RESERVED_AIRSPACE_ID_MAX) {
    return undefined;
  }

  const tzDate = new TZDate(date, 'Europe/Paris');
  const month = tzDate.getMonth() + 1;

  switch (id) {
    case 1: // PARC/RESERVE ECRINS
      return month >= 7 && month <= 10
        ? { name: `${AIRSPACE_OVERRIDE_ID_TO_NAME[1]} - INACTIVE`, type: Type.Other }
        : undefined;

    case 2: // TMA CLERMONT 2.1 (VOL LIBRE)
    case 3: // TMA CLERMONT 2.2 CHAMPEIX (VOL LIBRE)
      return {
        type: Type.TMA,
        icaoClass: Class.G,
        ...createTopM(isClermontLowerPeriod(tzDate) ? 1680 : 1980),
      };

    case 4: // TMA CLERMONT 2.3 ORCINES (VOL LIBRE)
      return {
        type: Type.TMA,
        icaoClass: Class.G,
        ...createTopM(isClermontLowerPeriod(tzDate) ? 1680 : isSaturday(tzDate) || isSunday(tzDate) ? 2590 : 1980),
      };

    case 5: // TMA CLERMONT 4.1 JOB (VOL LIBRE)
      return {
        type: Type.TMA,
        icaoClass: Class.G,
        ...createTopM(isClermontLowerPeriod(tzDate) ? 2590 : isSaturday(tzDate) || isSunday(tzDate) ? 2895 : 2590),
      };

    case 6: // TMA CLERMONT5.1 PUY DE DOME (VOL LIBRE)
      return {
        type: Type.TMA,
        icaoClass: Class.G,
        ...createTopM(isClermontLowerPeriod(tzDate) ? 2590 : 3505),
      };

    case 7: // LF-R30A MONT BLANC (inactive in July and August)
      return month == 7 || month == 8
        ? { type: Type.Other, name: `${AIRSPACE_OVERRIDE_ID_TO_NAME[7]} - INACTIVE` }
        : undefined;

    case 8: // LF-R30B MONT BLANC (JULY+AUG) (active only in July and August)
      return month == 7 || month == 8
        ? undefined
        : { type: Type.Other, name: `${AIRSPACE_OVERRIDE_ID_TO_NAME[8]} - INACTIVE` };

    case 9: {
      // LF-R30C MONT BLANC (JUNE - 15 OCT) (active from June 1 to October 15)
      const isActive = (month >= 6 && month <= 9) || (month === 10 && tzDate.getDate() <= 15);
      return isActive
        ? undefined
        : { type: Type.Other, name: `${AIRSPACE_OVERRIDE_ID_TO_NAME[9]} - INACTIVE` };
    }

    case 10: // TMA CHAMBERY 1
    case 11: // TMA CHAMBERY 2
    case 12: // TMA CHAMBERY 3
      return { icaoClass: isChamberyWinterWeekend(tzDate) ? Class.D : Class.E };

    case 13: {
      // CTR CHAMBERY 2 (ACTIVE MID DEC -> MID APRIL)
      const base = { ...createTopM(1067), topRefGnd: true };
      return isChamberyWinterWeekend(tzDate)
        ? { ...base, icaoClass: Class.D }
        : {
            ...base,
            icaoClass: Class.SUA,
            type: Type.Other,
            name: `${AIRSPACE_OVERRIDE_ID_TO_NAME[13]} - INACTIVE`,
          };
    }

    default:
      return undefined;
  }
}

/**
 * Returns whether `tzDate` falls in the winter period (before March 15 or after October 15
 * in `Europe/Paris`), when Clermont free-flight TMAs have a lower ceiling.
 */
function isClermontLowerPeriod(tzDate: TZDate): boolean {
  const year = tzDate.getFullYear();
  const start = new TZDate(`${year}-03-15`, 'Europe/Paris');
  const end = new TZDate(`${year}-10-15`, 'Europe/Paris');
  return isBefore(tzDate, start) || isAfter(tzDate, end);
}

/**
 * Returns whether `tzDate` falls in the Chambéry winter weekend activation window
 * (before the 2nd Monday of April or after the 2nd Friday of December, from Friday
 * through Monday 11:59 UTC), when Chambéry TMAs become Class D and CTR 2 is active.
 */
function isChamberyWinterWeekend(tzDate: TZDate): boolean {
  const year = tzDate.getFullYear();
  // 2nd Monday of April
  const start = addDays(nextMonday(new TZDate(`${year}-04-01`, 'Europe/Paris')), 7);
  // 2nd Friday of December
  const end = addDays(nextFriday(new TZDate(`${year}-12-01`, 'Europe/Paris')), 7);

  return (
    (isBefore(tzDate, start) || isAfter(tzDate, end)) &&
    (isFriday(tzDate) || isSaturday(tzDate) || isSunday(tzDate) || (isMonday(tzDate) && tzDate.getUTCHours() <= 11))
  );
}

function createTopM(topM: number) {
  return { topM, topLabel: `${topM}m` };
}
