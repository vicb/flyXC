#!/usr/bin/env node --no-warnings

// Generate the geojson from the aip files

const convert = require('xml-js');
const fs = require('fs');
const prog = require('commander');
const glob = require('glob');
const path = require('path');
const GeoJSON = require('geojson');

prog
  .option('-i, --input <folder>', 'input folder where to fing *_asp.aip files', 'www.openaip.net')
  .option('-o, --output <file>', 'output file', 'airspaces');

prog.parse(process.argv);

const files = glob.sync(prog.input + '/**/*_asp.aip');

const airspaces = files.reduce((asps, f) => [...asps, ...decodeFile(f)], []);

const geoJson = GeoJSON.parse(airspaces, {'Polygon': 'polygon'});

fs.writeFileSync(`${prog.output}.geojson.js`, 'module.exports = ' + JSON.stringify(geoJson));
fs.writeFileSync(`${prog.output}.geojson`, JSON.stringify(geoJson));

function decodeFile(file) {
  const xml = fs.readFileSync(  file);
  if (xml.length) {
    const json = JSON.parse(convert.xml2json(xml, {compact: true}));
    if (json.OPENAIP && json.OPENAIP.AIRSPACES && json.OPENAIP.AIRSPACES.ASP) {
      console.log(`# ${path.basename(file)}`);
      const total = json.OPENAIP.AIRSPACES.ASP.length;
      console.log(` - ${total} airspaces`)
      let airspaces = json.OPENAIP.AIRSPACES.ASP;
      airspaces = airspaces.reduce((as, a) => (a = decodeAirspace(a)) ? as.concat(a) : as, []);
      if (airspaces.length < total) {
        console.log(` - dropped ${total - airspaces.length} airspaces`);
      }
      return airspaces;
    }
  }
  return [];
}

function decodeAirspace(asp) {
  const category = asp._attributes.CATEGORY;
  const name = asp.NAME._text;
  if (Array.isArray(asp.GEOMETRY.POLYGON)) {
    throw new Error("nested polygons");
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
    bottom: formatAltLimit(asp.ALTLIMIT_BOTTOM),
    bottom_km: Math.floor(altMeter(asp.ALTLIMIT_BOTTOM) / 1000),
    top: formatAltLimit(asp.ALTLIMIT_TOP),
    polygon: [coords],
    color: null,
  };

  a.color = airspaceColor(a, asp.COUNTRY._text, Number(asp.ALTLIMIT_TOP.ALT._text));

  if (a.color !== "") {
    return a;
  }
}

function altMeter(limit) {
  switch (limit.ALT._attributes.UNIT) {
    case "FL":
      return Math.round(100 * 0.3048 * limit.ALT._text);
    case "F":
      return Math.round(0.3048 * limit.ALT._text);
    default:
      return limit.ALT._text;
  }
}

function formatAltLimit(limit) {
  if (limit._attributes.REFERENCE === "GND" && limit.ALT._text == 0) {
    return "GND";
  }
  if (limit.ALT._attributes.UNIT == "FL") {
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
      return "";
    }
  });

  if (airspace.bottom_km > 1) {
    return ""; // Ignore airspaces > 6000m
  }

  if (country == "AU" && (airspace.category == "E" || airspace.category == "G") && top == 0) {
    return "" // Ignore
  }
  if (country == "CO" && airspace.category == "D") {
    return "#808080" // Other
  }
  switch (airspace.category) {
  case "A":
  case "B":
  case "C":
  case "CTR":
  case "D":
  case "RMZ":
  case "TMA":
  case "TMZ":
  case "PROHIBITED":
    return "#bf4040" // Prohibited
  case "E":
  case "F":
  case "G":
  case "GLIDING":
  case "RESTRICTED":
    return "#bfbf40" // Restricted
  case "DANGER":
    return "#bf8040" // Danger
  case "OTH":
    return "#808080" // Other
  case "FIR", "WAVE":
  default:
    return "" // Ignore
  }
}
