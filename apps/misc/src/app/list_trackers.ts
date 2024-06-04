import { writeFileSync } from 'node:fs';

import type { LiveTrackEntity } from '@flyxc/common';
import { LIVE_TRACK_TABLE } from '@flyxc/common-node';
import { Datastore } from '@google-cloud/datastore';
import type { RunQueryResponse } from '@google-cloud/datastore/build/src/query';

const datastore = new Datastore();

async function query(batchSize = 1000): Promise<LiveTrackEntity[]> {
  let start: string | undefined;
  let res: RunQueryResponse;
  const trackers: LiveTrackEntity[] = [];
  let count = 0;

  do {
    const query = datastore.createQuery(LIVE_TRACK_TABLE).limit(batchSize);

    if (start) {
      query.start(start);
    }

    res = await datastore.runQuery(query);
    start = res[1].endCursor;
    trackers.push(...res[0]);
    count += batchSize;
    console.log(`Fetched ${count} trackers`);
  } while (res[1].moreResults != datastore.NO_MORE_RESULTS);

  return trackers;
}

(async () => {
  const trackers = await query();
  console.log(`Writing ${trackers.length} trackers`);
  writeFileSync(`${__dirname}/trackers.json`, JSON.stringify(trackers, null, 2));
})();
