import { LiveDifferentialTrackGroup, LiveTrack } from 'flyxc/common/protos/live-track';
import { idFromEntity } from 'flyxc/common/src/datastore';
import {
  differentialEncodeLiveTrack,
  EXPORT_UPDATE_SEC,
  INCREMENTAL_UPDATE_SEC,
  LIVE_RETENTION_SEC,
  removeBeforeFromLiveTrack,
  removeDeviceFromLiveTrack,
  TrackerIds,
  trackerPropNames,
} from 'flyxc/common/src/live-track';
import { LIVE_TRACK_TABLE, LiveTrackEntity } from 'flyxc/common/src/live-track-entity';
import { getRedisClient, Keys, pushListCap } from 'flyxc/common/src/redis';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';

import { Datastore } from '@google-cloud/datastore';
import Router, { RouterContext } from '@koa/router';

import { postProcessTrack } from './process/process';
import { updateTrackers } from './trackers/live-track';

const app = new Koa();
const router = new Router();
const datastore = new Datastore();

// Refresh the live tracking devices.
router.post('/refresh', async (ctx: RouterContext) => {
  const refreshStart = Date.now();
  const redis = getRedisClient();
  const requestTime = Number((await redis.get(Keys.trackerRequestTimestamp)) ?? refreshStart);
  const requestAgeMin = (refreshStart - requestTime) / (60 * 1000);

  // Refresh if there was a request from flyxc.app in the last 10 minutes.
  if (requestAgeMin < 10) {
    const logs = await updateTrackers();

    const querySec = Math.round(Date.now() / 1000);
    const incrementalStartSec = querySec - INCREMENTAL_UPDATE_SEC;
    const exportStartSec = querySec - EXPORT_UPDATE_SEC;

    // Get all the tracks that have active points.
    // TODO: re-use the track from the previous step to fetch less.
    const query = datastore
      .createQuery(LIVE_TRACK_TABLE)
      .filter('last_fix_sec', '>', Datastore.int(querySec - LIVE_RETENTION_SEC));

    const [tracksEntities] = await datastore.runQuery(query);

    const fullTracks = LiveDifferentialTrackGroup.create();
    const incrementalTracks = LiveDifferentialTrackGroup.create({ incremental: true });
    const flymeTracks = LiveDifferentialTrackGroup.create();

    tracksEntities.forEach((entity: LiveTrackEntity) => {
      const liveTrack = entity.track ? LiveTrack.fromBinary(entity.track) : LiveTrack.create();
      const id = idFromEntity(entity);
      const name = entity.name || 'unknown';
      // Full update.
      fullTracks.tracks.push(differentialEncodeLiveTrack(liveTrack, id, name));
      // Incremental update.
      const incrementalTrack = removeBeforeFromLiveTrack(liveTrack, incrementalStartSec);
      if (incrementalTrack.timeSec.length > 0) {
        incrementalTracks.tracks.push(differentialEncodeLiveTrack(incrementalTrack, id, name));
      }
      // Export updates.
      const exportTrack = removeBeforeFromLiveTrack(incrementalTrack, exportStartSec);
      if (exportTrack.timeSec.length > 0) {
        const flymeTrack = removeDeviceFromLiveTrack(exportTrack, TrackerIds.Flyme);
        if (flymeTrack.timeSec.length > 0) {
          flymeTracks.tracks.push(differentialEncodeLiveTrack(flymeTrack, id, name));
          // TODO: fn to retrieve the ID.
          let flymeId = '';
          try {
            flymeId = String(JSON.parse(entity.flyme.account).id ?? '');
          } catch (e) {}
          flymeTracks.remoteId.push(flymeId);
        }
      }
    });

    const pipeline = redis.pipeline();

    // Write logs to Redis.
    for (const [trackerId, logEntry] of logs.entries()) {
      const time = Math.round(logEntry.timestamp / 1000);
      const prefix = Keys.trackerLogsPrefix + ':' + trackerPropNames[trackerId] + ':';
      pushListCap(
        pipeline,
        `${prefix}errors`,
        logEntry.errors.map((e) => `[${time}] ${e}`),
        10,
      );
      pushListCap(
        pipeline,
        `${prefix}errors:id`,
        Array.from(logEntry.accountErrors.entries()).map(([id, error]) => `[${time}] id=${id} ${error}`),
        10,
      );
      pushListCap(pipeline, `${prefix}size`, [logEntry.numDevices], 10);
      pushListCap(pipeline, `${prefix}time`, [time], 10);
      pushListCap(pipeline, `${prefix}duration`, [logEntry.durationSec], 10);
    }

    try {
      await pipeline
        .set(Keys.trackerFullProto, Buffer.from(LiveDifferentialTrackGroup.toBinary(fullTracks)))
        .set(Keys.trackerFullSize, fullTracks.tracks.length)
        .set(Keys.trackerIncrementalProto, Buffer.from(LiveDifferentialTrackGroup.toBinary(incrementalTracks)))
        .set(Keys.trackerIncrementalSize, incrementalTracks.tracks.length)
        .set(Keys.trackerFlymeProto, Buffer.from(LiveDifferentialTrackGroup.toBinary(flymeTracks)))
        .set(Keys.trackerUpdateSec, querySec)
        .exec();
    } catch (e) {
      console.error(`REDIS store error: ${e}`);
    }

    console.log(`Response prepared in ${Math.round(Date.now() / 1000 - querySec)}s`);
  }

  console.log(`Refresh total time: ${Math.round((Date.now() - refreshStart) / 1000)}s`);

  ctx.status = 200;
});

// Post-process tracks.
router.post('/process', async (ctx: RouterContext) => {
  const body = ctx.request.body;
  if (body?.message?.data) {
    let id = '-';
    try {
      id = JSON.parse(Buffer.from(body.message.data, 'base64').toString()).id;
      console.log(`Post processing id = ${id}`);
      await postProcessTrack(id);
    } catch (e) {
      console.error(`Error processing id = ${id}`, e);
    }
  }

  ctx.status = 200;
});

app.use(bodyParser()).use(router.routes()).use(router.allowedMethods());

const port = process.env.PORT || 8080;

app.listen(port);
