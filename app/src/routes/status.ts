/* eslint-disable @typescript-eslint/no-var-requires */
const { Datastore } = require('@google-cloud/datastore');
/* eslint-enable @typescript-eslint/no-var-requires */

import Redis from 'ioredis';

import Router, { RouterContext } from '@koa/router';

import { Keys } from '../keys';

const datastore = new Datastore();
const redis = new Redis(Keys.REDIS_URL);

export function registerStatusRoutes(router: Router): void {
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
        'active-trackers': (
          await datastore.createQuery('Tracker').filter('active', '=', true).select('__key__').run()
        )[0].length,
        trackers: totalTrackers - unactivatedTrackers,
        unactivatedTrackers,
        tracks: (await datastore.createQuery('Track').select('__key__').run())[0].length,
      });
    },
  );
}
