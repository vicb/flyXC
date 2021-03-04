import express, { Request, Response, Router } from 'express';
import { idFromEntity } from 'flyxc/common/src/datastore';
import { trackerPropNames } from 'flyxc/common/src/live-track';
import { LIVE_TRACK_TABLE } from 'flyxc/common/src/live-track-entity';
import { Keys } from 'flyxc/common/src/redis';
import { TRACK_TABLE } from 'flyxc/common/src/track-entity';
import Redis from 'ioredis';

import { Datastore } from '@google-cloud/datastore';

import { isAdmin } from './session';

const datastore = new Datastore();

// Cache the counter for hours.
const REDIS_CACHE_HOURS = 5;
// Initial offset for the number of tracks
const NUM_TRACKS_OFFSET = 68000;

export function getAdminRouter(redis: Redis.Redis): Router {
  const router = express.Router();

  router.get('/_admin.json', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');

    if (!isAdmin(req)) {
      res.sendStatus(403);
      return;
    }

    res.json(await getDashboardValues(redis));
  });

  return router;
}

async function getDashboardValues(redis: Redis.Redis): Promise<unknown> {
  const redisOut = await redis.pipeline().get(Keys.dashboardDsRequestTime).get(Keys.dashboardTotalTracks).exec();

  const cacheTimeSec = Number(redisOut[0][1] ?? 0);
  const trackOffset = Number(redisOut[1][1] ?? NUM_TRACKS_OFFSET) - 100;

  const nowSec = Math.round(Date.now() / 1000);

  // Query the datastore when the cache is outdated.
  if (nowSec - cacheTimeSec > REDIS_CACHE_HOURS * 3600) {
    const queryPromises = [
      datastore.createQuery(TRACK_TABLE).offset(trackOffset).select('__key__').run(),
      datastore.createQuery(LIVE_TRACK_TABLE).filter('enabled', true).select('__key__').run(),
    ];

    const trackerNames = Object.values(trackerPropNames);
    for (const name of trackerNames) {
      queryPromises.push(
        datastore
          .createQuery(LIVE_TRACK_TABLE)
          .filter('enabled', true)
          .filter(`${name}.enabled`, true)
          .select('__key__')
          .run(),
      );
    }

    for (const name of trackerNames) {
      queryPromises.push(
        datastore
          .createQuery(LIVE_TRACK_TABLE)
          .filter('enabled', true)
          .filter(`${name}.enabled`, true)
          .filter(`${name}.errors_requests`, '>', 300000)
          .order(`${name}.errors_requests`, { descending: true })
          .limit(10)
          .select([`${name}.errors_requests`])
          .run(),
      );
    }

    const queries = await Promise.all(queryPromises);
    let index = 0;

    const pipeline = redis
      .pipeline()
      .set(Keys.dashboardDsRequestTime, nowSec)
      .set(Keys.dashboardTotalTracks, trackOffset + queries[index++][0].length)
      .set(Keys.dashboardTotalTrackers, queries[index++][0].length);

    for (const name of trackerNames) {
      pipeline.set(Keys.dashboardNumTrackers.replace('{name}', name), queries[index++][0].length);
    }

    for (const name of trackerNames) {
      const text = queries[index++][0].map(
        (device) => `id=${idFromEntity(device)} errors=${device[`${name}.errors_requests`]}`,
      );
      pipeline.set(Keys.dashboardTopErrors.replace('{name}', name), text.join(','));
    }

    await pipeline.exec();
  }

  // Retrieves all values from Redis.
  const opByKey: { [key: string]: string } = {
    [Keys.trackerRequestTimestamp]: 'get',
    [Keys.trackerFullSize]: 'get',
    [Keys.trackerIncrementalSize]: 'get',
    [Keys.trackerUpdateSec]: 'get',
    [Keys.dashboardTotalTracks]: 'get',
    [Keys.dashboardTotalTrackers]: 'get',
    [Keys.dashboardDsRequestTime]: 'get',
  };

  for (const name of Object.values(trackerPropNames)) {
    opByKey[Keys.trackerLogsErrors.replace('{name}', name)] = 'lrange 0 -1';
    opByKey[Keys.trackerLogsErrorsById.replace('{name}', name)] = 'lrange 0 -1';
    opByKey[Keys.trackerLogsSize.replace('{name}', name)] = 'lrange 0 -1';
    opByKey[Keys.trackerLogsTime.replace('{name}', name)] = 'lrange 0 -1';
    opByKey[Keys.trackerLogsDuration.replace('{name}', name)] = 'lrange 0 -1';

    opByKey[Keys.dashboardNumTrackers.replace('{name}', name)] = 'get';
    opByKey[Keys.dashboardTopErrors.replace('{name}', name)] = 'get';
  }

  const commands: string[][] = Object.entries(opByKey).map(([key, cmd]) => {
    const parts = cmd.split(' ');
    parts.splice(1, 0, key);
    return parts;
  });

  const result = await redis.pipeline(commands).exec();

  const values: { [key: string]: string | string[] } = {};

  commands.forEach(([_, key], i) => {
    values[key] = result[i][1];
  });

  return values;
}
