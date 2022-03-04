// Copy ionic files to the static folder.
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs-extra');
const path = require('path');

const srcDir = path.resolve(__dirname, '../node_modules/@ionic/core/dist/ionic');
const dstDir = path.resolve(__dirname, '../static/ionic');

console.log('## Install ionic');
// Creates or empties the destination folder.
console.log('  - Empty dest folder');
fs.emptyDirSync(dstDir);
console.log('  - Copy files');
fs.copySync(srcDir, dstDir);
