// Keep the 3 latest prod chunk folders, delete the dev folders.

/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs-extra');
const path = require('path');
const chunkDir = path.resolve(__dirname, '../static/js/chunks');

console.log('## Deleting old prod + dev chunks');

const directories = [];

fs.readdirSync(chunkDir, { withFileTypes: true }).forEach((entry) => {
  if (entry.isDirectory() && entry.name.match(/\d{8}/)) {
    directories.push(path.join(chunkDir, entry.name));
  }
});

directories.sort();

const delDirectories = [
  path.resolve(__dirname, '../static/js/chunks/dev'),
  ...directories.slice(0, Math.max(directories.length - 3, 0)),
];

for (const dir of delDirectories) {
  console.log(`- deleting ${dir}`);
  fs.rmdirSync(dir, { recursive: true });
}
