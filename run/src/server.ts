import { LiveDifferentialTrackGroup, LiveTrack } from 'flyxc/common/protos/live-track';
import { idFromEntity } from 'flyxc/common/src/datastore';
import { Keys } from 'flyxc/common/src/keys';
import {
  differentialEncodeLiveTrack,
  EXPORT_UPDATE_SEC,
  INCREMENTAL_UPDATE_SEC,
  LIVE_RETENTION_SEC,
  removeBeforeFromLiveTrack,
  removeDeviceFromLiveTrack,
  TrackerIds,
} from 'flyxc/common/src/live-track';
import { LIVE_TRACK_TABLE, LiveTrackEntity } from 'flyxc/common/src/live-track-entity';
import Redis from 'ioredis';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';

import { Datastore } from '@google-cloud/datastore';
import Router, { RouterContext } from '@koa/router';

import { postProcessTrack } from './process/process';
import { updateTrackers } from './trackers/live-track';

const app = new Koa();
const router = new Router();
const datastore = new Datastore();
const redis = new Redis(Keys.REDIS_URL);

// Refresh the live tracking devices.
router.post('/refresh', async (ctx: RouterContext) => {
  const request = Number(await redis.get('trackers.request'));
  // Refresh if there was a request from flyxc.app in the last 10 minutes.
  const start = Date.now();
  if (request > Date.now() - 10 * 60 * 1000) {
    await updateTrackers();

    const startQuery = Date.now();
    const incrementalStart = Math.round(startQuery / 1000 - INCREMENTAL_UPDATE_SEC);
    const exportStart = Math.round(startQuery / 1000 - EXPORT_UPDATE_SEC);

    // Get all the tracks that have active points.
    // TODO: re-use the track from the previous step to fetch less.
    const query = datastore
      .createQuery(LIVE_TRACK_TABLE)
      // Math.round is required here: https://github.com/googleapis/nodejs-datastore/issues/754
      .filter('last_fix_sec', '>', Math.round(Date.now() / 1000 - LIVE_RETENTION_SEC));

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
      const incrementalTrack = removeBeforeFromLiveTrack(liveTrack, incrementalStart);
      if (liveTrack.timeSec.length > 0) {
        incrementalTracks.tracks.push(differentialEncodeLiveTrack(incrementalTrack, id, name));
      }
      // Export updates.
      const exportTrack = removeBeforeFromLiveTrack(incrementalTrack, exportStart);
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

    // TODO: error mgmt - maybe util for allSettled
    await Promise.allSettled([
      redis.setBuffer('trackers.proto', Buffer.from(LiveDifferentialTrackGroup.toBinary(fullTracks))),
      redis.setBuffer('trackers.inc.proto', Buffer.from(LiveDifferentialTrackGroup.toBinary(incrementalTracks))),
      redis.setBuffer('trackers.flyme.proto', Buffer.from(LiveDifferentialTrackGroup.toBinary(flymeTracks))),
    ]);

    console.log(`Response prepared in ${Math.round((Date.now() - startQuery) / 1000)}s`);

    // TODO(victor):
    // set num actives 24h = trackers.length
    // set num actives 2h
    // Check redis set multiple ? (& get multiple);
    //await redis.set('trackers.numrefreshed', numRefreshed);
  }

  console.log(`Refresh total time: ${Math.round((Date.now() - start) / 1000)}s`);

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
