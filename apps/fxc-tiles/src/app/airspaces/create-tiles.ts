// #!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AIRSPACE_3D_TILE_ZOOM, type AirspaceFeature, MAX_AIRSPACE_TILE_ZOOM } from '@flyxc/common';
import { program } from 'commander';

import { getAppFolderFromDist } from '../util';
import { mergeCoplanarAirspaces } from './coplanar-3d';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const defaultInputFolder = resolve(join(getAppFolderFromDist(__dirname), 'assets/geojson'));
const defaultOutputFolder = resolve(join(getAppFolderFromDist(__dirname), 'assets/tiles'));
const defaultDateFile = resolve(join(getAppFolderFromDist(__dirname), 'assets/airspaces-date.json'));

program
  .option('-i, --input <folder>', 'input folder or file', defaultInputFolder)
  .option('-o, --output <folder>', 'output folder', defaultOutputFolder)
  .option('-d, --date <file>', 'date file', defaultDateFile)
  .parse();

const outFolder = resolve(program.opts().output);
const inputPath = resolve(program.opts().input);
const isInsideOut = (p: string) => {
  const rel = relative(outFolder, p);
  return !rel.startsWith('..') && !isAbsolute(rel);
};
if (isInsideOut(process.cwd()) || isInsideOut(inputPath)) {
  throw new Error(`Refusing to delete ${outFolder}: it contains the working directory or input path.`);
}
if (existsSync(outFolder)) {
  console.log(`# Delete existing tiles in ${outFolder}...`);
  rmSync(outFolder, { recursive: true, force: true });
}

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

console.log(`# Generate 2D vector tiles from ${inputFiles.length} file(s)`);
execFileSync('tippecanoe', ['-v']);
// See https://github.com/felt/tippecanoe#options)
const args = [
  '-e',
  outFolder, // output folder
  '-z',
  String(MAX_AIRSPACE_TILE_ZOOM), // max zoom
  '-l',
  'asp', // layer name
  '-S',
  '3', // tolerance multiplier
  '-pS', // do not simplify max zoom
  '-ab', // simplify shared border together
  '-pi', // preserve input order
  '-pt', // do not combine small squares
  '-pC', // do not compress tiles
  '--drop-densest-as-needed', // drop least visible feats if too big
  '-f', // do not complain on existing output
  '--',
  ...inputFiles,
];
console.log(`executing:\ntippecanoe ${args.join(' ')}`);
execFileSync('tippecanoe', args, { stdio: 'inherit' });

console.log(`# Drop the 2D metadata`);
rmSync(join(outFolder, 'metadata.json'), { force: true });

console.log(`# Generate unclipped tiles (zoom ${AIRSPACE_3D_TILE_ZOOM})`);
const tmpUnclippedFolder = resolve(join(dirname(outFolder), '.tmp_unclipped'));
const tmp3dGeojson = resolve(join(dirname(outFolder), '.tmp_3d_airspaces.geojson'));
rmSync(tmpUnclippedFolder, { recursive: true, force: true });
rmSync(tmp3dGeojson, { force: true });

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
// - `-d 16` (--full-detail=16): increases coordinate grid from 12 bits (4,096 units / ~150m at zoom 6)
//   to 16 bits (65,536 units / ~6.7m at zoom 6, matching zoom 10 precision). Prevents circular CTRs
//   from snapping to coarse grid stairsteps.
// - `-ps` (--no-line-simplification): disables Douglas-Peucker simplification, preserving all curved
//   circle vertices instead of decimating them.
// - `-pc` (--no-tile-clipping) & `-pC`: generates complete, unclipped polygon footprints across tile
//   boundaries, eliminating tile stitching and union operators in 3D rendering.
// - `--no-tile-size-limit`: overrides the default 500 KB uncompressed tile limit to ensure zero
//   airspaces are dropped in dense regions.
// - `-y <property>`: whitelists only the numerical bounds and category flags required for 3D extrusion
//   and styling. Text strings (name, country, labels) are omitted to minimize tile file size; rich
//   metadata is queried on-demand from the standard 2D vector tiles upon click.
const args3d = [
  '-e',
  tmpUnclippedFolder,
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
  '-pC',
  '-pc',
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
try {
  execFileSync('tippecanoe', args3d, { stdio: 'inherit' });

  console.log(`# Co-locate unclipped tiles as {y}-unclipped.pbf`);
  const unclippedZoomDir = join(tmpUnclippedFolder, String(AIRSPACE_3D_TILE_ZOOM));
  if (existsSync(unclippedZoomDir)) {
    for (const x of readdirSync(unclippedZoomDir)) {
      const xDir = join(unclippedZoomDir, x);
      if (!statSync(xDir).isDirectory()) {
        continue;
      }
      const targetXDir = join(outFolder, String(AIRSPACE_3D_TILE_ZOOM), x);
      mkdirSync(targetXDir, { recursive: true });
      for (const file of readdirSync(xDir)) {
        if (file.endsWith('.pbf')) {
          const y = file.replace(/\.pbf$/, '');
          const srcPath = join(xDir, file);
          const dstPath = join(targetXDir, `${y}-unclipped.pbf`);
          renameSync(srcPath, dstPath);
        }
      }
    }
  }
} finally {
  rmSync(tmp3dGeojson, { force: true });
  rmSync(tmpUnclippedFolder, { recursive: true, force: true });
}

console.log(`# Update the airspace date`);
const now = new Date();
const date = now.toISOString().slice(0, 10);
const timestamp = now.getTime();
const dateContent = `${JSON.stringify({ date, timestamp }, null, 2)}\n`;
writeFileSync(program.opts().date, dateContent);
writeFileSync(join(outFolder, 'airspaces-date.json'), dateContent);
