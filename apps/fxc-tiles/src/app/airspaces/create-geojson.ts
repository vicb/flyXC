// #!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { Type } from '@flyxc/common';
import { program } from 'commander';

import * as oaip from '../parser/openaip';
import * as oair from '../parser/openair';
import type { Airspace } from '../parser/parser';
import { getAppFolderFromDist } from '../util';

const GeoJSON = require('geojson');

// Filter out airspaces above:
const MAX_FLOOR_METER = 6000;

const defaultInputFolder = resolve(join(getAppFolderFromDist(__dirname), '/src/assets/airspaces'));
const defaultOutputFile = resolve(join(getAppFolderFromDist(__dirname), '/src/assets/airspaces/airspaces.geojson'));

program
  .option('-i, --input <folder>', 'input folder', defaultInputFolder)
  .option('-o, --output <file>', 'output file', defaultOutputFile)
  .parse();

const logs = new Map<string, number>();
const filterFn = createFilter(logs);
const processFn = createProcess(logs);

// OpenAip.
console.log('# Open AIP airspaces');
const openaipContent = readFileSync(join(program.opts().input, 'openaip.json'), 'utf-8');
let openaipAirspaces = oaip.parseAll(JSON.parse(openaipContent));
console.log(`${openaipAirspaces.length} airspaces imported`);
// post process
openaipAirspaces = openaipAirspaces.map(processFn);
printLogs('Processed:', logs);
// filter
openaipAirspaces = openaipAirspaces.filter(filterFn);
printLogs('Filtered:', logs);
console.log(`-> ${openaipAirspaces.length} airspaces`);

// Ukraine
console.log('\n# Ukraine airspaces');
const uaContent = readFileSync(join(program.opts().input, 'UKRAINE (UK).txt'), 'utf-8');
let uaAirspaces = oair.parseAll(uaContent, 'UA');
console.log(`${uaAirspaces.length} airspaces imported`);
// post process
uaAirspaces = uaAirspaces.map(processFn);
printLogs('Processed:', logs);
// filter
uaAirspaces = uaAirspaces.filter(filterFn);
printLogs('Filtered:', logs);
console.log(`-> ${uaAirspaces.length} airspaces`);

// Reunion
console.log('\n# Reunion airspaces');
const reContent = readFileSync(join(program.opts().input, 'reunion.txt'), 'utf-8');
let reAirspaces = oair.parseAll(reContent, 'RE');
console.log(`${reAirspaces.length} airspaces imported`);
// post process
reAirspaces = reAirspaces.map(processFn);
printLogs('Processed:', logs);
// filter
reAirspaces = reAirspaces.filter(filterFn);
printLogs('Filtered:', logs);
console.log(`-> ${reAirspaces.length} airspaces`);

console.log('\n# Airspaces');
const airspaces = [...openaipAirspaces, ...uaAirspaces, ...reAirspaces];
console.log(`-> ${airspaces.length} airspaces`);
const airspaceObj = GeoJSON.parse(airspaces, { Polygon: 'polygon' });
writeFileSync(program.opts().output, JSON.stringify(airspaceObj, null, 2));

console.log(`\n# Generated ${program.opts().output}`);

// Filter unwanted airspaces.
function createFilter(logs: Map<string, number>) {
  return (airspace: Airspace, index: number) => {
    if (index == 0) {
      logs.clear();
    }
    if (airspace.name.match(/\bILS\b/)) {
      incMapKey(logs, 'ILS');
      return false;
    }

    if (airspace.floorM > MAX_FLOOR_METER) {
      incMapKey(logs, `floor higher than ${MAX_FLOOR_METER}m`);
      return false;
    }

    return true;
  };
}

// Process airspaces.
function createProcess(logs: Map<string, number>) {
  return (airspace: Airspace, index: number) => {
    airspace = { ...airspace };
    if (index == 0) {
      logs.clear();
    }

    if (airspace.country == 'UA' && airspace.type == Type.Other) {
      const typesByName = new Map([
        ['CTR', Type.CTR],
        ['TMA', Type.TMA],
        ['TRA', Type.TRA],
        ['TSA', Type.TSA],
        ['FIR', Type.FIR],
        ['CTA', Type.CTA],
      ]);
      for (const [name, type] of typesByName.entries()) {
        if (airspace.name.match(new RegExp(`\\b${name}\\b`))) {
          incMapKey(logs, `Updated type because name contains "${name}" (${airspace.country})`);
          airspace.type = type;
        }
      }
    }

    return airspace;
  };
}

function incMapKey(m: Map<string, number>, key: string) {
  m.set(key, (m.get(key) ?? 0) + 1);
}

function printLogs(title: string, m: Map<string, number>) {
  console.log(`${title} ${m.size == 0 ? ' -' : ''}`);
  for (const [key, count] of m.entries()) {
    console.log(`- ${key}: ${count}`);
  }
}
