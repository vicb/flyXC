/* eslint-disable @typescript-eslint/no-var-requires */
const multer = require('@koa/multer');
const { OAuth2Client } = require('google-auth-library');
const { Datastore } = require('@google-cloud/datastore');
/* eslint-enable @typescript-eslint/no-var-requires */

import Redis from 'ioredis';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import serve from 'koa-static';
import Pbf from 'pbf';
import QRCode from 'qrcode';

import Router, { RouterContext } from '@koa/router';

import { retrieveMetaTrackGroupsByIds, TrackEntity } from '../../common/datastore';
import { migrate } from '../../common/migrate';
import { ProtoMetaTrackGroup } from '../../common/track';
import * as protos from '../../common/track_proto';
import { Keys } from './keys';
import { getLastTracks, parse, parseFromUrl, retrieveByHash } from './parser/parser';
import { encode } from './waypoints';

const datastore = new Datastore();

const upload = multer();
const app = new Koa();
const router = new Router();
const redis = new Redis(Keys.REDIS_URL);

function sendTracks(ctx: RouterContext, metaGroups: ProtoMetaTrackGroup[]): void {
  if (metaGroups.length == 0) {
    ctx.throw(400);
  }
  const metaGroupsBin = metaGroups.map((group) => {
    const pbf = new Pbf();
    (protos.MetaTrackGroup as any).write(group, pbf);
    return pbf.finish();
  });
  const pbf = new Pbf();
  (protos.MetaTracks as any).write({ meta_track_groups_bin: metaGroupsBin }, pbf);
  ctx.set('Content-Type', 'application/x-protobuf');
  ctx.body = Buffer.from(pbf.finish());
}

// Retrieves tracks by url.
router.get(
  '/_download',
  async (ctx: RouterContext): Promise<void> => {
    const urls = [].concat(ctx.query.track);
    const trackGroups: ProtoMetaTrackGroup[] = await Promise.all(urls.map(parseFromUrl));
    sendTracks(ctx, trackGroups);
  },
);

// Retrieves tracks by datastore ids.
router.get(
  '/_history',
  async (ctx: RouterContext): Promise<void> => {
    const hashs = [].concat(ctx.query.h);
    const trackGroups: ProtoMetaTrackGroup[] = await Promise.all(hashs.map(retrieveByHash));
    sendTracks(ctx, trackGroups);
  },
);

// Retrieves the list of tracks.
// The `tracks` query parameter set the number of tracks to retrieve.
router.get(
  '/_archives',
  async (ctx: RouterContext): Promise<void> => {
    const tracks: TrackEntity[] = await getLastTracks(ctx.query.tracks || 10);

    ctx.body = JSON.stringify(
      tracks.map((track: any) => ({
        city: track.city,
        country: track.country,
        path: track.path,
        hash: track.hash,
        created: track.created,
      })),
    );
  },
);

// Get the geojson for the currently active trackers.
router.get(
  '/_trackers.geojson',
  async (ctx: RouterContext): Promise<void> => {
    await redis.set('trackers.request', Date.now());
    ctx.body = await redis.get('trackers.geojson');
  },
);

// Retrieves status information.
router.get(
  '/_status.json',
  async (ctx: RouterContext): Promise<void> => {
    const totalTrackers = (await datastore.createQuery('Tracker').select('__key__').run())[0].length;
    const unactivatedTrackers = (
      await datastore.createQuery('Tracker').filter('device', '=', 'no').select('__key__').run()
    )[0].length;
    ctx.set('Content-Type', 'application/json');
    ctx.body = JSON.stringify({
      'last-request': Number(await redis.get('trackers.request')),
      'last-refresh': Number(await redis.get('trackers.refreshed')),
      'num-refresh': Number(await redis.get('trackers.numrefreshed')),
      'active-trackers': (await datastore.createQuery('Tracker').filter('active', '=', true).select('__key__').run())[0]
        .length,
      trackers: totalTrackers - unactivatedTrackers,
      unactivatedTrackers,
      tracks: (await datastore.createQuery('Track').select('__key__').run())[0].length,
    });
  },
);

// SignIn when adding/updating a tracker.
router.post(
  '/_tokenSignIn',
  async (ctx: RouterContext): Promise<void> => {
    try {
      const userId = await getUserId(ctx.request.body.token);
      const key = datastore.key(['Tracker', userId]);
      let tracker = (await datastore.get(key))[0];
      if (!tracker) {
        tracker = {
          created: new Date(),
          updated: 0,
          device: 'no',
          inreach: '',
          spot: '',
          email: ctx.request.body.email,
          name: ctx.request.body.name,
        };
        await datastore.save({
          key,
          data: tracker,
        });
      }
      ctx.set('Content-Type', 'application/json');
      ctx.body = JSON.stringify({
        device: tracker.device,
        inreach: tracker.inreach,
        spot: tracker.spot,
      });
    } catch (e) {
      ctx.throw(400);
    }
  },
);

// Updates the tracker information.
router.post(
  '/_updateTracker',
  async (ctx: RouterContext): Promise<void> => {
    try {
      const userId = await getUserId(ctx.request.body.token);
      const key = datastore.key(['Tracker', userId]);
      const tracker = (await datastore.get(key))[0];
      if (tracker) {
        tracker.device = ctx.request.body.device;
        tracker.inreach = ctx.request.body.inreach;
        tracker.spot = ctx.request.body.spot;
        tracker.updated = 0;
        await datastore.save({
          key,
          data: tracker,
          excludeFromIndexes: ['features'],
        });
      }
      ctx.set('Content-Type', 'application/json');
      ctx.body = JSON.stringify({
        device: tracker.device,
        inreach: tracker.inreach,
        spot: tracker.spot,
      });
    } catch (e) {
      ctx.throw(400);
    }
  },
);

async function getUserId(idToken: string): Promise<string> {
  const CLIENT_ID = '754556983658-qscerk4tpsu8mgb1kfcq5gvf8hmqsamn.apps.googleusercontent.com';
  const client = new OAuth2Client(CLIENT_ID);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: CLIENT_ID,
  });
  const payload = ticket.getPayload();
  return payload['sub'];
}

// Upload tracks to the database.
router.post(
  '/_upload',
  upload.array('track'),
  async (ctx: RouterContext): Promise<unknown> => {
    const request = ctx.request as any;
    const files: string[] = request.files.map((file: any) => file.buffer.toString());
    const tracks: ProtoMetaTrackGroup[] = await Promise.all(files.map((file) => parse(file)));
    sendTracks(ctx, tracks);
    return;
  },
);

// Retrieves tracks by datastore ids.
router.get(
  '/_metadata',
  async (ctx: RouterContext): Promise<void> => {
    if (ctx.query.ids == null) {
      ctx.status = 200;
    }
    const ids = ctx.query.ids.split(',');
    const trackGroups: Array<ProtoMetaTrackGroup> = await retrieveMetaTrackGroupsByIds(ids);
    const processedGroups: ProtoMetaTrackGroup[] = [];
    trackGroups.forEach((group) => {
      if (group != null && group.num_postprocess > 0) {
        // Delete the tracks and keep only metadata.
        group.track_group_bin = undefined;
        processedGroups.push(group);
      }
    });
    if (processedGroups.length > 0) {
      sendTracks(ctx, processedGroups);
    } else {
      ctx.body = '';
    }
  },
);

// Generates a waypoint file.
router.post('/_waypoints', (ctx: RouterContext): void => {
  if (!ctx.request.body.request) {
    ctx.throw(400);
  }
  // points elevations format prefix
  const { format, points, elevations, prefix } = JSON.parse(ctx.request.body.request);
  const { mime, file, ext, error } = encode(format, points, elevations, prefix);

  if (error) {
    ctx.redirect('back');
  } else {
    ctx.set('Content-Type', mime!);
    ctx.set('Content-disposition', `attachment; filename=waypoints.${ext}`);
    ctx.body = file;
  }
});

// Generates a QR code from the given route.
router.get('/_qr.svg', async (ctx: RouterContext) => {
  ctx.set('Content-Type', 'image/svg+xml');
  ctx.body = await QRCode.toString(ctx.query.text, { type: 'svg' });
});

// @ts-ignore: always false in prod mode.
if (process.env.NODE_ENV == 'development') {
  router.get('/__migrate', async (ctx: RouterContext) => {
    await migrate();
    ctx.status = 200;
  });
}

app
  .use(bodyParser({ formLimit: '32mb' }))
  .use(router.routes())
  .use(router.allowedMethods())
  .use(serve('frontend/static'));

const port = process.env.PORT || 8080;
app.listen(port);
