import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { round } from '@flyxc/common';
import { program } from 'commander';
import { globSync } from 'glob';

import { getAppFolderFromDist, printOnCurrentLine } from '../util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const defaultInputFolder = resolve(join(getAppFolderFromDist(__dirname), '/src/assets/airspaces/tiles'));
const defaultOutputFile = resolve(join(getAppFolderFromDist(__dirname), '/src/assets/airspaces/tiles-info.json'));
const previousInfoFilename = resolve(
  join(getAppFolderFromDist(__dirname), '/src/assets/airspaces/tiles-info-previous.json'),
);

program
  .option('-i, --input <folder>', 'input folder', defaultInputFolder)
  .option('-o, --output <file>', 'output file', defaultOutputFile)
  .parse();

console.log(`# Generating tile info`);

if (existsSync(program.opts().output)) {
  console.info(`-> renaming previous file`);
  renameSync(program.opts().output, previousInfoFilename);
} else {
  console.info(`-> no previous file found`);
}

const tileFiles = globSync(program.opts().input + '/*/*/*.pbf');
console.log(`# Generating tile fingerprints (${Math.round(tileFiles.length / 1000)}k tiles)`);

const info = {
  // tileKey (level-x-y) to fingerprint.
  fingerprint: {},
  // Number of tiles.
  number: 0,
  // Size in MB.
  sizeAllMb: 0,
  // Number of unique tiles.
  numUnique: 0,
};

const fingerprints = new Set();
// Size for all the tiles.
let sizeAll = 0;
// Size for unique tiles.
let sizeUnique = 0;

for (const tileFile of tileFiles) {
  const m = tileFile.match(/\/(?<level>\d+)\/(?<x>\d+)\/(?<y>\d+)\.pbf/);
  if (m != null) {
    const g = m.groups;
    const fingerprint = getShortHash(tileFile);
    info.fingerprint[`${g.level}-${g.x}-${g.y}`] = fingerprint;
    const tileSize = statSync(tileFile).size;

    sizeAll += tileSize;

    if (!fingerprints.has(fingerprint)) {
      fingerprints.add(fingerprint);
      sizeUnique += tileSize;
    }

    info.number++;
  }
  if (info.number % 1000 == 0) {
    printOnCurrentLine(`${info.number / 1000}k tiles`);
  }
}

info.numUnique = fingerprints.size;
info.sizeAllMb = round(sizeAll / (1024 * 1024), 1);
const sizeUniqueMb = round(sizeUnique / (1024 * 1024), 1);

printOnCurrentLine('');
console.log(`-> ${info.number} tiles (${info.sizeAllMb} MB)`);
console.log(`-> ${info.numUnique} unique tiles (${sizeUniqueMb} MB)`);

writeFileSync(program.opts().output, JSON.stringify(info));

function getShortHash(filename: string): string {
  const fileBuffer = readFileSync(filename);
  const hashSum = createHash('md5');
  hashSum.update(fileBuffer);
  return hashSum.digest('base64').substring(0, 7);
}
