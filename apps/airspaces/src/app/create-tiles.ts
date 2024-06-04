// #!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { MAX_AIRSPACE_TILE_ZOOM } from '@flyxc/common';
import { program } from 'commander';

import { printOnCurrentLine } from './util';

const defaultInputFile = resolve(join(__dirname, '../../../apps/airspaces/src/assets/airspaces/airspaces.geojson'));
const defaultOutputFolder = resolve(join(__dirname, '../../../apps/airspaces/src/assets/airspaces/tiles'));

program
  .option('-i, --input <folder>', 'input folder', defaultInputFile)
  .option('-o, --output <file>', 'output file', defaultOutputFolder)
  .parse();

const outFolder = program.opts().output;
if (existsSync(outFolder)) {
  console.log(`# Delete existing tiles...`);
  const numDeleted = deletePbfRecursively(outFolder);
  printOnCurrentLine('');
  console.log(`-> ${numDeleted} tiles deleted`);
}

console.log(`# Generate tiles`);
execSync('tippecanoe -v');
// See https://github.com/felt/tippecanoe#options)
const args = [
  `-e ${outFolder}`, // output folder
  `-z ${MAX_AIRSPACE_TILE_ZOOM}`, // max zoom
  '-l asp', // layer name
  '-S 3', // tolerance multiplier
  '-pS', // do not simplify max zoom
  '-ab', // simplify shared border together
  '-pi', // preserve input order
  '-pt', // do not combine small squares
  '-pC', // do not compress tiles
  '--drop-densest-as-needed', // drop least visible feats if too big
  '-f', // do not complain on existing output
  '--',
  program.opts().input,
];
console.log(`executing:\ntippecanoe ${args.join(' ')}`);
execSync(`tippecanoe ${args.join(' ')}`, { stdio: 'inherit' });

console.log(`# Drop the metadata`);
rmSync(join(outFolder, 'metadata.json'), { force: true });

// Recursively delete pbf files.
//
// Returns the number of deleted file.
function deletePbfRecursively(folder: string, numDeleted = 0): number {
  const entries = readdirSync(folder);
  for (const entry of entries) {
    const path = resolve(join(folder, entry));
    if (statSync(path).isFile()) {
      if (entry.toLocaleLowerCase().endsWith(`.pbf`)) {
        unlinkSync(path);
        numDeleted++;
        if (numDeleted % 1000 == 0) {
          printOnCurrentLine(`Deleted ${numDeleted} tiles`);
        }
      }
    } else {
      numDeleted = deletePbfRecursively(path, numDeleted);
    }
  }

  return numDeleted;
}
