import csurf from '@dr.pogodin/csurf';
import { AccountFormModel, Keys, trackerNames, ufoFleetNames } from '@flyxc/common';
import { TRACK_TABLE, retrieveLiveTrackById, retrieveRecentTracks } from '@flyxc/common-node';
import { NextFunction, Request, Response, Router } from 'express';
import { Redis } from 'ioredis';
import zlib from 'zlib';

import { Datastore } from '@google-cloud/datastore';

import { createOrUpdateLiveTrack } from './live-track';
import { isAdmin } from './session';

// Store the token in the session.
const csrfProtection = csurf({ cookie: false });

export function getAdminRouter(redis: Redis, datastore: Datastore): Router {
  const router = Router();

  // Restrict routes to admin users.
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (!isAdmin(req)) {
      return res.sendStatus(403);
    }
    return next();
  });

  router.get('/admin.json', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    res.json(await getDashboardValues(redis, datastore));
  });

  router.get('/state.pbf', async (req: Request, res: Response) => {
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

  router.post('/state/cmd/:cmd', async (req: Request, res: Response) => {
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

  router.get(`/account/:id.json`, csrfProtection, async (req: Request, res: Response) => {
    try {
      const entity = await retrieveLiveTrackById(datastore, req.params.id);
      if (entity) {
        const account = AccountFormModel.createFromEntity(entity);
        res.set('xsrf-token', (req as any).csrfToken());
        return res.json(account);
      }
    } catch (e) {
      console.error(e);
    }
    return res.sendStatus(400);
  });

  router.post(`/account/:id.json`, csrfProtection, async (req: Request, res: Response) => {
    try {
      const entity = await retrieveLiveTrackById(datastore, req.params.id);
      if (entity) {
        return createOrUpdateLiveTrack(datastore, entity, req, res, entity.email, entity.google_id, redis);
      }
    } catch (e) {
      console.error(e);
    }
    return res.sendStatus(400);
  });

  // Retrieves the list of tracks.
  // The `tracks` query parameter set the number of tracks to retrieve.
  router.get('/archives.json', async (req: Request, res: Response) => {
    let numTracks = Number(req.query.tracks);
    numTracks = Math.min(isNaN(numTracks) ? 50 : numTracks, 50);
    let startCursor = req.query.cursor ? String(req.query.cursor) : null;
    if (startCursor == 'null') {
      startCursor = null;
    }
    const { cursor, tracks } = await retrieveRecentTracks(datastore, numTracks, startCursor);

    res.json({
      tracks: tracks.map((track) => ({
        id: track[Datastore.KEY]?.id,
        city: track.city,
        country: track.country,
        path: track.path,
        created: track.created,
      })),
      cursor,
    });
  });

  return router;
}

// Returns all the values needed for the dashboard (from REDIS).
async function getDashboardValues(redis: Redis, datastore: Datastore): Promise<unknown> {
  const query = datastore.createQuery(TRACK_TABLE);
  const countQuery = datastore.createAggregationQuery(query).count('numTracks');
  const [[countEntity]]: any = await datastore.runAggregationQuery(countQuery);
  await redis.set(Keys.trackNum, countEntity.numTracks);

  // Retrieves all values from Redis (Scalar or List).
  const typeByKey: { [key: string]: 'S' | 'L' } = {
    // Scalars
    [Keys.fetcherMemoryRssMb]: 'S',
    [Keys.fetcherMemoryHeapMb]: 'S',
    [Keys.fetcherStartedSec]: 'S',
    [Keys.fetcherReStartedSec]: 'S',
    [Keys.fetcherNextStopSec]: 'S',
    [Keys.fetcherStoppedSec]: 'S',
    [Keys.fetcherNumTicks]: 'S',
    [Keys.fetcherNumStarts]: 'S',
    [Keys.fetcherLastDeviceUpdatedMs]: 'S',
    [Keys.fetcherNextPartialSyncSec]: 'S',
    [Keys.fetcherNextFullSyncSec]: 'S',
    [Keys.fetcherNextExportSec]: 'S',
    [Keys.hostCpuUsage]: 'S',
    [Keys.hostUptimeSec]: 'S',
    [Keys.hostMemoryUsedMb]: 'S',
    [Keys.hostMemoryTotalMb]: 'S',
    [Keys.hostNode]: 'S',
    [Keys.fetcherFullNumTracks]: 'S',
    [Keys.fetcherIncrementalNumTracks]: 'S',
    [Keys.trackerNum]: 'S',
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
    [Keys.proxyInreach]: 'L',
  };

  for (const name of trackerNames) {
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

  for (const name of ufoFleetNames) {
    // [List] Global errors.
    typeByKey[Keys.trackerErrorsByType.replace('{name}', name)] = 'L';
    // [List] Errors per account.
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
    values[key] = result![i][1] as string | string[];
  });

  return values;
}
