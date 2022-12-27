// Copy arcgis assets to the static folder.

const fs = require('fs-extra');
const path = require('path');
const srcDir = path.resolve(__dirname, '../../node_modules/@arcgis/core/assets/esri');
const dstDir = path.resolve(__dirname, '../../apps/fxc-front/public/static/esri');

console.log('## Install arcgis');
// Creates or empties the destination folder.
console.log('  - Empty dest folder');
fs.emptyDirSync(dstDir);
console.log('  - Copy files');
fs.copySync(srcDir, dstDir);
