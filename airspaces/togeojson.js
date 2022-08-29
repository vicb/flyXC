#!/usr/bin/env node

// Generate the geojson from aip/openair files
//
// Open air docs: http://www.winpilot.com/UsersGuide/UserAirspace.asp

/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const prog = require('commander');
const glob = require('glob');
const path = require('path');
const GeoJSON = require('geojson');
const geolib = require('geolib');

prog
  .option('-i, --input <folder>', 'input folder', 'asp')
  .option('-o, --output <file>', 'output file', 'airspaces')
  .parse();

const AIRSPACE_IGNORED = 0;
const AIRSPACE_PROHIBITED = 1 << 0;
const AIRSPACE_RESTRICTED = 1 << 1;
const AIRSPACE_DANGER = 1 << 2;
const AIRSPACE_OTHER = 1 << 3;
const BOTTOM_REF_GND = 1 << 4;
const TOP_REF_GND = 1 << 5;

const CLASS_A = 0;
const CLASS_B = 1;
const CLASS_C = 2;
const CLASS_D = 3;
const CLASS_E = 4;
const CLASS_F = 5;
const CLASS_G = 6;

const TYPE_RESTRICTED = 1;
const TYPE_DANGER = 2;
const TYPE_PROHIBITED = 3;
const TYPE_CTR = 4;
const TYPE_TMZ = 5;
const TYPE_RMZ = 6;
const TYPE_TMA = 7;
const TYPE_FIR = 10;
const TYPE_ATZ = 13;
const TYPE_AIRWAY = 15;
const TYPE_GLIDING = 21;
const TYPE_CTA = 26;
const TYPE_LOW_ALT_RESTRICTION = 29;

let airspaces = [];

// openaip.net file.
const aipFiles = glob.sync(prog.opts().input + '/airspaces.json');
for (const file of aipFiles) {
  const asp = decodeAipFile(file);
  airspaces.push(...asp);
}

// Ukraine.
const ukraineFiles = glob.sync(prog.opts().input + '/UKRAINE (UK).txt');
if (ukraineFiles.length == 0) {
  throw new Error('Ukraine file not found');
}
for (const file of ukraineFiles) {
  airspaces.push(...decodeOpenAirFile(file));
}

// Reunion
const reunionFile = glob.sync(prog.opts().input + '/../fixedasp/reunion.txt');
if (reunionFile.length != 1) {
  throw new Error('Reunion file not found');
}
airspaces.push(...decodeOpenAirFile(reunionFile[0]));

// Write output.
console.log(`\nTotal: ${airspaces.length} airspaces`);

const geoJson = GeoJSON.parse(airspaces, { Polygon: 'polygon' });

fs.writeFileSync(`${prog.opts().output}.geojson`, JSON.stringify(geoJson));

// Decodes AIP format (i.e. from openaip.net).
function decodeAipFile(filename) {
  const json = fs.readFileSync(filename);
  if (json.length) {
    const inAirspaces = JSON.parse(json);
    console.log(`\n# ${path.basename(filename)}`);
    const total = inAirspaces.length;
    console.log(` - ${total} airspaces`);
    const airspaces = inAirspaces.map((aip) => decodeAipAirspace(aip)).filter((asp) => asp != null);
    if (airspaces.length < total) {
      console.log(` - dropped ${total - airspaces.length} airspaces`);
    }
    return airspaces;
  }
  return [];
}

// Returns the altitude in meter for an AIP limit.
function aipAltLimitMeter(limit) {
  switch (limit.unit) {
    case 6:
      return Math.round(100 * 0.3048 * limit.value);
    case 1:
      return Math.round(0.3048 * limit.value);
    default:
      return limit.value;
  }
}

// Returns the label for an AIP limit.
function aipAltLimitLabel(limit) {
  if (limit.referenceDatum == 0 && limit.value == 0) {
    return 'GND';
  }
  if (limit.unit == 6) {
    return `FL ${Math.round(limit.value)}`;
  }

  const unit = limit.unit == 0 ? 'm' : 'ft';
  let ref;
  if (limit.referenceDatum == 0) {
    ref = 'GND';
  } else if (limit.referenceDatum == 1) {
    ref = 'MSL';
  } else {
    ref = 'STD';
  }

  return `${Math.round(limit.value)}${unit} ${ref}`;
}

// Decodes Open Air format.
function decodeOpenAirFile(filename) {
  console.log(`\n# ${path.basename(filename)}`);
  const airspaces = [];
  const openAirLines = fs.readFileSync(filename, 'utf-8').split('\n');

  // (Counter-)Clockwise direction.
  const DIR_CW = 'CW';
  const DIR_CCW = 'CCW';
  const NM = 1852;

  let category = '';
  let name = '';
  let floor = '';
  let ceiling = '';
  let coords = [];
  // Default is clockwise
  let direction = DIR_CW;
  let center;

  for (let line of openAirLines) {
    line = line.trim();

    if (line.startsWith('*') || line.length == 0) {
      if (coords.length) {
        pushOpenAirAirspace(airspaces, name, category, floor, ceiling, coords);
        coords = [];
        direction = DIR_CW;
        center = undefined;
      }
      continue;
    }

    const m = line.match(/^([A-Z]{1,2}) (.*)$/);

    if (m == null) {
      throw new Error(`Unsupported input: ${line}`);
    }

    switch (m[1]) {
      case 'AC': // Class
        category = m[2].trim();
        coords = [];
        break;
      case 'AN': // Name
        name = m[2].trim();
        break;
      case 'AH': // Ceiling
        ceiling = m[2].trim();
        break;
      case 'AL': // Floor
        floor = m[2].trim();
        break;
      case 'DP': // Point
        const point = decodeOpenAirCoordinates(m[2]);
        if (point == null) {
          throw new Error(`Unsupported coordinates ${line}`);
        }
        coords.push([point.lon, point.lat]);
        break;

      case 'V': // Variable
        let sm = m[2].match(/D=(\+|-)/);
        if (sm != null) {
          direction = sm[1] == '+' ? DIR_CW : DIR_CCW;
          break;
        }
        sm = m[2].match(/X=/);
        if (sm != null) {
          center = decodeOpenAirCoordinates(m[2]);
          if (center == null) {
            throw new Error(`Unsupported coordinates ${line}`);
          }
          break;
        }
        throw new Error(`Unsupported variable ${line}`);

      case 'DB': // Arc
        const [start, end] = m[2].split(',').map((coords) => decodeOpenAirCoordinates(coords));
        if (start == null || end == null) {
          throw new Error(`Invalid arc ${line}`);
        }
        if (center == null) {
          throw new Error(`No center for DB ${line}`);
        }
        let angle = geolib.getGreatCircleBearing(center, start);
        let endAngle = geolib.getGreatCircleBearing(center, end);
        if (direction === DIR_CW && endAngle < angle) {
          endAngle += 360;
        }
        if (direction === DIR_CCW && endAngle > angle) {
          endAngle -= 360;
        }
        const angleStep = 10 * (direction === DIR_CW ? 1 : -1);
        const distance = geolib.getDistance(center, start);
        for (let i = 0; true; i++) {
          const { latitude, longitude } = geolib.computeDestinationPoint(center, distance, angle);
          coords.push([longitude, latitude]);
          angle += angleStep;
          if (direction === DIR_CW && angle > endAngle) {
            break;
          }
          if (direction === DIR_CCW && angle < endAngle) {
            break;
          }
          if (i > 100) {
            throw new Error(`Angle error`);
          }
        }
        const { latitude, longitude } = geolib.computeDestinationPoint(center, distance, endAngle);
        coords.push([longitude, latitude]);
        break;

      case 'DC': // Circle
        if (center == null) {
          throw new Error(`No center for DC ${line}`);
        }
        for (let angle = 0; angle <= 360; angle += 10) {
          const { latitude, longitude } = geolib.computeDestinationPoint(center, NM * parseFloat(m[2]), angle);
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

  if (coords.length) {
    pushOpenAirAirspace(airspaces, name, category, floor, ceiling, coords);
  }

  console.log(` - ${airspaces.length} airspaces`);
  return airspaces;
}

function decodeOpenAirCoordinates(coords) {
  // 50.3450012207031 N 033.9560012817383 E
  let match = coords.match(/([\d.]+) (N|S) ([\d.]+) (E|W)/);
  if (match != null) {
    const lat = parseFloat(match[1]).toFixed(6) * (match[2] == 'N' ? 1 : -1);
    const lon = parseFloat(match[3]).toFixed(6) * (match[4] == 'E' ? 1 : -1);
    return { lon, lat };
  }
  // 30:58:01 N 084:49:00 W
  match = coords.match(/([\d:]+) (N|S) ([\d:]+) (W|E)/);
  if (match != null) {
    let [d, m, s] = match[1].split(':').map((s) => parseFloat(s));
    const lat = geolib.sexagesimalToDecimal(`${d}° ${m}' ${s}" ${match[2]}`);
    [d, m, s] = match[3].split(':').map((s) => parseFloat(s));
    const lon = geolib.sexagesimalToDecimal(`${d}° ${m}' ${s}" ${match[4]}`);
    return { lon, lat };
  }
}

function trimCoords(coords) {
  return coords.map(([lon, lat]) => [Math.round(lon * 1e7) / 1e7, Math.round(lat * 1e7) / 1e7]);
}

// Adds an airspace from an Open Air file.
function pushOpenAirAirspace(airspaces, name, category, bottomLabel, topLabel, coords) {
  const a = {
    name,
    category,
    bottom_lbl: bottomLabel,
    top_lbl: topLabel,
    bottom: Math.round(openAirAltMeter(bottomLabel)),
    top: Math.round(openAirAltMeter(topLabel)),
    polygon: [trimCoords(coords)],
    flags: 0,
  };

  a.flags = airspaceTypeFlags(a);

  if (a.flags != AIRSPACE_IGNORED) {
    a.flags |= openAirReferenceFlags(bottomLabel, topLabel);
    airspaces.push(a);
  }
}

// Decodes a label from an Open Air file and returns the altitude in meters.
function openAirAltMeter(label) {
  if (label == 'GND' || label == 'SFC') {
    return 0;
  }
  let m = label.match(/^FL\s*(\d+)/);
  if (m) {
    return m[1] * 100 * 0.3048;
  }
  m = label.match(/(\d+)\s*(FT|AGL|MSL|ALT)/i);
  if (m) {
    return m[1] * 0.3048;
  }
  if (label.startsWith('UNL')) {
    // Unlimited
    return 10000;
  }
  throw new Error(`Unsupported altitude ${label}`);
}

// Return the airspace flags for GND reference.
function openAirReferenceFlags(bottomLabel, topLabel) {
  let flags = 0;
  if (bottomLabel.toUpperCase().indexOf('AGL') > -1 || bottomLabel.toUpperCase() === 'GND') {
    flags |= BOTTOM_REF_GND;
  }
  if (topLabel.toUpperCase().indexOf('AGL') > -1) {
    flags |= TOP_REF_GND;
  }
  return flags;
}

function decodeAipAirspace(asp) {
  let category;
  if (asp.type == TYPE_RESTRICTED || asp.type == TYPE_LOW_ALT_RESTRICTION) {
    category = 'RESTRICTED';
  } else if (asp.type == TYPE_DANGER) {
    category = 'DANGER';
  } else if (asp.type == TYPE_PROHIBITED) {
    category = 'PROHIBITED';
  } else if (asp.type == TYPE_CTR) {
    category = 'CTR';
  } else if (asp.type == TYPE_TMZ) {
    category = 'TMZ';
  } else if (asp.type == TYPE_RMZ) {
    category = 'RMZ';
  } else if (asp.type == TYPE_TMA) {
    category = 'TMA';
  } else if (asp.type == TYPE_FIR) {
    category = 'FIR';
  } else if (asp.type == TYPE_ATZ) {
    category = 'ATZ';
  } else if (asp.type == TYPE_AIRWAY) {
    category = 'AIRWAY';
  } else if (asp.type == TYPE_GLIDING) {
    category = 'GLIDING';
  } else if (asp.type == TYPE_CTA) {
    category = 'CTA';
  } else if (asp.icaoClass == CLASS_A) {
    category = 'A';
  } else if (asp.icaoClass == CLASS_B) {
    category = 'B';
  } else if (asp.icaoClass == CLASS_C) {
    category = 'C';
  } else if (asp.icaoClass == CLASS_D) {
    category = 'D';
  } else if (asp.icaoClass == CLASS_E) {
    category = 'E';
  } else if (asp.icaoClass == CLASS_F) {
    category = 'F';
  } else if (asp.icaoClass == CLASS_G) {
    category = 'G';
  } else {
    category = `type ${asp.type}`;
  }

  const name = asp.name;
  if (asp.geometry.type != 'Polygon') {
    throw new Error('not a polygon');
  }

  if (asp.geometry.coordinates[0].length == 0) {
    // Some airspaces have no geometry.
    console.error(` - INVALID Airspace: ${name} (${asp.country})`);
    return;
  }

  const coords = asp.geometry.coordinates[0].map(([c1, c2]) => [
    Math.round(c1 * 10000) / 10000,
    Math.round(c2 * 10000) / 10000,
  ]);

  const a = {
    name,
    category: category,
    bottom_lbl: aipAltLimitLabel(asp.lowerLimit),
    top_lbl: aipAltLimitLabel(asp.upperLimit),
    bottom: Math.round(aipAltLimitMeter(asp.lowerLimit)),
    top: Math.round(aipAltLimitMeter(asp.upperLimit)),
    polygon: [coords],
    flags: 0,
  };

  a.flags = airspaceTypeFlags(a, asp.country);

  if (a.flags != AIRSPACE_IGNORED) {
    a.flags |= openAipReferenceFlags(asp);
    return a;
  }
}

// Returns the GND reference flags for an AIP airspace.
function openAipReferenceFlags(asp) {
  let flags = 0;
  if (asp.lowerLimit.referenceDatum == 0) {
    flags |= BOTTOM_REF_GND;
  }
  if (asp.upperLimit.referenceDatum == 0) {
    flags |= TOP_REF_GND;
  }
  return flags;
}

// Return the flags for the type of the airspace.
function airspaceTypeFlags(airspace, country = '') {
  const ignoreRegexp = [
    /(\d+-)?(\d+)\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\b/,
    /(\d+)\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)-(\d+)\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\b/,
    /\bILS\b/,
    /high paragliding and hang gliding activity/,
  ];

  for (const regexp of ignoreRegexp) {
    if (regexp.test(airspace.name)) {
      console.info(`Ignored airspace (name) "${airspace.name}"`);
      return AIRSPACE_IGNORED;
    }
  }

  if (airspace.bottom > 6000) {
    console.info(`Ignored airspace (> 6000m) "${airspace.name}"`);
    return AIRSPACE_IGNORED;
  }

  if (country == 'AU' && (airspace.category == 'E' || airspace.category == 'G') && airspace.top == 0) {
    return AIRSPACE_IGNORED;
  }
  if (country == 'CO' && airspace.category == 'D') {
    return AIRSPACE_OTHER;
  }

  // https://github.com/vicb/flyxc/issues/101
  if (airspace.category == 'RMZ' && airspace.name.includes('RAZ')) {
    airspace.category = 'RAZ';
  }

  switch (airspace.category) {
    case 'A':
    case 'B':
    case 'C':
    case 'CTR':
    case 'D':
    case 'TMA':
    case 'PROHIBITED':
    case 'ATZ':
    case 'CTA':
      return AIRSPACE_PROHIBITED;
    case 'E':
    case 'F':
    case 'G':
    case 'RMZ': // Radio Mandatory Zone
    case 'TMZ':
    case 'GLIDING':
    case 'RESTRICTED':
    case 'R':
    case 'RAZ': // Radio Advisory Zone
      return AIRSPACE_RESTRICTED;
    case 'DANGER':
      return AIRSPACE_DANGER;
    case 'OTH':
      return AIRSPACE_OTHER;
    case 'FIR':
    case 'WAVE':
    case 'AIRWAY':
    case 'TRANING': // Ukraine
    case 'UNKNOWN': // Ukraine
    case 'Q': // Reunion
    case 'Q2': // Reunion
    case 'Q5': // Reunion
    case 'Q6': // Reunion
    case 'Q7': // Reunion
      console.info(`Ignored airspace (category "${airspace.category}") "${airspace.name}"`);
      return AIRSPACE_IGNORED;
    default:
      console.info(`Ignored airspace (category "${airspace.category}") "${airspace.name}"`);
      return AIRSPACE_IGNORED;
  }
}
