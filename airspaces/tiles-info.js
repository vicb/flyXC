/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs-extra');
const glob = require('glob');
const prog = require('commander');
const hasha = require('hasha');

prog
  .option('-i, --input <folder>', 'input folder', 'asp')
  .option('-o, --output <file>', 'output file', 'tiles-info.json')
  .parse();

const info = {
  // tiles (level-x-y) to fingerprint.
  fingerprint: {},
  number: 0,
  sizeMb: 0,
  numUnique: 0,
};

const tiles = glob.sync(prog.opts().input + '/*/*/*.pbf');
let size = 0;

console.log(`Generating tile fingerprints`);

for (const tile of tiles) {
  const m = tile.match(/\/(?<level>\d+)\/(?<x>\d+)\/(?<y>\d+)\.pbf/);
  if (m != null) {
    const g = m.groups;
    info.fingerprint[`${g.level}-${g.x}-${g.y}`] = hasha
      .fromFileSync(tile, { algorithm: 'md5', encoding: 'base64' })
      .substr(0, 6);
    size += fs.statSync(tile).size;
    info.number++;
  }
  if (info.number % 1000 == 0) {
    console.log(`${info.number / 1000}k tiles`);
  }
}

info.sizeMb = Math.round((100 * size) / (1024 * 1024)) / 100;
info.numUnique = new Set(Object.values(info.fingerprint)).size;

fs.writeFileSync(prog.opts().output, JSON.stringify(info));
