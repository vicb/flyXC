// Parser for the OpenAir format.
//
// See http://www.winpilot.com/usersguide/userairspace.asp

import { Activity, Class, Type, decodeClass } from '@flyxc/common';
import { computeDestinationPoint, getDistance, getGreatCircleBearing, sexagesimalToDecimal } from 'geolib';
import type { Airspace} from './parser';
import { METER_PER_FEET, roundCoords } from './parser';

const enum Direction {
  Clockwise = 1,
  CounterClockwise = 2,
}
const NAUTICAL_MILE_IN_METER = 1852;

function decodeCoordinates(coords: string): { lat: number; lon: number } {
  // 50.3450012207031 N 033.9560012817383 E
  let match = coords.match(/([\d.]+) (N|S) ([\d.]+) (E|W)/);
  if (match != null) {
    const lat = Number(parseFloat(match[1]).toFixed(6)) * (match[2] == 'N' ? 1 : -1);
    const lon = Number(parseFloat(match[3]).toFixed(6)) * (match[4] == 'E' ? 1 : -1);
    return { lon, lat };
  }
  // 30:58:01 N 084:49:00 W
  match = coords.match(/([\d:]+) (N|S) ([\d:]+) (W|E)/);
  if (match != null) {
    let [d, m, s] = match[1].split(':').map((s) => parseFloat(s));
    const lat = sexagesimalToDecimal(`${d}° ${m}' ${s}" ${match[2]}`);
    [d, m, s] = match[3].split(':').map((s) => parseFloat(s));
    const lon = sexagesimalToDecimal(`${d}° ${m}' ${s}" ${match[4]}`);
    return { lon, lat };
  }

  throw new Error(`Can not decode coordinates ${coords}`);
}

// Decodes a label from an Open Air file and returns the altitude in meters.
function parseAltitude(label: string): number {
  if (label == 'GND' || label == 'SFC') {
    return 0;
  }
  let m = label.match(/^FL\s*(\d+)/);
  if (m) {
    return Math.round(Number(m[1]) * 100 * METER_PER_FEET);
  }
  m = label.match(/(\d+)\s*(FT|AGL|MSL|ALT)/i);
  if (m) {
    return Math.round(Number(m[1]) * METER_PER_FEET);
  }
  if (label.startsWith('UNL')) {
    // Unlimited
    return 10000;
  }
  throw new Error(`Unsupported altitude ${label}`);
}

export function parseAll(openair: string, country: string): Airspace[] {
  const airspaces: Airspace[] = [];
  // AC field
  let name = '';
  let floorLabel = '';
  let topLabel = '';
  const coords: [lon: number, lat: number][] = [];
  // Default is clockwise
  let direction = Direction.Clockwise;
  let center: { lat: number; lon: number } | undefined;
  let icaoClass: Class;
  let type: Type;
  // Ignore airspaces that do not translate to an openaip format.
  // true to ignore the first AC.
  let ignoreAirspace = true;

  const lines = openair.split('\n');

  const pushAirspace = () => {
    if (coords.length && floorLabel != '' && topLabel != '' && !ignoreAirspace) {
      airspaces.push({
        name,
        country,
        type,
        icaoClass,
        activity: Activity.None,
        floorM: parseAltitude(floorLabel),
        floorLabel,
        floorRefGnd: floorLabel.toUpperCase().indexOf('AGL') > -1 || floorLabel.toUpperCase() === 'GND',
        topM: parseAltitude(topLabel),
        topLabel,
        topRefGnd: topLabel.toUpperCase().indexOf('AGL') > -1,
        polygon: [roundCoords(coords)],
      });
      coords.length = 0;
      direction = Direction.Clockwise;
      center = undefined;
      floorLabel = '';
      topLabel = '';
    }
  };

  for (let line of lines) {
    line = line.trim();

    if (line.length == 0 || line.startsWith('*')) {
      continue;
    }

    const m = line.trim().match(/^(?<field>[A-Z]{1,2}) (?<content>.*)$/);

    if (m == null) {
      throw new Error(`Unsupported input: ${line}`);
    }

    const { field, content } = m.groups;

    switch (field) {
      case 'AC': {
        // Class
        // Push the previous airspace.
        pushAirspace();
        const ac = decodeACField(content.trim(), country);
        icaoClass = ac.icaoClass;
        type = ac.type;
        ignoreAirspace = ac.ignoreAirspace;
        break;
      }
      case 'AN': // Name
        name = content.trim();
        break;
      case 'AH': // Ceiling
        topLabel = content.trim();
        break;
      case 'AL': // Floor
        floorLabel = content.trim();
        break;
      case 'DP': {
        // Point
        const point = decodeCoordinates(content);
        if (point == null) {
          throw new Error(`Unsupported coordinates ${line}`);
        }
        coords.push([point.lon, point.lat]);
        break;
      }

      case 'V': {
        // Variable
        let sm = content.match(/D=(\+|-)/);
        if (sm != null) {
          direction = sm[1] == '+' ? Direction.Clockwise : Direction.CounterClockwise;
          break;
        }
        sm = content.match(/X=/);
        if (sm != null) {
          center = decodeCoordinates(content);
          if (center == null) {
            throw new Error(`Unsupported coordinates ${line}`);
          }
          break;
        }
        throw new Error(`Unsupported variable ${line}`);
      }

      case 'DB': {
        // Arc
        const [start, end] = content.split(',').map((coords) => decodeCoordinates(coords));
        if (start == null || end == null) {
          throw new Error(`Invalid arc ${line}`);
        }
        if (center == null) {
          throw new Error(`No center for DB ${line}`);
        }
        let angle = getGreatCircleBearing(center, start);
        let endAngle = getGreatCircleBearing(center, end);
        if (direction === Direction.Clockwise && endAngle < angle) {
          endAngle += 360;
        }
        if (direction === Direction.CounterClockwise && endAngle > angle) {
          endAngle -= 360;
        }
        const angleStep = 10 * (direction === Direction.Clockwise ? 1 : -1);
        const distance = getDistance(center, start);
        // eslint-disable-next-line no-constant-condition
        for (let i = 0; true; i++) {
          const { latitude, longitude } = computeDestinationPoint(center, distance, angle);
          coords.push([longitude, latitude]);
          angle += angleStep;
          if (direction === Direction.Clockwise && angle > endAngle) {
            break;
          }
          if (direction === Direction.CounterClockwise && angle < endAngle) {
            break;
          }
          if (i > 100) {
            throw new Error(`Angle error`);
          }
        }
        const { latitude, longitude } = computeDestinationPoint(center, distance, endAngle);
        coords.push([longitude, latitude]);
        break;
      }

      case 'DC': // Circle
        if (center == null) {
          throw new Error(`No center for DC ${line}`);
        }
        for (let angle = 0; angle <= 360; angle += 10) {
          const { latitude, longitude } = computeDestinationPoint(
            center,
            NAUTICAL_MILE_IN_METER * parseFloat(content),
            angle,
          );
          coords.push([longitude, latitude]);
        }
        break;

      case 'SP': // Pen, ignore
      case 'SB': // Brush, ignore
        break;
      default:
        throw new Error(`Unsupported record ${m[1]}`);
    }
  }

  // Push the last airspace.
  pushAirspace();

  return airspaces;
}

function decodeACField(ac: string, country: string) {
  if (ac === 'CTR') {
    return {
      icaoClass: Class.D,
      type: Type.CTR,
      ignoreAirspace: false,
    };
  }

  if (ac.match(/Q\d?/) || ac === 'DANGER') {
    return {
      icaoClass: Class.SUA,
      type: Type.Danger,
      ignoreAirspace: false,
    };
  }

  if (ac === 'R' || ac === 'RESTRICTED') {
    return {
      icaoClass: Class.SUA,
      type: Type.Restricted,
      ignoreAirspace: false,
    };
  }

  if (ac === 'PROHIBITED') {
    return {
      icaoClass: Class.SUA,
      type: Type.Prohibited,
      ignoreAirspace: false,
    };
  }

  // Ukraine specific rules
  if (country == 'UA') {
    if (['ATZ', 'UNKNOWN', 'TRANING', 'FIR'].includes(ac)) {
      return {
        icaoClass: Class.SUA,
        type: Type.Other,
        ignoreAirspace: true,
      };
    }
  }

  return {
    icaoClass: decodeClass(ac),
    // The type might be refined by post-processing (from the name).
    type: Type.Other,
    ignoreAirspace: false,
  };
}
