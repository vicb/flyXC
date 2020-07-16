/* eslint-disable @typescript-eslint/no-var-requires */
const { Datastore } = require('@google-cloud/datastore');
/* eslint-enable @typescript-eslint/no-var-requires */

import GeoJSON from 'geojson';
import Redis from 'ioredis';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';

import Router, { RouterContext } from '@koa/router';

import { Keys } from '../../app/src/keys';
import { postProcessTrack } from './process/process';
import { refresh as refreshInreach } from './trackers/inreach';
import { refresh as refreshSpot } from './trackers/spot';
import { REFRESH_MAX_HOURS, REFRESH_TIMEOUT_SECONDS } from './trackers/trackers';

const app = new Koa();
const router = new Router();
const datastore = new Datastore();
const redis = new Redis(Keys.REDIS_URL);

router.post('/refresh', async (ctx: RouterContext) => {
  let numRefreshed = 0;
  const request = Number(await redis.get('trackers.request'));
  if (request > Date.now() - 10 * 60 * 1000) {
    // Refresh the trackers
    numRefreshed += await refreshInreach(datastore, REFRESH_MAX_HOURS, REFRESH_TIMEOUT_SECONDS);
    numRefreshed += await refreshSpot(datastore, REFRESH_MAX_HOURS, REFRESH_TIMEOUT_SECONDS);
    // Merge the tracks for all the trackers that have been updated less than 20 minutes ago.
    // The resulting GeoJSON is stored in Redis to be read by the flyxc server.
    const query = datastore.createQuery('Tracker').filter('updated', '>', Date.now() - 20 * 60 * 1000);
    const trackers = (await datastore.runQuery(query))[0];
    const features: any[] = [];
    trackers.forEach((tracker: any) => features.push(...JSON.parse(tracker.features || [])));
    const tracks = GeoJSON.parse(features, { Point: ['lat', 'lon'], LineString: 'line' });
    await redis.set('trackers.geojson', JSON.stringify(tracks));
    await redis.set('trackers.refreshed', Date.now());
    await redis.set('trackers.numrefreshed', numRefreshed);
  }

  ctx.status = 200;
});

router.get('/refresh', async (ctx: RouterContext) => {
  const query = datastore.createQuery('Tracker').order('updated', { descending: true }).limit(1);

  const devices = (await datastore.runQuery(query))[0];

  if (devices.length > 0) {
    const date = new Date(devices[0].updated);
    ctx.body = `Last refresh = ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  } else {
    ctx.body = 'No device available';
  }
});

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
