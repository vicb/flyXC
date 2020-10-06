/* eslint-disable @typescript-eslint/no-var-requires */
const { Datastore } = require('@google-cloud/datastore');

import Redis from 'ioredis';

import Router, { RouterContext } from '@koa/router';

import { Keys } from '../keys';

const datastore = new Datastore();
const redis = new Redis(Keys.REDIS_URL);

export function registerTrackerRoutes(router: Router): void {
  // Get the geojson for the currently active trackers.
  router.get(
    '/_trackers.geojson',
    async (ctx: RouterContext): Promise<void> => {
      await redis.set('trackers.request', Date.now());
      ctx.body = await redis.get('trackers.geojson');
    },
  );

  // Get the tracker information if the users is signed id.
  router.get(
    '/_tracker',
    async (ctx: RouterContext): Promise<void> => {
      if (ctx.session?.grant?.response?.access_token == null) {
        ctx.body = JSON.stringify({ signedIn: false });
        return;
      }

      try {
        const { name, email, sub } = ctx.session?.grant?.response?.profile;
        const key = datastore.key(['Tracker', sub]);
        let tracker = (await datastore.get(key))[0];
        if (!tracker) {
          tracker = {
            created: new Date(),
            updated: 0,
            device: 'no',
            inreach: '',
            spot: '',
            skylines: '',
            email,
            name,
          };
          await datastore.save({
            key,
            data: tracker,
          });
        }
        ctx.set('Content-Type', 'application/json');
        ctx.body = JSON.stringify({
          signedIn: true,
          name,
          device: tracker.device,
          inreach: tracker.inreach,
          spot: tracker.spot,
          skylines: tracker.skylines,
        });
      } catch (e) {
        ctx.throw(400);
      }
    },
  );

  // Updates the tracker information.
  router.post(
    '/_tracker',
    async (ctx: RouterContext): Promise<void> => {
      try {
        if (ctx.session?.grant?.response?.access_token == null) {
          ctx.throw(400);
        }
        const key = datastore.key(['Tracker', ctx.session?.grant?.response?.profile?.sub]);
        const tracker = (await datastore.get(key))[0];
        if (tracker) {
          ['device', 'inreach', 'spot', 'skylines'].forEach((k) => {
            tracker[k] = ctx.request.body[k];
          });
          tracker.updated = 0;
          await datastore.save({
            key,
            data: tracker,
            excludeFromIndexes: ['features'],
          });
        }
        ctx.set('Content-Type', 'application/json');
        ctx.body = JSON.stringify({ error: false });
        // sign the user out
        ctx.session = null;
      } catch (e) {
        ctx.throw(400);
      }
    },
  );
}
