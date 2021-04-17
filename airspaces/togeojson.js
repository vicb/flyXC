#!/usr/bin/env node

// Generate the geojson from aip/openair files
//
// Open air docs: http://www.winpilot.com/UsersGuide/UserAirspace.asp

/* eslint-disable @typescript-eslint/no-var-requires */
const convert = require('xml-js');
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

let airspaces = [];

// openaip.net files (AIP format).
const aipFiles = glob.sync(prog.opts().input + '/**/*_asp.aip');
for (const file of aipFiles) {
  const asp = decodeAipFile(file);
  // OpenAIP does not contain class E2 as of Apr 2021.
  // We get them from soaringdata.info.
  if (file.indexOf('us_asp.aip') > -1) {
    const catE = asp.filter((a) => a.category.toUpperCase().startsWith('E')).length;
    if (catE > 0) {
      throw new Error('Unexpected class E in us_asp.aip');
    }
    console.info('No class E in us_asp.aip (expected)');
  }
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

// US Class E
const USClassE = decodeOpenAirFile(prog.opts().input + '/US-classE.txt').filter((a) => a.category == 'E');
console.log(`\n# US class E: ${USClassE.length} airspaces`);
airspaces.push(...USClassE);

// Write output.
console.log(`\nTotal: ${airspaces.length} airspaces`);

const geoJson = GeoJSON.parse(airspaces, { Polygon: 'polygon' });

fs.writeFileSync(`${prog.opts().output}.geojson`, JSON.stringify(geoJson));

// Decodes AIP format (i.e. from openaip.net).
function decodeAipFile(filename) {
  const xml = fs.readFileSync(filename);
  if (xml.length) {
    const json = JSON.parse(convert.xml2json(xml, { compact: true }));
    if (json.OPENAIP && json.OPENAIP.AIRSPACES && json.OPENAIP.AIRSPACES.ASP) {
      console.log(`\n# ${path.basename(filename)}`);
      const total = json.OPENAIP.AIRSPACES.ASP.length;
      console.log(` - ${total} airspaces`);
      const airspaces = json.OPENAIP.AIRSPACES.ASP.map((aip) => decodeAipAirspace(aip)).filter(
        (airspace) => airspace != null,
      );
      if (airspaces.length < total) {
        console.log(` - dropped ${total - airspaces.length} airspaces`);
      }
      return airspaces;
    }
  }
  return [];
}

// Returns the altitude in meter for an AIP limit.
function aipAltLimitMeter(limit) {
  switch (limit.ALT._attributes.UNIT) {
    case 'FL':
      return Math.round(100 * 0.3048 * limit.ALT._text);
    case 'F':
      return Math.round(0.3048 * limit.ALT._text);
    default:
      return limit.ALT._text;
  }
}

// Returns the label for an AIP limit.
function aipAltLimitLabel(limit) {
  if (limit._attributes.REFERENCE === 'GND' && limit.ALT._text == 0) {
    return 'GND';
  }
  if (limit.ALT._attributes.UNIT == 'FL') {
    return `FL ${Math.round(limit.ALT._text)}`;
  }
  return `${Math.round(limit.ALT._text)}${limit.ALT._attributes.UNIT} ${limit._attributes.REFERENCE}`;
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

// Decodes an airspace in Open Air format.
function decodeAipAirspace(asp) {
  const category = asp._attributes.CATEGORY;
  const name = asp.NAME._text;
  if (Array.isArray(asp.GEOMETRY.POLYGON)) {
    throw new Error('nested polygons');
  }

  if (!asp.GEOMETRY.POLYGON._text) {
    // Some airspaces have no geometry.
    console.error(` - INVALID Airspace: ${name} (${asp.COUNTRY._text})`);
    return;
  }

  const geometry = asp.GEOMETRY.POLYGON._text
    .replace(/,/g, '')
    .replace(/-?[\d\.]+/g, (d) => Math.round(d * 10000) / 10000)
    .split(' ')
    .map((s) => Number(s));

  if (geometry.length < 4) {
    return;
  }

  const coords = [];
  for (let i = 0; i < geometry.length; i += 2) {
    coords.push([geometry[i], geometry[i + 1]]);
  }

  const a = {
    name,
    category: category,
    bottom_lbl: aipAltLimitLabel(asp.ALTLIMIT_BOTTOM),
    top_lbl: aipAltLimitLabel(asp.ALTLIMIT_TOP),
    bottom: Math.round(aipAltLimitMeter(asp.ALTLIMIT_BOTTOM)),
    top: Math.round(aipAltLimitMeter(asp.ALTLIMIT_TOP)),
    polygon: [coords],
    flags: 0,
  };

  a.flags = airspaceTypeFlags(a, asp.COUNTRY._text);

  if (a.flags != AIRSPACE_IGNORED) {
    a.flags |= openAipReferenceFlags(asp);
    return a;
  }
}

// Returns the GND reference flags for an AIP airspace.
function openAipReferenceFlags(asp) {
  let flags = 0;
  if (asp.ALTLIMIT_BOTTOM._attributes.REFERENCE === 'GND') {
    flags |= BOTTOM_REF_GND;
  }
  if (asp.ALTLIMIT_TOP._attributes.REFERENCE === 'GND') {
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

  switch (airspace.category) {
    case 'A':
    case 'B':
    case 'C':
    case 'CTR':
    case 'D':
    case 'RMZ':
    case 'TMA':
    case 'TMZ':
    case 'PROHIBITED':
      return AIRSPACE_PROHIBITED;
    case 'E':
    case 'F':
    case 'G':
    case 'GLIDING':
    case 'RESTRICTED':
      return AIRSPACE_RESTRICTED;
    case 'DANGER':
      return AIRSPACE_DANGER;
    case 'OTH':
      return AIRSPACE_OTHER;
    case 'FIR':
    case 'WAVE':
    case 'T': // Ukraine
    case 'R': // Ukraine
    case 'P': // Ukraine
    case 'Q': // US
      return AIRSPACE_IGNORED;
    default:
      console.info(`Ignored airspace (category "${airspace.category}") "${airspace.name}"`);
      return AIRSPACE_IGNORED;
  }
}
