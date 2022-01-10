import csurf from 'csurf';
import express, { NextFunction, Request, Response, Router } from 'express';
import { trackerPropNames } from 'flyxc/common/src/live-track';
import { retrieveLiveTrackById } from 'flyxc/common/src/live-track-entity';
import { AccountFormModel } from 'flyxc/common/src/models';
import { Keys } from 'flyxc/common/src/redis';
import { TRACK_TABLE } from 'flyxc/common/src/track-entity';
import { Redis } from 'ioredis';
import zlib from 'zlib';

import { Datastore } from '@google-cloud/datastore';

import { createOrUpdateEntity } from './live-track';
import { isAdmin } from './session';

const datastore = new Datastore();
const csrfProtection = csurf();

// Cache the counter for hours.
const REDIS_CACHE_HOURS = 5;
// Initial offset for the number of tracks
const NUM_TRACKS_OFFSET = 120000;

const EDITOR_HTML = `<!DOCTYPE html>
<html lang="en">

<head>
  <script async src="https://www.googletagmanager.com/gtag/js?id=UA-150271266-1"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', 'UA-150271266-1');
  </script>
  <meta charset="utf-8" />
  <meta http-equiv="x-ua-compatible" content="ie=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>FlyXc Account Editor</title>
</head>

<body style="margin: 0; padding: 0;">
  <account-editor id="{{id}}"></account-editor>
  <script type="module" src="/js/editor.js"></script>
</body>

</html>`;

export function getAdminRouter(redis: Redis): Router {
  const router = express.Router();

  // Restrict routes to admin users.
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (!isAdmin(req)) {
      return res.sendStatus(403);
    }
    return next();
  });

  router.get('/_admin.json', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    res.json(await getDashboardValues(redis));
  });

  router.get('/_state.json', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');

    try {
      const state = await redis.getBuffer(Keys.fetcherStateBrotli);
      if (state) {
        return res.send(zlib.brotliDecompressSync(state));
      }
      // No content - maybe the state has not been captured yet ?
      return res.sendStatus(204);
    } catch (e) {
      return res.sendStatus(500);
    }
  });

  router.post('/_state/cmd/:cmd', async (req: Request, res: Response) => {
    switch (req.params.cmd) {
      case Keys.fetcherCmdCaptureState:
        await redis.del(Keys.fetcherStateBrotli);
        await redis.set(Keys.fetcherCmdCaptureState, 'admin', 'EX', 3 * 60);
        break;
      case Keys.fetcherCmdSyncFull:
      case Keys.fetcherCmdExportFile:
        await redis.set(req.params.cmd, 'admin', 'EX', 3 * 60);
        break;
      case Keys.fetcherCmdSyncIncCount:
        await redis.incr(Keys.fetcherCmdSyncIncCount);
        break;
      default:
        return res.sendStatus(404);
    }

    return res.sendStatus(204);
  });

  router.get(`/account/:id`, async (req: Request, res: Response) => {
    res.set('Content-Type', 'text/html');
    res.send(EDITOR_HTML.replace('{{id}}', req.params.id));
  });

  router.get(`/_account/:id`, csrfProtection, async (req: Request, res: Response) => {
    try {
      const entity = await retrieveLiveTrackById(req.params.id);
      if (entity) {
        const account = AccountFormModel.createFromEntity(entity);
        res.set('xsrf-token', req.csrfToken());
        return res.json(account);
      }
    } catch (e) {
      console.error(e);
    }
    return res.sendStatus(400);
  });

  router.post(`/_account/:id`, csrfProtection, async (req: Request, res: Response) => {
    try {
      const entity = await retrieveLiveTrackById(req.params.id);
      if (entity) {
        return createOrUpdateEntity(entity, req, res, entity.email, entity.google_id, redis);
      }
    } catch (e) {
      console.error(e);
    }
    return res.sendStatus(400);
  });

  return router;
}

// Returns all the values needed for the dashboard (from REDIS).
async function getDashboardValues(redis: Redis): Promise<unknown> {
  const redisOut = await redis.pipeline().get(Keys.dsLastRequestSec).get(Keys.trackNum).exec();

  const cacheTimeSec = Number(redisOut[0][1] ?? 0);
  const trackOffset = Number(redisOut[1][1] ?? NUM_TRACKS_OFFSET) - 100;

  const nowSec = Math.round(Date.now() / 1000);

  // Query the datastore when the cache is outdated.
  if (nowSec - cacheTimeSec > REDIS_CACHE_HOURS * 3600) {
    const [tracks] = await datastore.createQuery(TRACK_TABLE).offset(trackOffset).select('__key__').run();

    const pipeline = redis
      .pipeline()
      .set(Keys.dsLastRequestSec, nowSec)
      .set(Keys.trackNum, trackOffset + tracks.length);

    await pipeline.exec();
  }

  // Retrieves all values from Redis (Scalar or List).
  const typeByKey: { [key: string]: 'S' | 'L' } = {
    // Scalars
    [Keys.fetcherMemoryRssMb]: 'S',
    [Keys.fetcherMemoryHeapMb]: 'S',
    [Keys.fetcherStartedSec]: 'S',
    [Keys.fetcherReStartedSec]: 'S',
    [Keys.fetcherStoppedSec]: 'S',
    [Keys.fetcherNumTicks]: 'S',
    [Keys.fetcherNumStarts]: 'S',
    [Keys.fetcherLastDeviceUpdatedMs]: 'S',
    [Keys.fetcherNextPartialSyncSec]: 'S',
    [Keys.fetcherNextFullSyncSec]: 'S',
    [Keys.fetcherNextExportSec]: 'S',
    [Keys.fetcherFullNumTracks]: 'S',
    [Keys.fetcherIncrementalNumTracks]: 'S',
    [Keys.trackerNum]: 'S',
    [Keys.dsLastRequestSec]: 'S',
    [Keys.trackNum]: 'S',

    // Lists
    [Keys.stateSyncErrors.replace('{type}', 'full')]: 'L',
    [Keys.stateSyncNum.replace('{type}', 'full')]: 'L',
    [Keys.stateSyncErrors.replace('{type}', 'inc')]: 'L',
    [Keys.stateSyncNum.replace('{type}', 'inc')]: 'L',
    [Keys.stateExportStatus]: 'L',
    [Keys.elevationErrors]: 'L',
    [Keys.elevationNumFetched]: 'L',
    [Keys.elevationNumRetrieved]: 'L',
    [Keys.fetcherLastTicksSec]: 'L',
  };

  for (const name of Object.values(trackerPropNames)) {
    // Number of enabled trackers per type.
    typeByKey[Keys.trackerNumByType.replace('{name}', name)] = 'S';
    // [List] Global errors.
    typeByKey[Keys.trackerErrorsByType.replace('{name}', name)] = 'L';
    // [List] Errors per account.
    typeByKey[Keys.trackerErrorsById.replace('{name}', name)] = 'L';
    // [List] Devices with high consecutive errors.
    typeByKey[Keys.trackerConsecutiveErrorsById.replace('{name}', name)] = 'L';
    // [List] Devices with high consecutive errors.
    typeByKey[Keys.trackerManyErrorsById.replace('{name}', name)] = 'L';
    // [List] Number of fetch devices.
    typeByKey[Keys.trackerNumFetches.replace('{name}', name)] = 'L';
    // [List] Number of fetch devices.
    typeByKey[Keys.trackerNumUpdates.replace('{name}', name)] = 'L';
    // [List] Fetch duration in seconds.
    typeByKey[Keys.trackerFetchDuration.replace('{name}', name)] = 'L';
  }

  const pipeline = redis.pipeline();

  for (const [key, cmd] of Object.entries(typeByKey)) {
    if (cmd === 'S') {
      pipeline.get(key);
    }
    if (cmd === 'L') {
      pipeline.lrange(key, 0, -1);
    }
  }

  const result = await pipeline.exec();

  const values: { [key: string]: string | string[] } = {};

  Object.keys(typeByKey).forEach((key, i) => {
    values[key] = result[i][1];
  });

  return values;
}
