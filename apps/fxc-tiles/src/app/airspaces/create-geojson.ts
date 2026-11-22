/**
 * Converts raw airspace source datasets into standardized GeoJSON files for vector tile generation.
 *
 * Source formats processed:
 * - OpenAIP JSON pages (`assets/openaip/openaip-*.json`)
 * - OpenAir text format (e.g. `UKRAINE (UK).txt`, `reunion.txt`)
 *
 * Pipeline responsibilities:
 * 1. Filter: Drops airspaces with floor > 6000m or unwanted patterns (e.g. ILS paths).
 * 2. ID Assignment: Generates sequential 1-based integer feature IDs preserved in downstream MVT tiles.
 * 3. Type Normalization: Normalizes country-specific airspace classifications (e.g. Ukraine CTR/TMA/FIR).
 * 4. Ramer-Douglas-Peucker (RDP) Simplification:
 *    - Raw airspace curves (such as circular CTRs/TMAs) frequently contain thousands of densely sampled
 *      vertices (e.g., 6,000+ vertices per boundary) that produce moiré/shimmering visual artifacts
 *      and high GPU/CPU overhead in 3D SceneViews, as well as bloating 2D vector tile sizes.
 *    - Applies metric RDP simplification (`simplifyCoords`, default 15m tolerance) with equirectangular
 *      latitude correction, reducing vertex counts by ~90% while preserving boundary fidelity, ring
 *      closure, and GeoJSON linear ring validity (minimum 4 coordinates).
 *    - Simplification can be adjusted via `-t, --tolerance <meters>` or disabled with `-t 0`.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AIRSPACE_OVERRIDE_KEY_TO_ID,
  AIRSPACE_OVERRIDE_TARGETS,
  RESERVED_AIRSPACE_ID_MAX,
  simplifyCoords,
  Type,
} from '@flyxc/common';
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
  .option('-t, --tolerance <meters>', 'simplification tolerance in meters (0 to disable)', '15')
  .parse();

const inputFolder = program.opts().input;
const outputFolder = program.opts().output;
const toleranceM = Number(program.opts().tolerance) || 0;

mkdirSync(outputFolder, { recursive: true });
cleanOutputDir(outputFolder);

const logs = new Map<string, number>();
const filterFn = createFilter(logs);
const processFn = createProcess(logs);

let nextId = RESERVED_AIRSPACE_ID_MAX + 1;
let totalOrigVertices = 0;
let totalSimpVertices = 0;
const matchedOverrideIds = new Set<number>();

function saveGeoJson(airspaces: Airspace[], outFile: string) {
  if (airspaces.length === 0) {
    return;
  }
  for (const a of airspaces) {
    const overrideId = AIRSPACE_OVERRIDE_KEY_TO_ID[`${a.name}|${a.icaoClass}`];
    if (overrideId != null) {
      a.id = overrideId;
      matchedOverrideIds.add(overrideId);
    } else {
      a.id = nextId++;
    }
    if (toleranceM > 0) {
      a.polygon = a.polygon.map((ring) => {
        totalOrigVertices += ring.length;
        const simplified = simplifyCoords(ring, toleranceM);
        totalSimpVertices += simplified.length;
        return simplified;
      });
    }
  }
  const geojsonObj = GeoJSON.parse(airspaces, { Polygon: 'polygon' });
  for (const feature of geojsonObj.features) {
    feature.id = feature.properties.id;
  }
  writeFileSync(outFile, JSON.stringify(geojsonObj));
}

let totalAirspaces = 0;

// OpenAip — read and convert each page from the openaip/ subdirectory into GeoJSON.
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

    const outFile = join(outputFolder, file.replace(/\.json$/, '.geojson'));
    saveGeoJson(processed, outFile);
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

  saveGeoJson(processed, join(outputFolder, 'ukraine.geojson'));
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

  saveGeoJson(processed, join(outputFolder, 'reunion.geojson'));
  totalAirspaces += processed.length;
}

console.log(`\n# Total: ${totalAirspaces} airspaces written to ${outputFolder}`);
if (totalOrigVertices > 0) {
  const reduction = (((totalOrigVertices - totalSimpVertices) / totalOrigVertices) * 100).toFixed(1);
  console.log(
    `# Geometry simplification (tolerance: ${toleranceM}m): ${totalOrigVertices.toLocaleString()} -> ${totalSimpVertices.toLocaleString()} vertices (-${reduction}%)`,
  );
}

// Verify that all override airspaces were found in the source datasets
const missingOverrides = AIRSPACE_OVERRIDE_TARGETS.filter((t) => !matchedOverrideIds.has(t.id));

if (missingOverrides.length > 0) {
  const missingDetails = missingOverrides.map((t) => `  - ID ${t.id}: "${t.name}" (Class ${t.icaoClass})`).join('\n');
  if (existsSync(openaipDir)) {
    console.error(
      `Error: The following airspaces with defined overrides were NOT found in input datasets:\n${missingDetails}`,
    );
    process.exit(1);
  } else {
    console.warn(
      `Warning: Missing airspaces with defined overrides (openaip directory not present):\n${missingDetails}`,
    );
  }
}

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
