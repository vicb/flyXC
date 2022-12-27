import { SecretKeys } from '@flyxc/common';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const key = SecretKeys.OPENAIP_KEY;
const airspaceEndpoint = `https://api.core.openaip.net/api/airspaces?limit=1000&apiKey={key}&page={page}`;

async function downloadAirspaces() {
  const airspaces = [];
  let delayMs = 50;
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const url = airspaceEndpoint.replace(`{key}`, key).replace(`{page}`, String(page));
    try {
      console.log(`fetching page ${page}/${totalPages}`);
      const response = await fetch(url);
      // Delay to avoid too many requests.
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (response.ok) {
        const info = await response.json();
        totalPages = info.totalPages;
        airspaces.push(...info.items);
        page++;
        delayMs = 50;
      } else {
        delayMs *= 2;
        console.error(`HTTP status ${response.status}`);
      }
    } catch (e) {
      console.error(`Error`, e);
    }
  }
  return airspaces;
}

(async function () {
  const airspaces = await downloadAirspaces();
  const filename = 'asp/airspaces.json';
  const dirname = path.dirname(filename);
  mkdirSync(dirname, { recursive: true });
  writeFileSync(filename, JSON.stringify(airspaces));
})();
