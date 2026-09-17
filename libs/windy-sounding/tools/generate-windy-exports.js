import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function generateWindyExports() {
  const commonExportsPath = path.join(rootDir, 'types/client/commonExports.d.ts');
  const targetPath = path.join(rootDir, 'src/windy-exports.d.ts');

  if (!fs.existsSync(commonExportsPath)) {
    return;
  }

  const content = fs.readFileSync(commonExportsPath, 'utf-8');

  // Windy's types bundle flattens files in types/client/*.d.ts,
  // but commonExports.d.ts retains relative subdirectories (e.g., './services/store').
  // We rewrite those imports to '@windy/client/<module>' which are mapped in tsconfig.json.
  const transformed = [
    '/* eslint-disable */',
    '// This file is auto-generated from types/client/commonExports.d.ts by generate-windy-exports.js.',
    '// DO NOT EDIT DIRECTLY.',
    '',
    ...content
      .split('\n')
      .map((line) => line.replace(/from\s+['"]\.\/[^'"]+\/([^'"]+)['"]/g, "from '@windy/client/$1'"))
      .filter((line) => !line.startsWith('import ')),
    '',
  ].join('\n');

  if (!fs.existsSync(targetPath) || fs.readFileSync(targetPath, 'utf-8') !== transformed) {
    fs.writeFileSync(targetPath, transformed, 'utf-8');
  }
}

// Allow direct execution: `node generate-windy-exports.js`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateWindyExports();
}
