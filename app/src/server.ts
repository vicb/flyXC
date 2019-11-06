/* eslint-disable @typescript-eslint/no-var-requires */
const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const compress = require('koa-compress');
const multer = require('@koa/multer');
const serve = require('koa-static');
const Pbf = require('pbf');
const QRCode = require('qrcode');
const { OAuth2Client } = require('google-auth-library');
const { Datastore } = require('@google-cloud/datastore');
const Redis = require('ioredis');

/* eslint-enable @typescript-eslint/no-var-requires */

import * as K from 'koa';

import { Track, getLastTracks, parse, parseFromUrl, retrieveFromHistory } from './parser/parser';

import { Keys } from './keys';
import { Tracks } from '../../frontend/src/viewer/logic/track';
import { encode } from './waypoints';

const datastore = new Datastore();

const upload = multer();
const app = new Koa();
const router = new Router();
const redis = new Redis(Keys.REDIS_URL);

function sendTracks(ctx: K.Context, tracks: Track[]): any {
  if (tracks.length) {
    const pbf = new Pbf();
    (Tracks as any).write({ track: tracks }, pbf);
    ctx.set('Content-Type', 'application/x-protobuf');
    ctx.body = Buffer.from(pbf.finish());
  } else {
    ctx.throw(400);
  }
}

router.get(
  '/_download',
  async (ctx: K.Context): Promise<void> => {
    const urls = new URLSearchParams(ctx.query).getAll('track');
    const tracks: Track[][] = await Promise.all(urls.map(parseFromUrl));
    sendTracks(ctx, ([] as Track[]).concat(...tracks));
  },
);

router.get(
  '/_history',
  async (ctx: K.Context): Promise<void> => {
    const ids = new URLSearchParams(ctx.query).getAll('h');
    const tracks: Track[][] = await Promise.all(ids.map(retrieveFromHistory));
    sendTracks(ctx, ([] as Track[]).concat(...tracks));
  },
);

router.get(
  '/_archives',
  async (ctx: K.Context): Promise<void> => {
    const history = await getLastTracks(ctx.query.tracks || 10);

    ctx.body = JSON.stringify(
      history.map((h: any) => ({
        city: h.city,
        country: h.country,
        path: h.path,
        hash: h.hash,
        created: h.created,
      })),
    );
  },
);

router.get(
  '/_trackers.geojson',
  async (ctx: K.Context): Promise<void> => {
    await redis.set('trackers.request', Date.now());
    ctx.body = await redis.get('trackers.geojson');
  },
);

router.get(
  '/_status.json',
  async (ctx: K.Context): Promise<void> => {
    ctx.set('Content-Type', 'application/json');
    ctx.body = JSON.stringify({
      'last-request': Number(await redis.get('trackers.request')),
      'last-refresh': Number(await redis.get('trackers.refreshed')),
      'num-refresh': Number(await redis.get('trackers.numrefreshed')),
      'active-trackers': (await datastore
        .createQuery('Tracker')
        .filter('active', '=', true)
        .select('__key__')
        .run())[0].length,
      trackers: (await datastore
        .createQuery('Tracker')
        .select('__key__')
        .run())[0].length,
      tracks: (await datastore
        .createQuery('Track')
        .select('__key__')
        .run())[0].length,
    });
  },
);

router.post(
  '/_tokenSignIn',
  async (ctx: K.Context): Promise<void> => {
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

router.post(
  '/_updateTracker',
  async (ctx: K.Context): Promise<void> => {
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

router.post(
  '/_upload',
  upload.fields([
    {
      name: 'track',
    },
  ]),
  async (ctx: K.Context): Promise<unknown> => {
    const request = ctx.request as any;
    const files = request.files.track.map((v: any) => v.buffer.toString());
    const tracks: Track[][] = await Promise.all(files.map(parse));
    sendTracks(ctx, ([] as Track[]).concat(...tracks));
    return;
  },
);

router.post('/_waypoints', (ctx: K.Context): void => {
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

router.get('/_qr.svg', async (ctx: K.Context) => {
  ctx.set('Content-Type', 'image/svg+xml');
  ctx.body = await QRCode.toString(ctx.query.text, { type: 'svg' });
});

app
  .use(
    compress({
      filter: function(contentType: string): boolean {
        return /text|javascript|x-protobuf|svg/i.test(contentType);
      },
      threshold: 2048,
      flush: require('zlib').Z_SYNC_FLUSH,
    }),
  )
  .use(bodyParser({ formLimit: '32mb' }))
  .use(router.routes())
  .use(router.allowedMethods())
  .use(serve('frontend/static'));

const port = process.env.PORT || 8080;
app.listen(port);
