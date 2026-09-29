import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Type } from '@flyxc/common';
import { program } from 'commander';
import GeoJSON from 'geojson';

import * as oaip from '../parser/openaip';
import * as oair from '../parser/openair';
import type { Airspace } from '../parser/parser';
import { getAppFolderFromDist } from '../util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Filter out airspaces above:
const MAX_FLOOR_METER = 6000;

const defaultInputFolder = resolve(join(getAppFolderFromDist(__dirname), 'assets'));
const defaultOutputFolder = resolve(join(getAppFolderFromDist(__dirname), 'assets/geojson'));

program
  .option('-i, --input <folder>', 'input folder', defaultInputFolder)
  .option('-o, --output <folder>', 'output folder', defaultOutputFolder)
  .parse();

const inputFolder = program.opts().input;
const outputFolder = program.opts().output;

mkdirSync(outputFolder, { recursive: true });
cleanOutputDir(outputFolder);

const logs = new Map<string, number>();
const filterFn = createFilter(logs);
const processFn = createProcess(logs);

let totalAirspaces = 0;

// OpenAip — read and convert each page from the openaip/ subdirectory into a separate GeoJSON file.
console.log('# Open AIP airspaces');
const openaipDir = join(inputFolder, 'openaip');
if (existsSync(openaipDir)) {
  const openaipFiles = readdirSync(openaipDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  let openaipImported = 0;
  let openaipOutput = 0;

  for (const file of openaipFiles) {
    const content = readFileSync(join(openaipDir, file), 'utf-8');
    const parsed = oaip.parseAll(JSON.parse(content));
    openaipImported += parsed.length;

    const processed = parsed.map(processFn).filter(filterFn);
    openaipOutput += processed.length;

    if (processed.length > 0) {
      const geojsonObj = GeoJSON.parse(processed, { Polygon: 'polygon' });
      const outFile = join(outputFolder, file.replace(/\.json$/, '.geojson'));
      writeFileSync(outFile, JSON.stringify(geojsonObj));
    }
  }

  console.log(`${openaipImported} airspaces imported`);
  printLogs('Processed:', logs);
  printLogs('Filtered:', logs);
  console.log(`-> ${openaipOutput} airspaces written across ${openaipFiles.length} files`);
  totalAirspaces += openaipOutput;
} else {
  console.warn(`Directory not found: ${openaipDir}`);
}

// Ukraine
console.log('\n# Ukraine airspaces');
const uaPath = join(inputFolder, 'UKRAINE (UK).txt');
if (existsSync(uaPath)) {
  const uaContent = readFileSync(uaPath, 'utf-8');
  const uaAirspaces = oair.parseAll(uaContent, 'UA');
  console.log(`${uaAirspaces.length} airspaces imported`);
  const processed = uaAirspaces.map(processFn).filter(filterFn);
  printLogs('Processed:', logs);
  printLogs('Filtered:', logs);
  console.log(`-> ${processed.length} airspaces`);

  if (processed.length > 0) {
    const geojsonObj = GeoJSON.parse(processed, { Polygon: 'polygon' });
    writeFileSync(join(outputFolder, 'ukraine.geojson'), JSON.stringify(geojsonObj));
  }
  totalAirspaces += processed.length;
}

// Reunion
console.log('\n# Reunion airspaces');
const rePath = join(inputFolder, 'reunion.txt');
if (existsSync(rePath)) {
  const reContent = readFileSync(rePath, 'utf-8');
  const reAirspaces = oair.parseAll(reContent, 'RE');
  console.log(`${reAirspaces.length} airspaces imported`);
  const processed = reAirspaces.map(processFn).filter(filterFn);
  printLogs('Processed:', logs);
  printLogs('Filtered:', logs);
  console.log(`-> ${processed.length} airspaces`);

  if (processed.length > 0) {
    const geojsonObj = GeoJSON.parse(processed, { Polygon: 'polygon' });
    writeFileSync(join(outputFolder, 'reunion.geojson'), JSON.stringify(geojsonObj));
  }
  totalAirspaces += processed.length;
}

console.log(`\n# Total: ${totalAirspaces} airspaces written to ${outputFolder}`);

function cleanOutputDir(dir: string) {
  try {
    for (const file of readdirSync(dir)) {
      if (file.endsWith('.geojson')) {
        rmSync(join(dir, file));
      }
    }
  } catch {
    // Directory doesn't exist yet
  }
}

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
