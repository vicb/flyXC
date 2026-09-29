import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { program } from 'commander';

// Only request fields used by the downstream parser (openaip.ts / create-geojson.ts).
const FIELDS = 'name,country,type,icaoClass,activity,lowerLimit,upperLimit,geometry';

const OPENAIP_AIRSPACE_ENDPOINT = `https://api.core.openaip.net/api/airspaces?limit=1000&apiKey={key}&page={page}&fields=${FIELDS}`;

program.requiredOption('-o, --output <dir>', 'output directory').parse();

function cleanOutputDir(dir: string) {
  try {
    for (const file of readdirSync(dir)) {
      if (file.endsWith('.json')) {
        rmSync(path.join(dir, file));
      }
    }
  } catch {
    // Directory doesn't exist yet — nothing to clean.
  }
}

async function downloadAirspaces(outputDir: string) {
  mkdirSync(outputDir, { recursive: true });
  cleanOutputDir(outputDir);

  let delayMs = 10;
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = OPENAIP_AIRSPACE_ENDPOINT.replace(`{key}`, SECRETS.OPENAIP_KEY).replace(`{page}`, String(page));
    try {
      console.log(`fetching page ${page}/${totalPages}`);
      const response = await fetch(url);
      // Delay to avoid too many requests.
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (response.ok) {
        const info = await response.json();
        totalPages = info.totalPages;
        const basename = `openaip-${String(page).padStart(4, '0')}.json`;
        const filename = path.join(outputDir, basename);
        writeFileSync(filename, JSON.stringify(info.items));
        console.log(`  -> saved ${info.items.length} airspaces to ${basename}`);
        page++;
        delayMs = 10;
      } else {
        delayMs *= 2;
        console.error(`HTTP status ${response.status}`);
      }
    } catch (e) {
      console.error(`Error`, e);
    }
  }
}

(async function () {
  const outputDir = program.opts().output;
  await downloadAirspaces(outputDir);
})();
