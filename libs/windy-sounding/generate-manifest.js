import fs from 'node:fs';
import path from 'node:path';
import { __pluginConfig } from '../../dist/libs/windy-sounding/plugin.min.js';

try {
  const outputFolder = path.resolve(process.argv[2] ?? '');
  const manifestPath = path.join(outputFolder, 'plugin.json');
  const manifest = JSON.stringify(__pluginConfig, null, 2);
  fs.writeFileSync(manifestPath, manifest);
  console.log(`Manifest file generated: ${manifestPath}`);
} catch (error) {
  console.error(`Error generating manifest file: ${error.message}`);
  process.exit(1);
}
