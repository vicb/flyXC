import { writeFileSync } from 'node:fs';

import type { TrackEntity } from '@flyxc/common-node';
import { TRACK_TABLE } from '@flyxc/common-node';
import { Datastore } from '@google-cloud/datastore';
import type { RunQueryResponse } from '@google-cloud/datastore/build/src/query';

const datastore = new Datastore();

async function query(batchSize = 1000): Promise<TrackEntity[]> {
  let start: string | undefined;
  let res: RunQueryResponse;
  const tracks: TrackEntity[] = [];
  let count = 0;

  do {
    const query = datastore
      .createQuery(TRACK_TABLE)
      .select(['__key__', 'hash', 'created', 'url', 'valid'])
      .limit(batchSize);

    if (start) {
      query.start(start);
    }

    res = await datastore.runQuery(query);
    start = res[1].endCursor;
    tracks.push(...res[0]);
    count += batchSize;
    console.log(`Fetched ${count} tracks`);
  } while (res[1].moreResults != datastore.NO_MORE_RESULTS);

  return tracks;
}

(async () => {
  const tracks = await query();
  console.log(`Writing ${tracks.length} tracks`);
  writeFileSync(`${__dirname}/tracks.json`, JSON.stringify(tracks));
})();
