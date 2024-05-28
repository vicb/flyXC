import { readFileSync } from 'node:fs';
import { LiveTrackEntity } from '@flyxc/common';

(async () => {
  const trackers = JSON.parse(readFileSync(`${__dirname}/assets/trackers.json`, 'utf-8')) as LiveTrackEntity[];

  const numTrackers = trackers.length;

  console.log(`## Found ${numTrackers} trackers\n`);

  const flymasters = await retrieveFlymasters(trackers);

  console.log(`\n## Found ${flymasters.length} flymasters`);

  console.log(flymasters.map((flymaster) => `"${flymaster.id}", `).join('\n'));
})();

async function retrieveFlymasters(trackers: LiveTrackEntity[]) {
  const flymasters: { name: string; id: string }[] = [];

  for (const tracker of trackers) {
    if (tracker?.flymaster?.enabled && tracker?.flymaster?.account != null) {
      flymasters.push({
        name: tracker.name,
        id: tracker.flymaster.account,
      });
    }
  }

  return flymasters;
}
