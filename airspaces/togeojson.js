#!/usr/bin/env node --no-warnings

// Generate the geojson from aip/openair files

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

// AIP files
const aipFiles = glob.sync(prog.input + '/**/*_asp.aip');
let airspaces = aipFiles.reduce((asps, f) => [...asps, ...decodeAipFile(f)], []);

// OpenAir files
const openAirFiles = glob.sync(prog.input + '/**/UKRAINE (UK).txt');
airspaces = openAirFiles.reduce((asps, f) => [...asps, ...decodeOpenAirFile(f)], airspaces);

const geoJson = GeoJSON.parse(airspaces, { Polygon: 'polygon' });

fs.writeFileSync(`${prog.output}.geojson.js`, 'module.exports = ' + JSON.stringify(geoJson));
fs.writeFileSync(`${prog.output}.geojson`, JSON.stringify(geoJson));

function decodeAipFile(file) {
  const xml = fs.readFileSync(file);
  if (xml.length) {
    const json = JSON.parse(convert.xml2json(xml, { compact: true }));
    if (json.OPENAIP && json.OPENAIP.AIRSPACES && json.OPENAIP.AIRSPACES.ASP) {
      console.log(`# ${path.basename(file)}`);
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

function decodeOpenAirFile(file) {
  console.log(`# ${path.basename(file)}`);
  const airspaces = [];
  const openAirLines = fs.readFileSync(file, 'utf-8').split('\n');

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

function pushOpenAirAirspace(airspaces, name, category, floor, ceiling, coords) {
  const a = {
    name,
    category,
    bottom: floor,
    bottom_km: (openAirAltMeter(floor) / 1000).toFixed(1),
    top: ceiling,
    polygon: [coords],
    color: null,
  };

  a.color = airspaceColor(a, '', Number(openAirAltMeter(ceiling)));

  if (a.color !== '') {
    airspaces.push(a);
  }
}

function openAirAltMeter(str) {
  if (str == 'GND') {
    return 0;
  }
  let m = str.match(/^FL(\d+)/);
  if (m) {
    return m[1] * 100 * 0.3048;
  }
  m = str.match(/(\d+)ft/);
  if (m) {
    return m[1] * 0.3048;
  }
  if (str.startsWith('UNL')) {
    // Unlimited
    return 10000;
  }
  throw new Error(`Unsupported altitude ${str}`);
}

function decodeAipAirspace(asp) {
  const category = asp._attributes.CATEGORY;
  const name = asp.NAME._text;
  if (Array.isArray(asp.GEOMETRY.POLYGON)) {
    throw new Error('nested polygons');
  }

  if (!asp.GEOMETRY.POLYGON._text) {
    console.error(`INVALID Airspace:`, asp);
    return;
  }

  const geometry = asp.GEOMETRY.POLYGON._text
    .replace(/,/g, '')
    .replace(/-?[\d\.]+/g, d => Math.round(d * 10000) / 10000)
    .split(' ')
    .map(s => Number(s));

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
    bottom: formatAipAltLimit(asp.ALTLIMIT_BOTTOM),
    bottom_km: (aipAltMeter(asp.ALTLIMIT_BOTTOM) / 1000).toFixed(1),
    top: formatAipAltLimit(asp.ALTLIMIT_TOP),
    polygon: [coords],
    color: null,
  };

  a.color = airspaceColor(a, asp.COUNTRY._text, Number(asp.ALTLIMIT_TOP.ALT._text));

  if (a.color !== '') {
    return a;
  }
}

function aipAltMeter(limit) {
  switch (limit.ALT._attributes.UNIT) {
    case 'FL':
      return Math.round(100 * 0.3048 * limit.ALT._text);
    case 'F':
      return Math.round(0.3048 * limit.ALT._text);
    default:
      return limit.ALT._text;
  }
}

function formatAipAltLimit(limit) {
  if (limit._attributes.REFERENCE === 'GND' && limit.ALT._text == 0) {
    return 'GND';
  }
  if (limit.ALT._attributes.UNIT == 'FL') {
    return `FL ${Math.round(limit.ALT._text)}`;
  }
  return `${Math.round(limit.ALT._text)}${limit.ALT._attributes.UNIT} ${limit._attributes.REFERENCE}`;
}

function airspaceColor(airspace, country, top) {
  const ignoreRegexp = [
    /(\d+-)?(\d+)\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)/,
    /(\d+)\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)-(\d+)\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)/,
    /\bILS\b/,
    /high paragliding and hang gliding activity/,
  ];

  ignoreRegexp.forEach(r => {
    if (r.test(airspace.name)) {
      return '';
    }
  });

  if (airspace.bottom_km > 6) {
    return ''; // Ignore airspaces > 6000m
  }

  if (country == 'AU' && (airspace.category == 'E' || airspace.category == 'G') && top == 0) {
    return ''; // Ignore
  }
  if (country == 'CO' && airspace.category == 'D') {
    return '#808080'; // Other
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
      return '#bf4040'; // Prohibited
    case 'E':
    case 'F':
    case 'G':
    case 'GLIDING':
    case 'RESTRICTED':
      return '#bfbf40'; // Restricted
    case 'DANGER':
      return '#bf8040'; // Danger
    case 'OTH':
      return '#808080'; // Other
    case 'FIR':
    case 'WAVE':
    default:
      return ''; // Ignore
  }
}
