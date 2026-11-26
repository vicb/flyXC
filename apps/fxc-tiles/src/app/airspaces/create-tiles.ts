// #!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AIRSPACE_3D_PMTILES_FILENAME,
  AIRSPACE_3D_TILE_ZOOM,
  AIRSPACE_PMTILES_FILENAME,
  type AirspaceFeature,
  MAX_AIRSPACE_TILE_ZOOM,
} from '@flyxc/common';
import { program } from 'commander';

import { getAppFolderFromDist } from '../util';
import { mergeCoplanarAirspaces } from './coplanar-3d';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const defaultInputFolder = resolve(join(getAppFolderFromDist(__dirname), 'assets/geojson'));
const defaultOutputFolder = resolve(join(getAppFolderFromDist(__dirname), 'assets/tiles'));

program
  .option('-i, --input <folder>', 'input folder or file', defaultInputFolder)
  .option('-o, --output <folder>', 'output folder', defaultOutputFolder)
  .parse();

const outFolder = resolve(program.opts().output);
const inputPath = resolve(program.opts().input);

mkdirSync(outFolder, { recursive: true });

let inputFiles: string[] = [];

if (existsSync(inputPath) && statSync(inputPath).isDirectory()) {
  inputFiles = readdirSync(inputPath)
    .filter((f) => f.endsWith('.geojson'))
    .sort()
    .map((f) => join(inputPath, f));
} else if (existsSync(inputPath)) {
  inputFiles = [inputPath];
}

if (inputFiles.length === 0) {
  console.error(`Error: No .geojson files found in ${inputPath}`);
  process.exit(1);
}

const now = new Date();
const date = now.toISOString().slice(0, 10);
const timestamp = now.getTime();
const metadataDescription = JSON.stringify({ date, timestamp });

console.log(`# Generate 2D PMTiles (${AIRSPACE_PMTILES_FILENAME}) from ${inputFiles.length} file(s)`);
execFileSync('tippecanoe', ['-v']);
const out2dPath = join(outFolder, AIRSPACE_PMTILES_FILENAME);
// See https://github.com/felt/tippecanoe#options
const args = [
  '-o',
  out2dPath,
  '-z',
  String(MAX_AIRSPACE_TILE_ZOOM), // max zoom
  '-d',
  '13', // 8192 extent at max zoom (~3.4m precision at 45 deg)
  '-l',
  'asp', // layer name
  '-S',
  '3', // tolerance multiplier
  '-pS', // do not simplify max zoom
  '-ab', // simplify shared border together
  '-pi', // preserve input order
  '-pt', // do not combine small squares
  '--description',
  metadataDescription,
  '--drop-densest-as-needed', // drop least visible feats if too big
  '-f', // overwrite existing output
  '--',
  ...inputFiles,
];
console.log(`executing:\ntippecanoe ${args.join(' ')}`);
execFileSync('tippecanoe', args, { stdio: 'inherit' });

console.log(`# Generate 3D unclipped PMTiles (${AIRSPACE_3D_PMTILES_FILENAME}, zoom ${AIRSPACE_3D_TILE_ZOOM})`);
const tmpWorkspace = mkdtempSync(join(dirname(outFolder), '.tmp_airspaces_'));
const tmp3dGeojson = join(tmpWorkspace, '3d_airspaces.geojson');
const out3dPath = join(outFolder, AIRSPACE_3D_PMTILES_FILENAME);

try {
  console.log(`# Dissolving overlapping coplanar airspaces for 3D tiles...`);
  const allFeatures: AirspaceFeature[] = [];
  for (const file of inputFiles) {
    const content = JSON.parse(readFileSync(file, 'utf8'));
    allFeatures.push(...content.features);
  }
  const dissolved3dFeatures = await mergeCoplanarAirspaces(allFeatures);
  console.log(`  Merged ${allFeatures.length} input features into ${dissolved3dFeatures.length} 3D features`);
  writeFileSync(tmp3dGeojson, JSON.stringify({ type: 'FeatureCollection', features: dissolved3dFeatures }));

  // Tippecanoe parameters for unclipped 3D tiles:
  // - `-d 16` (--full-detail=16): increases coordinate grid from 12 bits to 16 bits.
  // - `-ps` (--no-line-simplification): disables Douglas-Peucker simplification.
  // - `-pc` (--no-tile-clipping): generates complete, unclipped polygon footprints across tile boundaries.
  // - `--no-tile-size-limit`: overrides the default 500 KB tile limit to ensure zero airspaces are dropped.
  // - `-y <property>`: whitelists only the numerical bounds and category flags required for 3D extrusion.
  const args3d = [
    '-o',
    out3dPath,
    '-z',
    String(AIRSPACE_3D_TILE_ZOOM),
    '-Z',
    String(AIRSPACE_3D_TILE_ZOOM),
    '-d',
    '16',
    '-l',
    'asp',
    '-ps',
    '-ab',
    '-pt',
    '-pc',
    '--description',
    metadataDescription,
    '--no-tile-size-limit',
    '-y',
    'floorM',
    '-y',
    'topM',
    '-y',
    'floorRefGnd',
    '-y',
    'topRefGnd',
    '-y',
    'icaoClass',
    '-y',
    'type',
    '-y',
    'activity',
    '-y',
    'flags',
    '-f',
    '--',
    tmp3dGeojson,
  ];
  console.log(`executing:\ntippecanoe ${args3d.join(' ')}`);
  execFileSync('tippecanoe', args3d, { stdio: 'inherit' });
} finally {
  rmSync(tmpWorkspace, { recursive: true, force: true });
}
