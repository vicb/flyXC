/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

import yaml from 'js-yaml';

describe('Test server configuration', () => {
  test('Check app.yaml', () => {
    const appDir = path.resolve(__dirname, '../..');
    const staticDir = 'frontend/static/';

    const app = yaml.load(fs.readFileSync(path.join(appDir, 'app.yaml'), 'utf8'));

    const files = [];
    const folders = [];

    for (const handler of app.handlers) {
      if (handler.static_dir) {
        folders.push(handler.static_dir);
      } else {
        files.push({
          url: handler.url,
          file: handler.static_files,
        });
      }
    }

    fs.readdirSync(path.resolve(appDir, staticDir), { withFileTypes: true }).forEach((entry) => {
      if (entry.isDirectory()) {
        const folder = path.join(staticDir, entry.name);
        expect(folders).toContain(folder);
      } else {
        const url = `/${entry.name}`;
        const file = path.join(staticDir, entry.name);
        let found = false;
        for (const rule of files) {
          const matches = url.match(rule.url);
          if (matches) {
            const path = rule.file.replace(/\\(\d)/, (_, index) => matches[index]);
            found = file == path;
            if (found) break;
          }
        }
        // Print the filename in the error when not found.
        if (!found) {
          expect(file).toBe(null);
        }
      }
    });
  });
});
