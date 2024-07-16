import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { program } from 'commander';

import { getAppFolderFromDist } from '../util';

const newInfoFile = resolve(join(getAppFolderFromDist(__dirname), '/src/assets/airspaces/tiles-info.json'));
const refInfoFile = resolve(join(getAppFolderFromDist(__dirname), '/src/assets/airspaces/tiles-info-previous.json'));
const defaultOutputFile = resolve(join(getAppFolderFromDist(__dirname), '/src/assets/airspaces/tiles-info-diff.json'));

program
  .option('-n, --new <file>', 'new fingerprints', newInfoFile)
  .option('-r, --ref <file>', 'ref fingerprints', refInfoFile)
  .option('-o, --output <file>', 'diff', defaultOutputFile)
  .parse();

const diff = {
  added: [],
  updated: [],
  deleted: [],
  numAdded: 0,
  numUpdated: 0,
  numDeleted: 0,
  numSame: 0,
};

console.log(`# Generating tile diff`);

const newTiles = JSON.parse(readFileSync(program.opts().new, 'utf8'));

let refTiles = null;
if (existsSync(program.opts().ref)) {
  console.log(`-> Using a reference file: ${program.opts().ref}`);
  refTiles = JSON.parse(readFileSync(program.opts().ref, 'utf8'));
} else {
  console.log(`-> No reference file top use`);
}

if (refTiles != null) {
  for (const [tileKey, fp] of Object.entries(newTiles.fingerprint)) {
    if (tileKey in refTiles.fingerprint) {
      if (fp === refTiles.fingerprint[tileKey]) {
        diff.numSame++;
      } else {
        diff.numUpdated++;
        diff.updated.push(tileKey);
      }
    } else {
      diff.numAdded++;
      diff.added.push(tileKey);
    }
  }

  for (const tileKey of Object.keys(refTiles.fingerprint)) {
    if (!(tileKey in newTiles.fingerprint)) {
      diff.numDeleted++;
      diff.deleted.push(tileKey);
    }
  }
} else {
  for (const tileKey of Object.keys(newTiles.fingerprint)) {
    diff.numAdded++;
    diff.added.push(tileKey);
  }
}

console.log(`-> Added ${diff.numAdded} tiles`);
console.log(`-> Updated ${diff.numUpdated} tiles`);
console.log(`-> Deleted ${diff.numDeleted} tiles`);
console.log(`-> ${diff.numSame} unchanged tiles`);

writeFileSync(program.opts().output, JSON.stringify(diff));
