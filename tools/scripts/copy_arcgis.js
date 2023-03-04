// Copy arcgis assets to the static folder.

const fs = require('fs-extra');
const path = require('path');

console.log('## Install arcgis');

copy('../../node_modules/@arcgis/core/assets/esri', '../../apps/fxc-front/public/static/esri');

function copy(srcDir, dstDir) {
  srcDir = path.resolve(__dirname, srcDir);
  dstDir = path.resolve(__dirname, dstDir);

  // Creates or empties the destination folder.
  console.log(`  - Empty dest folder ${dstDir}`);
  fs.emptyDirSync(dstDir);
  console.log(`  - Copy files from ${srcDir}`);
  fs.copySync(srcDir, dstDir);
}
