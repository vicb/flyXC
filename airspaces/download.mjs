// token = 77507d68d5577dffd95e0885978c65be
import { writeFileSync } from 'node:fs';

const key = `77507d68d5577dffd95e0885978c65be`;
const airspaceEndpoint = `https://api.core.openaip.net/api/airspaces?limit=1000&apiKey={key}&page={page}`;

async function downloadAirspaces() {
  let airspaces = [];
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page++) {
    let url = airspaceEndpoint.replace(`{key}`, key).replace(`{page}`, page);
    try {
      console.log(`fetching page ${page}/${totalPages}`);
      const response = await fetch(url);
      // Delay to avoid too many requests.
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (response.ok) {
        let info = await response.json();
        totalPages = info.totalPages;
        airspaces.push(...info.items);
      } else {
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
  writeFileSync('asp/airspaces.json', JSON.stringify(airspaces));
})();
