#!/usr/bin/env node --no-warnings

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
/* eslint-enable @typescript-eslint/no-var-requires */

prog.option('-i, --input <folder>', 'input folder', 'asp').option('-o, --output <file>', 'output file', 'airspaces');
prog.parse(process.argv);

const AIRSPACE_PROHIBITED = 1 << 0;
const AIRSPACE_RESTRICTED = 1 << 1;
const AIRSPACE_DANGER = 1 << 2;
const AIRSPACE_OTHER = 1 << 3;
const BOTTOM_REF_GND = 1 << 4;
const TOP_REF_GND = 1 << 5;

// AIP files
const aipFiles = glob.sync(prog.input + '/**/*_asp.aip');
let airspaces = aipFiles.reduce((asps, f) => [...asps, ...decodeAipFile(f)], []);

// OpenAir files
const openAirFiles = glob.sync(prog.input + '/**/UKRAINE (UK).txt');
airspaces = openAirFiles.reduce((asps, f) => [...asps, ...decodeOpenAirFile(f)], airspaces);

const geoJson = GeoJSON.parse(airspaces, { Polygon: 'polygon' });

fs.writeFileSync(`${prog.output}.geojson`, JSON.stringify(geoJson));

// Decodes AIP format (i.e. from openaip.net).
function decodeAipFile(filename) {
  const xml = fs.readFileSync(filename);
  if (xml.length) {
    const json = JSON.parse(convert.xml2json(xml, { compact: true }));
    if (json.OPENAIP && json.OPENAIP.AIRSPACES && json.OPENAIP.AIRSPACES.ASP) {
      console.log(`# ${path.basename(filename)}`);
      const total = json.OPENAIP.AIRSPACES.ASP.length;
      console.log(` - ${total} airspaces`);
      let airspaces = json.OPENAIP.AIRSPACES.ASP;
      airspaces = airspaces.reduce((as, a) => ((a = decodeAipAirspace(a)) ? as.concat(a) : as), []);
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
  console.log(`# ${path.basename(filename)}`);
  const airspaces = [];
  const openAirLines = fs.readFileSync(filename, 'utf-8').split('\n');

  let category = '';
  let name = '';
  let floor = '';
  let ceiling = '';
  let coords = [];

  for (let line of openAirLines) {
    line = line.trim();
    if (line.startsWith('*')) {
      // comment
      continue;
    }

    if (line.length == 0) {
      if (coords.length) {
        pushOpenAirAirspace(airspaces, name, category, floor, ceiling, coords);
        coords = [];
      }
      continue;
    }

    const m = line.match(/^([A-Z]{1,2}) (.*)$/);

    if (m == null) {
      throw new Error(`Unsupported input: ${line}`);
    }

    switch (m[1]) {
      case 'AC':
        category = m[2].trim();
        coords = [];
        break;
      case 'AN':
        name = m[2].trim();
        break;
      case 'AH':
        ceiling = m[2].trim();
        break;
      case 'AL':
        floor = m[2].trim();
        break;
      case 'DP':
        const ma = m[2].trim().match(/([\d.]+) ([NS]) ([\d.]+) ([EW])/);
        if (ma == null) {
          throw new Error(`Unsupported coordinates ${line}`);
        }
        const lat = parseFloat(ma[1]).toFixed(6) * (ma[2] == 'N' ? 1 : -1);
        const lon = parseFloat(ma[3]).toFixed(6) * (ma[4] == 'E' ? 1 : -1);
        coords.push([lon, lat]);
        break;
      case 'SP':
      case 'SB':
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

// Adds an airspace from an Open Air file.
function pushOpenAirAirspace(airspaces, name, category, bottomLabel, topLabel, coords) {
  const a = {
    name,
    category,
    bottom_lbl: bottomLabel,
    top_lbl: topLabel,
    bottom: Math.round(openAirAltMeter(bottomLabel)),
    top: Math.round(openAirAltMeter(topLabel)),
    polygon: [coords],
    flags: 0,
  };

  a.flags = airspaceTypeFlags(a);

  if (a.flags != 0) {
    a.flags |= openAirReferenceFlags(bottomLabel, topLabel);
    airspaces.push(a);
  }
}

// Decodes a label from an Open Air file and returns the altitude in meters.
function openAirAltMeter(label) {
  if (label == 'GND') {
    return 0;
  }
  let m = label.match(/^FL(\d+)/);
  if (m) {
    return m[1] * 100 * 0.3048;
  }
  m = label.match(/(\d+)ft/);
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

  if (a.flags != 0) {
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
    /(\d+-)?(\d+)\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)/,
    /(\d+)\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)-(\d+)\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)/,
    /\bILS\b/,
    /high paragliding and hang gliding activity/,
  ];

  ignoreRegexp.forEach((r) => {
    if (r.test(airspace.name)) {
      return 0;
    }
  });

  if (airspace.bottom > 6000) {
    return 0; // Ignore airspaces > 6000m
  }

  if (country == 'AU' && (airspace.category == 'E' || airspace.category == 'G') && airspace.top == 0) {
    return 0; // Ignore
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
    default:
      return 0;
  }
}
