/* eslint-disable @typescript-eslint/no-var-requires */
const Koa = require('koa');
const Router = require('koa-router');
const { Datastore } = require('@google-cloud/datastore');
const geoJson = require('geojson');
const Redis = require('ioredis');
/* eslint-enable @typescript-eslint/no-var-requires */

import * as K from 'koa';

import { Keys } from '../../app/src/keys';
import { refresh as refreshInreach } from './inreach';
import { refresh as refreshSpot } from './spot';

const app = new Koa();
const router = new Router();
const datastore = new Datastore();
const redis = new Redis(Keys.REDIS_URL);

router.post('/refresh', async (ctx: K.Context) => {
  let numRefreshed = 0;
  const request = Number(await redis.get('trackers.request'));
  if (request > Date.now() - 10 * 60 * 1000) {
    // Refresh the trackers
    numRefreshed += await refreshInreach(datastore, 12, 40);
    numRefreshed += await refreshSpot(datastore, 12, 40);
    // Merge the tracks
    const query = datastore.createQuery('Tracker').filter('updated', '>', Date.now() - 20 * 60 * 1000);
    const trackers = (await datastore.runQuery(query))[0];
    const features: any[] = [];
    trackers.forEach((tracker: any) => features.push(...JSON.parse(tracker.features || [])));
    const tracks = geoJson.parse(features, { Point: ['lat', 'lon'], LineString: 'line' });
    await redis.set('trackers.geojson', JSON.stringify(tracks));
    await redis.set('trackers.refreshed', Date.now());
    await redis.set('trackers.numrefreshed', numRefreshed);
  }

  ctx.status = 200;
});

router.get('/refresh', async (ctx: K.Context) => {
  const query = datastore
    .createQuery('Tracker')
    .order('updated', { descending: true })
    .limit(1);

  const devices = (await datastore.runQuery(query))[0];

  if (devices.length > 0) {
    const date = new Date(devices[0].updated);
    ctx.body = `Last refresh = ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  } else {
    ctx.body = 'No device available';
  }
});

app.use(router.routes()).use(router.allowedMethods());

const port = process.env.PORT || 8080;
app.listen(port);
